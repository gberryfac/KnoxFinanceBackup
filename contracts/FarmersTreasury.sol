// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

struct Farmer {
    uint64 normalisedBalance; //64bits should be enough to handle reasonable deposits with enough granularity
    //we can restrict that deposits needs to be for instance multiplication of 1 GWEI,
    //and make struct much smaller and therefore operations on it cheaper
    int64 waitingAmount; //this value is signed for a reason, if negative means user requested withdrawal
    int32 lastOpEpoch; // epoch when last deposit or withdrawal request was made, determines how to convert waitingAmount to normalisedBalance
    bool exists;
}

struct Epoch {
    uint64 epochAccumulator; // 10^15 is interpreted as 1, determines what is compounded value of every unit of collateral deposited at begining of epoch
    // for example if for epoch 1 (second after genesis) acumulator is 1.1*10^15 that means that epoch 0 earned 10% on deposits
    uint64 totalLendedAmount;
    uint64 totalRepayedAmount;
}

interface ITreasury {
    function baseToken() external returns(IERC20);
    function trustedBorrow(uint256 amount) external;
    function trustedRepay(uint256 amount) external;
    function currentEpoch() external returns(int32);
    function createNewEpoch() external;
}

contract FarmersTreasury {
    IERC20 immutable public baseToken;
    uint64 public totalAvailableAmount; //amount that can be still borrowed from strategy operator in current epoch
    int64 public totalWaitingAmount; //amount that was deposited during this epoch and therefore waits to join from next epoch
    mapping(address => Farmer) public farmers;
    mapping(int32 => Epoch) public epochs;
    uint256 immutable genesisTimeStamp; // timestamp of Friday at which epoch 0 started
    uint256 public currentEpochStart; // timestamp of Friday at which current epoch started
    uint256 constant WEEK_SPAN = 7 * 24 * 3600; // length of each epoch
    uint64 constant ACCUMULATOR_ONE = 10**15; // this number is interpreted as 1 if in accumulator
    uint256 constant WEI_PER_UNIT = 10**9; // this is amount of wei by which you need to multiply Farmer or Epoch balances to get correct onchain amount
    int32 public currentEpoch = -1;
    address public trustedContract;

    /**
     * @notice Constructor creates treasury for particular asset, different assets (collaterals) have different treasuries
     * @param _token address of ERC20 compatible asset contract (eg. WETH)
     * @param _start time when epoch 0, is expected to start, moment from which MM are allowed to buy spreads
     * @param _trustedContract address of contract responsible for creation of swaps, fully trusted, can withdraw and repay any amount at any time
     */
    constructor(
        address _token,
        uint256 _start,
        address _trustedContract
    ) {
        baseToken = IERC20(_token);
        genesisTimeStamp = _start;
        trustedContract = _trustedContract;
        epochs[-1] = Epoch(ACCUMULATOR_ONE, 0, 0);
    }

    //amount is in wei here
    //this function can be called anytime by any farmer to deposit funds to pool,
    //but they will not be used till new epoch
    function deposit(uint256 amount) public {
        require(
            baseToken.transferFrom(address(msg.sender), address(this), amount),
            "farmers-treasury/deposit-failed"
        );
        amount = amount / (10**9);
        totalWaitingAmount = totalWaitingAmount + int64(uint64(amount));
        Farmer memory farmer;
        farmer = ensureFarmer(farmers[msg.sender]);
        //console.log("deposit",amount);
        if (farmer.lastOpEpoch < currentEpoch || farmer.exists == false) {
            syncFarmer(msg.sender);
            farmer = farmers[msg.sender];
        }
        farmer.waitingAmount = farmer.waitingAmount + int64(uint64(amount));
        farmers[msg.sender] = farmer;
        emit FundsDeposited(msg.sender, amount, farmer.lastOpEpoch);
    }

    //this function can be called anytime by any farmer to cancel sheduled withdrawal,
    function clearWaiting() public {
        Farmer memory farmer = farmers[msg.sender];
        require(
            farmer.waitingAmount < 0,
            "farmers-treasury/no-withdraw-request"
        );
        totalWaitingAmount = totalWaitingAmount - farmer.waitingAmount;
        farmer.waitingAmount = 0;
        farmer.lastOpEpoch = currentEpoch;
        farmers[msg.sender] = farmer;
    }

    //amount is in wei here
    //this function can be called anytime by any farmer to withdraw funds from pool,
    //if funds are in use they will not be withdrawn till another withdraw method in new epoch
    function withdraw(uint256 amount) public {
        Farmer memory farmer = farmers[msg.sender];
        int64 amountInUnits = int64(uint64(amount / WEI_PER_UNIT));
        if (farmer.lastOpEpoch < currentEpoch) {
            syncFarmer(msg.sender);
            farmer = farmers[msg.sender];
        }
        if(epochs[currentEpoch].totalRepayedAmount>0){//after epoch settlement, before new epoch 
            farmer.normalisedBalance = updateNormalizedBalance(farmer, -int64(amountInUnits));
            require(
                    baseToken.transfer(
                        address(msg.sender),
                        uint256(int256(amountInUnits)) * WEI_PER_UNIT
                    ),
                    "farmers-treasury/withdrow-failed"
                );
        }else{
            totalWaitingAmount = totalWaitingAmount - int64(uint64(amountInUnits));
            if (farmer.waitingAmount > int64(uint64(amountInUnits)) && amountInUnits > 0) {
                
                require(
                    baseToken.transfer(
                        address(msg.sender),
                        uint256(int256(amountInUnits)) * WEI_PER_UNIT
                    ),
                    "farmers-treasury/withdrow-failed"
                );
                farmer.waitingAmount = farmer.waitingAmount - int64(uint64(amountInUnits));
            } else {
                if (farmer.waitingAmount > 0 && amountInUnits > 0) {
                    require(
                        baseToken.transfer(
                            address(msg.sender),
                            uint256(int256(farmer.waitingAmount)) * WEI_PER_UNIT
                        ),
                        "farmers-treasury/withdrow-failed"
                    );
                }
                farmer.waitingAmount = farmer.waitingAmount-amountInUnits;
            }
        }
        
        farmers[msg.sender] = farmer;
    }

    //returnes Farmers balance (in wei) at the begining of this epoch
    function getBalance(address _sender) public view returns (uint256, int256) {
        require(currentEpoch >= 0, "farmers-treasury/not-started");
        Farmer memory farmer = farmers[_sender];
        uint256 denormalizedAmount =
            (uint256(farmer.normalisedBalance) *
                epochs[currentEpoch].epochAccumulator) /
                ACCUMULATOR_ONE;
        return (denormalizedAmount, int256(farmer.waitingAmount));
    }

    //correctnes relies on syncFarmer being invoked in same transaction
    function updateNormalizedBalance(Farmer memory _farmer, int64 amount) private view returns (uint64 normalisedBalance){
        uint256 acc = epochs[currentEpoch].epochAccumulator;
        if(amount<0){
            normalisedBalance =  uint64(_farmer.normalisedBalance - uint64(-amount) * ACCUMULATOR_ONE / acc); 
        }else{
            normalisedBalance =   uint64(_farmer.normalisedBalance + uint64(amount) * ACCUMULATOR_ONE / acc); 
        }
        return normalisedBalance;
    }

    //this function gets called anytime when collateral is needed to build swap and sel it to MM
    function trustedBorrow(uint256 amount) public {
        require(currentEpoch >= 0, "farmers-treasury/not-started");
        int32 _currEpoch = currentEpoch;
        require(
            msg.sender == trustedContract,
            "farmers-treasury/caller-not-trusted"
        );
        require(
            _currEpoch >= 0 &&
                block.timestamp >= currentEpochStart &&
                block.timestamp <= currentEpochStart + WEEK_SPAN,
            "farmers-treasury/invalid-borrow-time"
        );
        require(
            baseToken.transfer(address(msg.sender), amount),
            "farmers-treasury/trusted-borrow-failed"
        );
        amount = amount / WEI_PER_UNIT;
        require(
            totalAvailableAmount >= amount,
            "farmers-treasury/insufficient-funds"
        );
        totalAvailableAmount = totalAvailableAmount - uint64(amount);
        epochs[_currEpoch].totalLendedAmount =
            epochs[_currEpoch].totalLendedAmount +
            uint64(amount);
    }

    //this method gets called anytime when MM swap gets settled/resolved and there is some collateral left
    //assumption is that premium is added to collateral while swap position is wrapped together
    function trustedRepay(uint256 amount) public {
        require(currentEpoch >= 0, "farmers-treasury/not-started");
        int32 _currEpoch = currentEpoch;
        require(
            msg.sender == trustedContract,
            "farmers-treasury/caller-not-trusted"
        );
        require(
            baseToken.transferFrom(address(msg.sender), address(this), amount),
            "farmers-treasury/trusted-borrow-failed"
        );
        amount = amount / WEI_PER_UNIT;
        epochs[_currEpoch].totalRepayedAmount =
            epochs[_currEpoch].totalRepayedAmount +
            uint64(amount);
        totalAvailableAmount = totalAvailableAmount + uint64(amount);
    }

    //this function gets called when all epoch gets settled
    function createNewEpoch() public {
        require(
            msg.sender == trustedContract,
            "farmers-treasury/caller-not-trusted"
        );
        int32 _currEpoch = 0;
        _currEpoch = currentEpoch + 1;
        currentEpoch = _currEpoch;
        uint256 timespansCount =
            (block.timestamp - genesisTimeStamp) / WEEK_SPAN;
        currentEpochStart = genesisTimeStamp + WEEK_SPAN * (timespansCount + 1); //nearest future friday
        totalAvailableAmount = uint64(
            int64(totalAvailableAmount) + totalWaitingAmount
        ); //total Waiting amount can be negative if all pending withdrawals exceeds all deposits
        totalWaitingAmount = 0;

        
        if(totalAvailableAmount>0){
            uint256 updatedAvailable = uint256(
                totalAvailableAmount -
                epochs[_currEpoch - 1].totalLendedAmount +
                epochs[_currEpoch - 1].totalRepayedAmount
            );
            

            epochs[_currEpoch].epochAccumulator = uint64(
                (uint256(epochs[_currEpoch - 1].epochAccumulator) * updatedAvailable)
                / 
                uint256(totalAvailableAmount)
            );
        }else{
            epochs[_currEpoch].epochAccumulator = epochs[_currEpoch - 1].epochAccumulator;
        }
    }

    function ensureFarmer(Farmer memory farmer) private returns(Farmer memory){
        if(farmer.exists == false){
            farmer.exists = true;
            farmer.lastOpEpoch = -1;
            farmer.normalisedBalance = 0;
        }
        return farmer;
    }
    
    //private function used to activate scheduled withdrawals or update formely made deposits
    function syncFarmer(address _farmer) private {
        Farmer memory farmer = farmers[_farmer];
        farmer = ensureFarmer(farmer);
        console.log("syncFarmer", uint256(int256(currentEpoch)));
        //console.log("syncFarmer - normalisedBalance", farmer.normalisedBalance);
        int32 currentEpochIndex = currentEpoch;
        if (
            currentEpochIndex != -1 &&
            farmer.lastOpEpoch < currentEpochIndex
        ) {
            if (farmer.waitingAmount < 0) {
                //withdraw funds to farmer
                uint256 amountOwned =
                    (farmer.normalisedBalance *
                        epochs[currentEpochIndex].epochAccumulator) /
                        ACCUMULATOR_ONE;

                //console.log("amountOwned1", amountOwned);

                require(amountOwned > uint256(int256(-farmer.waitingAmount)), "farmers-treasury/too-little-owned");
                require(
                    baseToken.transfer(
                        address(_farmer),
                        uint256(int256(-farmer.waitingAmount)) * WEI_PER_UNIT
                    ),
                    "farmers-treasury/withdrawal-failed"
                );
                amountOwned =
                    amountOwned -
                    uint256(int256(-farmer.waitingAmount));
                farmer.waitingAmount = 0;
                farmer.normalisedBalance = uint64(
                    uint256(
                        (amountOwned * ACCUMULATOR_ONE) /
                            epochs[currentEpochIndex].epochAccumulator
                    )
                );
                //console.log("amountOwned2", amountOwned);
            } else {
                if (farmer.waitingAmount > 0) {
                    uint256 amountOwned =
                    (farmer.normalisedBalance *
                        epochs[currentEpochIndex].epochAccumulator) /
                        ACCUMULATOR_ONE+uint64(farmer.waitingAmount);
                    
                    //console.log("amountOwned3", amountOwned);

                    farmer.normalisedBalance = uint64(
                        uint256(
                            (amountOwned * ACCUMULATOR_ONE) /
                                epochs[currentEpochIndex].epochAccumulator
                        )
                    );

                    farmer.waitingAmount = 0;
                }
            }
            farmer.lastOpEpoch = currentEpochIndex;
            //console.log("syncFarmer - normalisedBalance", farmer.normalisedBalance);
            farmers[_farmer] = farmer;
            emit FarmerSynced(_farmer, farmer.lastOpEpoch);
        }
    }

    event FarmerSynced(address farmer, int32 epoch);
    event FundsDeposited(address farmer, uint amount, int32 epochNumber);
}
