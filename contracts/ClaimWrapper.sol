// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClaimWrapper
 * @notice Wrapper for claiming fees from SynthLaunch Custody
 * @dev Requires payment in $SYNTH to claim fees (flywheel mechanism)
 * @dev Uses Chainlink for BNB/USD price, calculates $10 USD worth of SYNTH
 */
contract ClaimWrapper is Ownable {
    // $SYNTH token on BSC
    IERC20 public immutable synthToken;
    
    // Chainlink BNB/USD price feed
    IChainlinkFeed public immutable bnbPriceFeed;
    
    // Treasury address to receive SYNTH payments
    address public treasury;
    
    // Custody contract interface
    ICustody public immutable custody;
    
    // Required USD value (18 decimals, e.g., 10e18 = $10)
    uint256 public requiredUsdValue = 10 * 1e18; // $10 USD
    
    // SYNTH price in USD (18 decimals) - owner can update
    // Default based on current price ~$0.00027
    uint256 public synthPriceUsd = 270000000000000; // $0.00027 (18 decimals)
    
    // Minimum fee threshold to require SYNTH payment (in BNB wei)
    uint256 public minFeeThreshold = 0.01 ether; // 0.01 BNB
    
    // Constants
    uint256 private constant PRECISION = 1e18;
    
    event Claimed(address indexed user, address indexed token, uint256 synthPaid, uint256 usdValue);
    event RequiredUsdUpdated(uint256 oldValue, uint256 newValue);
    event SynthPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event MinFeeThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(
        address _synthToken,
        address _bnbPriceFeed,
        address _custody,
        address _treasury
    ) Ownable(msg.sender) {
        synthToken = IERC20(_synthToken);
        bnbPriceFeed = IChainlinkFeed(_bnbPriceFeed);
        custody = ICustody(_custody);
        treasury = _treasury;
    }

    /**
     * @notice Get BNB price in USD from Chainlink (18 decimals)
     * @return priceUsd BNB price in USD with 18 decimals
     */
    function getBnbPriceUsd() public view returns (uint256 priceUsd) {
        try bnbPriceFeed.latestRoundData() returns (
            uint80,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            // Chainlink returns 8 decimals, convert to 18
            if (answer > 0 && block.timestamp - updatedAt < 1 hours) {
                priceUsd = uint256(answer) * 1e10; // 8 -> 18 decimals
            } else {
                // Fallback price if stale
                priceUsd = 650 * 1e18; // $650 fallback
            }
        } catch {
            priceUsd = 650 * 1e18; // $650 fallback
        }
    }

    /**
     * @notice Get required SYNTH amount based on current price
     * @return synthAmount Amount of SYNTH needed for requiredUsdValue
     */
    function getRequiredSynthAmount() public view returns (uint256 synthAmount) {
        if (synthPriceUsd == 0) {
            return type(uint256).max;
        }
        
        // Calculate: requiredUsdValue / synthPriceUsd
        // Both have 18 decimals, result needs 18 decimals
        synthAmount = (requiredUsdValue * PRECISION) / synthPriceUsd;
    }

    /**
     * @notice Claim fees for a token, paying SYNTH fee
     * @param token The token address to claim fees for
     */
    function claim(address token) external {
        // Check claimable amount first
        uint256 claimable = custody.claimable(token);
        
        // Only require SYNTH payment if claimable amount exceeds threshold
        uint256 synthToPay = 0;
        if (claimable >= minFeeThreshold) {
            synthToPay = getRequiredSynthAmount();
            
            require(synthToPay < type(uint256).max, "Price not set");
            
            // Check user has enough SYNTH
            require(
                synthToken.balanceOf(msg.sender) >= synthToPay,
                "Insufficient SYNTH balance"
            );
            
            // Check allowance
            require(
                synthToken.allowance(msg.sender, address(this)) >= synthToPay,
                "Approve SYNTH first"
            );
            
            // Transfer SYNTH to treasury
            require(
                synthToken.transferFrom(msg.sender, treasury, synthToPay),
                "SYNTH transfer failed"
            );
        }
        
        // Call custody claim (will transfer to the bound wallet)
        custody.claim(token);
        
        emit Claimed(msg.sender, token, synthToPay, requiredUsdValue);
    }
    
    /**
     * @notice Check if user can claim (has enough SYNTH)
     * @param user The user address
     * @param token The token to check claimable for
     * @return eligible Whether user can claim
     * @return synthRequired Amount of SYNTH required
     * @return claimableAmount Amount of BNB claimable
     */
    function canClaim(address user, address token) external view returns (
        bool eligible,
        uint256 synthRequired,
        uint256 claimableAmount
    ) {
        claimableAmount = custody.claimable(token);
        
        if (claimableAmount < minFeeThreshold) {
            // Small claim, no SYNTH required
            return (true, 0, claimableAmount);
        }
        
        synthRequired = getRequiredSynthAmount();
        if (synthRequired == type(uint256).max) {
            return (false, 0, claimableAmount);
        }
        
        uint256 balance = synthToken.balanceOf(user);
        uint256 allowance = synthToken.allowance(user, address(this));
        
        eligible = balance >= synthRequired && allowance >= synthRequired;
    }
    
    /**
     * @notice Get current SYNTH requirement info
     * @return usdValue Required USD value
     * @return synthAmount Current SYNTH amount needed
     * @return currentSynthPrice Current SYNTH price in USD
     * @return bnbPrice Current BNB price in USD
     */
    function getRequirementInfo() external view returns (
        uint256 usdValue,
        uint256 synthAmount,
        uint256 currentSynthPrice,
        uint256 bnbPrice
    ) {
        usdValue = requiredUsdValue;
        currentSynthPrice = synthPriceUsd;
        bnbPrice = getBnbPriceUsd();
        synthAmount = getRequiredSynthAmount();
    }
    
    // --- Admin functions ---
    
    /**
     * @notice Update required USD value
     * @param newValue New USD value (18 decimals, e.g., 10e18 = $10)
     */
    function setRequiredUsdValue(uint256 newValue) external onlyOwner {
        emit RequiredUsdUpdated(requiredUsdValue, newValue);
        requiredUsdValue = newValue;
    }
    
    /**
     * @notice Update SYNTH price in USD
     * @param newPrice New price (18 decimals, e.g., 270000000000000 = $0.00027)
     */
    function setSynthPriceUsd(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        emit SynthPriceUpdated(synthPriceUsd, newPrice);
        synthPriceUsd = newPrice;
    }
    
    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
    
    /**
     * @notice Update minimum fee threshold
     * @param newThreshold New threshold in BNB wei
     */
    function setMinFeeThreshold(uint256 newThreshold) external onlyOwner {
        emit MinFeeThresholdUpdated(minFeeThreshold, newThreshold);
        minFeeThreshold = newThreshold;
    }
}

/**
 * @notice Interface for SynthLaunch Custody contract
 */
interface ICustody {
    function claim(address token) external;
    function claimable(address token) external view returns (uint256);
}

/**
 * @notice Interface for Chainlink Price Feed
 */
interface IChainlinkFeed {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
