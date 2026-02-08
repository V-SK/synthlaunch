// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClaimWrapper
 * @notice Wrapper for claiming fees from SynthLaunch Custody
 * @dev Requires payment in $SYNTH to claim fees (flywheel mechanism)
 */
contract ClaimWrapper is Ownable {
    // $SYNTH token on BSC
    IERC20 public immutable synthToken;
    
    // Treasury address to receive SYNTH payments
    address public treasury;
    
    // Custody contract interface
    ICustody public immutable custody;
    
    // Required SYNTH amount to claim (in wei, 18 decimals)
    // Default: ~$10 worth at launch price
    uint256 public requiredSynthAmount = 50_000 * 1e18; // 50,000 SYNTH
    
    // Minimum fee threshold to require SYNTH payment (in BNB wei)
    // Small claims below this don't require SYNTH payment
    uint256 public minFeeThreshold = 0.01 ether; // 0.01 BNB (~$6)
    
    event Claimed(address indexed user, address indexed token, uint256 synthPaid);
    event RequiredAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event MinFeeThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(
        address _synthToken,
        address _custody,
        address _treasury
    ) Ownable(msg.sender) {
        synthToken = IERC20(_synthToken);
        custody = ICustody(_custody);
        treasury = _treasury;
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
            synthToPay = requiredSynthAmount;
            
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
        
        emit Claimed(msg.sender, token, synthToPay);
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
        
        synthRequired = requiredSynthAmount;
        uint256 balance = synthToken.balanceOf(user);
        uint256 allowance = synthToken.allowance(user, address(this));
        
        eligible = balance >= synthRequired && allowance >= synthRequired;
    }
    
    // --- Admin functions ---
    
    /**
     * @notice Update required SYNTH amount
     * @param newAmount New amount in wei (18 decimals)
     */
    function setRequiredSynthAmount(uint256 newAmount) external onlyOwner {
        emit RequiredAmountUpdated(requiredSynthAmount, newAmount);
        requiredSynthAmount = newAmount;
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
