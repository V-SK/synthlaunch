// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClaimWrapper
 * @notice Wrapper for claiming fees from SynthLaunch Custody
 * @dev Requires payment in $SYNTH to claim fees (flywheel mechanism)
 * @dev Dynamically calculates SYNTH amount based on USD value from Flap bonding curve
 */
contract ClaimWrapper is Ownable {
    // $SYNTH token on BSC
    IERC20 public immutable synthToken;
    
    // Flap Portal to get SYNTH price from bonding curve
    IFlapPortal public immutable flapPortal;
    
    // Treasury address to receive SYNTH payments
    address public treasury;
    
    // Custody contract interface
    ICustody public immutable custody;
    
    // Required USD value (18 decimals, e.g., 10e18 = $10)
    uint256 public requiredUsdValue = 10 * 1e18; // $10 USD
    
    // Minimum fee threshold to require SYNTH payment (in BNB wei)
    uint256 public minFeeThreshold = 0.01 ether; // 0.01 BNB
    
    // BNB price in USD (18 decimals) - updated by owner or oracle
    uint256 public bnbPriceUsd = 700 * 1e18; // $700 default
    
    // Constants
    uint256 private constant BILLION = 1e9;
    uint256 private constant PRECISION = 1e18;
    
    event Claimed(address indexed user, address indexed token, uint256 synthPaid, uint256 usdValue);
    event RequiredUsdUpdated(uint256 oldValue, uint256 newValue);
    event BnbPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event MinFeeThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(
        address _synthToken,
        address _flapPortal,
        address _custody,
        address _treasury
    ) Ownable(msg.sender) {
        synthToken = IERC20(_synthToken);
        flapPortal = IFlapPortal(_flapPortal);
        custody = ICustody(_custody);
        treasury = _treasury;
    }

    /**
     * @notice Get required SYNTH amount based on current price
     * @return synthAmount Amount of SYNTH needed for requiredUsdValue
     */
    function getRequiredSynthAmount() public view returns (uint256 synthAmount) {
        // Get SYNTH price from Flap bonding curve
        uint256 synthPriceUsd = getSynthPriceUsd();
        
        if (synthPriceUsd == 0) {
            // Fallback: return a high amount to prevent claims if price unavailable
            return type(uint256).max;
        }
        
        // Calculate: requiredUsdValue / synthPriceUsd
        // Both have 18 decimals, result needs 18 decimals
        synthAmount = (requiredUsdValue * PRECISION) / synthPriceUsd;
    }
    
    /**
     * @notice Get SYNTH price in USD from Flap bonding curve
     * @return priceUsd Price in USD with 18 decimals
     */
    function getSynthPriceUsd() public view returns (uint256 priceUsd) {
        try flapPortal.getTokenV5(address(synthToken)) returns (IFlapPortal.TokenInfo memory info) {
            // info.r is reserve in BNB (wei)
            // info.h is virtual supply offset
            // Price = reserve / (1B - circulatingSupply + h)
            
            uint256 r = info.r;
            uint256 h = info.h;
            
            // Get current supply
            uint256 totalSupply = synthToken.totalSupply();
            uint256 circulatingSupply = totalSupply > BILLION * 1e18 ? 0 : (BILLION * 1e18 - totalSupply) / 1e18;
            
            // Price in BNB = r / (1B + h - circulatingSupply)
            uint256 denom = BILLION + h - circulatingSupply;
            if (denom == 0 || r == 0) return 0;
            
            uint256 priceInBnb = (r * PRECISION) / (denom * 1e9); // Convert to 18 decimals
            
            // Convert to USD
            priceUsd = (priceInBnb * bnbPriceUsd) / PRECISION;
        } catch {
            return 0;
        }
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
            
            require(synthToPay < type(uint256).max, "Price unavailable");
            
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
     * @return synthPriceUsd Current SYNTH price in USD
     */
    function getRequirementInfo() external view returns (
        uint256 usdValue,
        uint256 synthAmount,
        uint256 synthPriceUsd
    ) {
        usdValue = requiredUsdValue;
        synthPriceUsd = getSynthPriceUsd();
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
     * @notice Update BNB price in USD
     * @param newPrice New price (18 decimals, e.g., 700e18 = $700)
     */
    function setBnbPriceUsd(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        emit BnbPriceUpdated(bnbPriceUsd, newPrice);
        bnbPriceUsd = newPrice;
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
 * @notice Interface for Flap Portal
 */
interface IFlapPortal {
    struct TokenInfo {
        uint8 status;
        uint256 r;      // reserve in BNB
        uint256 h;      // virtual supply offset
        uint256 k;      // constant product
        uint8 dexThresh;
        uint256 dexSupplyThreshold;
        uint256 taxRate;
        uint256 migratorType;
        uint256 createdAt;
        address beneficiary;
        bool hasTax;
        bytes32 meta;
    }
    
    function getTokenV5(address token) external view returns (TokenInfo memory);
}
