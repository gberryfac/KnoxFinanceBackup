// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

contract Vault {
    // amount that can be still borrowed from strategy operator in current epoch
    uint64 public totalAvailableAmount;
    // amount that was deposited during this epoch and therefore waits to join from next epoch
    int64 public totalWaitingAmount;
    // timestamp of Friday at which current epoch started
    uint256 public currentEpochStart;
    address public controller;

    // timestamp of Friday at which epoch 0 started
    uint256 immutable genesisTimestamp;
    IERC20 public immutable baseToken;

    // length of each epoch
    uint256 constant WEEK_SPAN = 7 * 24 * 3600;
    // this number is interpreted as 1 if in accumulator
    uint64 constant ACCUMULATOR_ONE = 10**15;
    // this is amount of wei by which you need to multiply Depositor or Epoch balances to get correct onchain amount
    uint256 constant WEI_PER_UNIT = 10**9;

    mapping(address => Depositor) public depositors;
    mapping(int32 => Epoch) public epochs;

    int32 public currentEpoch = -1;

    struct Depositor {
        //64bits should be enough to handle reasonable deposits with enough granularity
        //we can restrict that deposits needs to be for instance multiplication of 1 GWEI,
        //and make struct much smaller and therefore operations on it cheaper
        uint64 normalizedBalance;
        //this value is signed for a reason, if negative means user requested withdrawal
        int64 waitingAmount;
        // epoch when last deposit or withdrawal request was made, determines how to convert waitingAmount
        // to normalizedBalance
        int32 lastEpoch;
        bool exists;
    }

    struct Epoch {
        // 10^15 is interpreted as 1, determines what is compounded value of every unit of collateral deposited
        // at begining of epoch
        uint64 accumulator;
        // for example if for epoch 1 (second after genesis) acumulator is 1.1*10^15 that means that epoch 0
        // earned 10% on deposits
        uint64 totalLendedAmount;
        uint64 totalRepayedAmount;
    }

    event DepositorSynced(address depositor, int32 epoch);
    event FundsDeposited(address depositor, uint256 amount, int32 epochNumber);

    /**
     * @notice Constructor creates vault for particular asset, different assets (collaterals) have different
     * treasuries
     * @param _baseToken address of ERC20 compatible asset contract (eg. WETH).
     * @param _startTimestamp unix time when epoch 0 is expected to start.
     * @param _controller address of contract responsible for creation of swaps, fully trusted, can withdraw
     * and repay any amount at any time
     */
    constructor(
        address _baseToken,
        uint256 _startTimestamp,
        address _controller
    ) {
        baseToken = IERC20(_baseToken);
        genesisTimestamp = _startTimestamp;
        controller = _controller;
        epochs[-1] = Epoch(ACCUMULATOR_ONE, 0, 0);
    }

    //used to activate scheduled withdrawals or update deposits
    function syncFarmer(address _farmer) private {
        Depositor memory depositor = depositors[_farmer];
        depositor = initializeDepositor(depositor);

        // console.log("syncFarmer", uint256(int256(currentEpoch)));
        // console.log("syncFarmer - normalizedBalance", depositor.normalizedBalance);

        if (currentEpoch != -1 && depositor.lastEpoch < currentEpoch) {
            if (depositor.waitingAmount < 0) {
                // funds are withdrawn.
                uint256 amountOwned = getAmountOwned(
                    depositor.normalizedBalance
                );

                uint256 withdrawalAmount = uint256(
                    int256(-depositor.waitingAmount)
                );

                console.log("amountOwned1", amountOwned);

                require(
                    amountOwned >= withdrawalAmount,
                    "vault/insufficent-balance"
                );

                require(
                    baseToken.transfer(
                        address(_farmer),
                        withdrawalAmount * WEI_PER_UNIT
                    ),
                    "vault/withdrawal-failed"
                );

                amountOwned = amountOwned - withdrawalAmount;
                depositor.normalizedBalance = getNormalizedBalance(amountOwned);
            } else if (depositor.waitingAmount > 0) {
                // funds are deposited.
                uint256 amountOwned = getAmountOwned(
                    depositor.normalizedBalance
                ) + uint64(depositor.waitingAmount);

                depositor.normalizedBalance = getNormalizedBalance(amountOwned);
            }

            depositor.waitingAmount = 0;
            depositor.lastEpoch = currentEpoch;
            depositors[_farmer] = depositor;

            emit DepositorSynced(_farmer, depositor.lastEpoch);
        }
    }

    function getAmountOwned(uint64 normalizedBalance)
        internal
        view
        returns (uint256)
    {
        return
            (normalizedBalance * epochs[currentEpoch].accumulator) /
            ACCUMULATOR_ONE;
    }

    function getNormalizedBalance(uint256 amountOwned)
        internal
        view
        returns (uint64)
    {
        return
            uint64(
                uint256(
                    (amountOwned * ACCUMULATOR_ONE) /
                        epochs[currentEpoch].accumulator
                )
            );
    }

    //amount is in wei here
    //this function can be called anytime by any depositor to deposit funds to pool,
    //but they will not be used till new epoch
    function deposit(uint256 amount) public {
        require(
            baseToken.transferFrom(address(msg.sender), address(this), amount),
            "vault/deposit-failed"
        );

        amount = amount / (10**9);

        syncFarmer(msg.sender);

        Depositor memory depositor;
        depositor = depositors[msg.sender];

        int64 signedAmount = int64(uint64(amount));
        totalWaitingAmount = totalWaitingAmount + signedAmount;
        depositor.waitingAmount = depositor.waitingAmount + signedAmount;

        depositors[msg.sender] = depositor;

        emit FundsDeposited(msg.sender, amount, depositor.lastEpoch);
    }

    //amount is in wei here
    //this function can be called anytime by any depositor to withdraw funds from pool,
    //if funds are in use they will not be withdrawn till another withdraw method in new epoch
    function withdraw(uint256 amount) public {
        Depositor memory depositor = depositors[msg.sender];
        int64 amountInUnits = int64(uint64(amount / WEI_PER_UNIT));
        if (depositor.lastEpoch < currentEpoch) {
            syncFarmer(msg.sender);
            depositor = depositors[msg.sender];
        }
        if (epochs[currentEpoch].totalRepayedAmount > 0) {
            //after epoch settlement, before new epoch
            depositor.normalizedBalance = updateNormalizedBalance(
                depositor,
                -int64(amountInUnits)
            );
            require(
                baseToken.transfer(
                    address(msg.sender),
                    uint256(int256(amountInUnits)) * WEI_PER_UNIT
                ),
                "vault/withdrow-failed"
            );
        } else {
            totalWaitingAmount =
                totalWaitingAmount -
                int64(uint64(amountInUnits));
            if (
                depositor.waitingAmount > int64(uint64(amountInUnits)) &&
                amountInUnits > 0
            ) {
                require(
                    baseToken.transfer(
                        address(msg.sender),
                        uint256(int256(amountInUnits)) * WEI_PER_UNIT
                    ),
                    "vault/withdrow-failed"
                );
                depositor.waitingAmount =
                    depositor.waitingAmount -
                    int64(uint64(amountInUnits));
            } else {
                if (depositor.waitingAmount > 0 && amountInUnits > 0) {
                    require(
                        baseToken.transfer(
                            address(msg.sender),
                            uint256(int256(depositor.waitingAmount)) *
                                WEI_PER_UNIT
                        ),
                        "vault/withdrow-failed"
                    );
                }
                depositor.waitingAmount =
                    depositor.waitingAmount -
                    amountInUnits;
            }
        }

        depositors[msg.sender] = depositor;
    }

    //returnes Farmers balance (in wei) at the begining of this epoch
    function getBalance(address _sender) public view returns (uint256, int256) {
        require(currentEpoch >= 0, "vault/not-started");
        Depositor memory depositor = depositors[_sender];
        uint256 denormalizedAmount = (uint256(depositor.normalizedBalance) *
            epochs[currentEpoch].accumulator) / ACCUMULATOR_ONE;
        return (denormalizedAmount, int256(depositor.waitingAmount));
    }

    //correctnes relies on syncFarmer being invoked in same transaction
    function updateNormalizedBalance(Depositor memory _farmer, int64 amount)
        private
        view
        returns (uint64 normalizedBalance)
    {
        uint256 acc = epochs[currentEpoch].accumulator;
        if (amount < 0) {
            normalizedBalance = uint64(
                _farmer.normalizedBalance -
                    (uint64(-amount) * ACCUMULATOR_ONE) /
                    acc
            );
        } else {
            normalizedBalance = uint64(
                _farmer.normalizedBalance +
                    (uint64(amount) * ACCUMULATOR_ONE) /
                    acc
            );
        }
        return normalizedBalance;
    }

    //this function gets called anytime when collateral is needed to build swap and sel it to MM
    function trustedBorrow(uint256 amount) public {
        require(currentEpoch >= 0, "vault/not-started");
        int32 _currEpoch = currentEpoch;
        require(msg.sender == controller, "vault/caller-not-trusted");
        require(
            _currEpoch >= 0 &&
                block.timestamp >= currentEpochStart &&
                block.timestamp <= currentEpochStart + WEEK_SPAN,
            "vault/invalid-borrow-time"
        );
        require(
            baseToken.transfer(address(msg.sender), amount),
            "vault/trusted-borrow-failed"
        );
        amount = amount / WEI_PER_UNIT;
        require(totalAvailableAmount >= amount, "vault/insufficient-funds");
        totalAvailableAmount = totalAvailableAmount - uint64(amount);
        epochs[_currEpoch].totalLendedAmount =
            epochs[_currEpoch].totalLendedAmount +
            uint64(amount);
    }

    //this method gets called anytime when MM swap gets settled/resolved and there is some collateral left
    //assumption is that premium is added to collateral while swap position is wrapped together
    function trustedRepay(uint256 amount) public {
        require(currentEpoch >= 0, "vault/not-started");
        int32 _currEpoch = currentEpoch;
        require(msg.sender == controller, "vault/caller-not-trusted");
        require(
            baseToken.transferFrom(address(msg.sender), address(this), amount),
            "vault/trusted-borrow-failed"
        );
        amount = amount / WEI_PER_UNIT;
        epochs[_currEpoch].totalRepayedAmount =
            epochs[_currEpoch].totalRepayedAmount +
            uint64(amount);
        totalAvailableAmount = totalAvailableAmount + uint64(amount);
    }

    //this function gets called when all epoch gets settled
    function createNewEpoch() public {
        require(msg.sender == controller, "vault/caller-not-trusted");
        currentEpoch += 1;
        uint256 timespansCount = (block.timestamp - genesisTimestamp) /
            WEEK_SPAN;

        // nearest future friday
        currentEpochStart = genesisTimestamp + WEEK_SPAN * (timespansCount + 1);
        totalAvailableAmount = uint64(
            int64(totalAvailableAmount) + totalWaitingAmount
        );

        //total Waiting amount can be negative if all pending withdrawals exceeds all deposits
        totalWaitingAmount = 0;

        if (totalAvailableAmount > 0) {
            uint256 updatedAvailable = uint256(
                totalAvailableAmount -
                    epochs[currentEpoch - 1].totalLendedAmount +
                    epochs[currentEpoch - 1].totalRepayedAmount
            );

            epochs[currentEpoch].accumulator = uint64(
                (uint256(epochs[currentEpoch - 1].accumulator) *
                    updatedAvailable) / uint256(totalAvailableAmount)
            );
        } else {
            epochs[currentEpoch].accumulator = epochs[currentEpoch - 1]
                .accumulator;
        }
    }

    function initializeDepositor(Depositor memory depositor)
        private
        pure
        returns (Depositor memory)
    {
        if (depositor.exists == false) {
            depositor.exists = true;
            depositor.lastEpoch = -1;
            depositor.normalizedBalance = 0;
        }
        return depositor;
    }

    //this function can be called anytime by any depositor to cancel sheduled withdrawal,
    function clearWaiting() public {
        Depositor memory depositor = depositors[msg.sender];
        require(depositor.waitingAmount < 0, "vault/no-withdraw-request");
        totalWaitingAmount = totalWaitingAmount - depositor.waitingAmount;
        depositor.waitingAmount = 0;
        depositor.lastEpoch = currentEpoch;
        depositors[msg.sender] = depositor;
    }
}
