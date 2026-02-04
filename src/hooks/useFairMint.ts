'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, formatEther, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { FAIR_MINT_FACTORY_ADDRESS, FAIR_MINT_FACTORY_ABI, FAIR_MINT_TOKEN_ABI, FAIR_MINT_BLACKLIST } from '@/lib/fairMint';

export interface FairMintTokenData {
  address: Address;
  name: string;
  symbol: string;
  creator: Address;
  beneficiary: Address;
  mintPrice: bigint;
  mintPriceBnb: number;
  perWalletLimit: bigint;
  perWalletLimitTokens: number;
  mintableSupply: bigint;
  lpSupply: bigint;
  totalSupply: bigint;
  totalSupplyTokens: number;
  startTime: number;
  endTime: number;
  agentOnly: boolean;
  mintFeeRate: number;
  totalMinted: bigint;
  totalMintedTokens: number;
  finalized: boolean;
  lpPair: Address | null;
  emergencyMode: boolean;
  // Computed
  progress: number;
  remaining: bigint;
  remainingTokens: number;
  isSoldOut: boolean;
  isEnded: boolean;
  isActive: boolean;
  canFinalize: boolean;
  lpRatioBps: number;
}

export function useFairMintFactory() {
  const publicClient = usePublicClient({ chainId: bsc.id });
  const [tokens, setTokens] = useState<FairMintTokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!publicClient) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get total tokens count
      const totalTokens = await publicClient.readContract({
        address: FAIR_MINT_FACTORY_ADDRESS,
        abi: [{ name: 'totalTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
        functionName: 'totalTokens',
      }) as bigint;

      if (totalTokens === 0n) {
        setTokens([]);
        setLoading(false);
        return;
      }

      // Get all token addresses
      const tokenAddresses = await publicClient.readContract({
        address: FAIR_MINT_FACTORY_ADDRESS,
        abi: [{ name: 'getTokens', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [{ type: 'address[]' }] }],
        functionName: 'getTokens',
        args: [0n, totalTokens],
      }) as Address[];

      // Filter out blacklisted and zero addresses
      const filteredAddresses = tokenAddresses.filter(
        addr => addr !== '0x0000000000000000000000000000000000000000' && 
                !FAIR_MINT_BLACKLIST.includes(addr.toLowerCase())
      );

      if (filteredAddresses.length === 0) {
        setTokens([]);
        setLoading(false);
        return;
      }

      // Fetch data for each token
      const tokenDataPromises = filteredAddresses.map(async (addr) => {
        try {
          const [
            name, symbol, creator, beneficiary, mintPrice, perWalletLimit,
            mintableSupply, lpSupply, startTime, endTime, agentOnly, mintFeeRate,
            totalMinted, finalized, lpPair, emergencyMode, canFinalizeResult
          ] = await Promise.all([
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'name' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'symbol' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'creator' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'beneficiary' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'mintPrice' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'perWalletLimit' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'mintableSupply' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'lpSupply' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'startTime' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'endTime' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'agentOnly' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'mintFeeRate' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'totalMinted' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'finalized' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'lpPair' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'emergencyMode' }),
            publicClient.readContract({ address: addr, abi: FAIR_MINT_TOKEN_ABI, functionName: 'canFinalize' }),
          ]);

          const totalSupply = (mintableSupply as bigint) + (lpSupply as bigint);
          const now = Math.floor(Date.now() / 1000);
          const isSoldOut = (totalMinted as bigint) >= (mintableSupply as bigint);
          const isEnded = now > Number(endTime);
          const progress = Number(mintableSupply) > 0 
            ? Number(totalMinted as bigint) / Number(mintableSupply as bigint) 
            : 0;

          return {
            address: addr,
            name: name as string,
            symbol: symbol as string,
            creator: creator as Address,
            beneficiary: beneficiary as Address,
            mintPrice: mintPrice as bigint,
            mintPriceBnb: Number(formatEther(mintPrice as bigint)),
            perWalletLimit: perWalletLimit as bigint,
            perWalletLimitTokens: Number(formatEther(perWalletLimit as bigint)),
            mintableSupply: mintableSupply as bigint,
            lpSupply: lpSupply as bigint,
            totalSupply,
            totalSupplyTokens: Number(formatEther(totalSupply)),
            startTime: Number(startTime),
            endTime: Number(endTime),
            agentOnly: agentOnly as boolean,
            mintFeeRate: Number(mintFeeRate) / 100,
            totalMinted: totalMinted as bigint,
            totalMintedTokens: Number(formatEther(totalMinted as bigint)),
            finalized: finalized as boolean,
            lpPair: (lpPair as Address) === '0x0000000000000000000000000000000000000000' ? null : lpPair as Address,
            emergencyMode: emergencyMode as boolean,
            progress,
            remaining: (mintableSupply as bigint) - (totalMinted as bigint),
            remainingTokens: Number(formatEther((mintableSupply as bigint) - (totalMinted as bigint))),
            isSoldOut,
            isEnded,
            isActive: !isSoldOut && !isEnded && !(finalized as boolean),
            canFinalize: canFinalizeResult as boolean,
            lpRatioBps: Number(lpSupply as bigint) * 10000 / Number(totalSupply),
          } as FairMintTokenData;
        } catch (e) {
          console.error(`Failed to fetch token ${addr}:`, e);
          return null;
        }
      });

      const tokenData = (await Promise.all(tokenDataPromises)).filter(Boolean) as FairMintTokenData[];
      setTokens(tokenData);
    } catch (e) {
      console.error('Failed to fetch FairMint tokens:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return { tokens, loading, error, refetch: fetchTokens };
}

export function useFairMintToken(tokenAddress: Address | undefined) {
  const publicClient = usePublicClient({ chainId: bsc.id });
  const { address: userAddress } = useAccount();
  const [token, setToken] = useState<FairMintTokenData | null>(null);
  const [userMinted, setUserMinted] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    if (!publicClient || !tokenAddress) return;
    
    // Check if token is blacklisted or zero address
    if (tokenAddress === '0x0000000000000000000000000000000000000000' ||
        FAIR_MINT_BLACKLIST.includes(tokenAddress.toLowerCase())) {
      setError('Token not found');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const [
        name, symbol, creator, beneficiary, mintPrice, perWalletLimit,
        mintableSupply, lpSupply, startTime, endTime, agentOnly, mintFeeRate,
        totalMinted, finalized, lpPair, emergencyMode, canFinalizeResult
      ] = await Promise.all([
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'name' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'creator' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'beneficiary' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'mintPrice' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'perWalletLimit' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'mintableSupply' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'lpSupply' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'startTime' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'endTime' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'agentOnly' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'mintFeeRate' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'totalMinted' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'finalized' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'lpPair' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'emergencyMode' }),
        publicClient.readContract({ address: tokenAddress, abi: FAIR_MINT_TOKEN_ABI, functionName: 'canFinalize' }),
      ]);

      // Fetch user minted amount if connected
      let userMintedAmount = 0n;
      if (userAddress) {
        userMintedAmount = await publicClient.readContract({
          address: tokenAddress,
          abi: FAIR_MINT_TOKEN_ABI,
          functionName: 'mintedBy',
          args: [userAddress],
        }) as bigint;
        setUserMinted(userMintedAmount);
      }

      const totalSupply = (mintableSupply as bigint) + (lpSupply as bigint);
      const now = Math.floor(Date.now() / 1000);
      const isSoldOut = (totalMinted as bigint) >= (mintableSupply as bigint);
      const isEnded = now > Number(endTime);
      const progress = Number(mintableSupply) > 0 
        ? Number(totalMinted as bigint) / Number(mintableSupply as bigint) 
        : 0;

      setToken({
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        creator: creator as Address,
        beneficiary: beneficiary as Address,
        mintPrice: mintPrice as bigint,
        mintPriceBnb: Number(formatEther(mintPrice as bigint)),
        perWalletLimit: perWalletLimit as bigint,
        perWalletLimitTokens: Number(formatEther(perWalletLimit as bigint)),
        mintableSupply: mintableSupply as bigint,
        lpSupply: lpSupply as bigint,
        totalSupply,
        totalSupplyTokens: Number(formatEther(totalSupply)),
        startTime: Number(startTime),
        endTime: Number(endTime),
        agentOnly: agentOnly as boolean,
        mintFeeRate: Number(mintFeeRate) / 100,
        totalMinted: totalMinted as bigint,
        totalMintedTokens: Number(formatEther(totalMinted as bigint)),
        finalized: finalized as boolean,
        lpPair: (lpPair as Address) === '0x0000000000000000000000000000000000000000' ? null : lpPair as Address,
        emergencyMode: emergencyMode as boolean,
        progress,
        remaining: (mintableSupply as bigint) - (totalMinted as bigint),
        remainingTokens: Number(formatEther((mintableSupply as bigint) - (totalMinted as bigint))),
        isSoldOut,
        isEnded,
        isActive: !isSoldOut && !isEnded && !(finalized as boolean),
        canFinalize: canFinalizeResult as boolean,
        lpRatioBps: Number(lpSupply as bigint) * 10000 / Number(totalSupply),
      });
    } catch (e) {
      console.error('Failed to fetch token:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch token');
    } finally {
      setLoading(false);
    }
  }, [publicClient, tokenAddress, userAddress]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return { token, userMinted, loading, error, refetch: fetchToken };
}

export function useMint(tokenAddress: Address | undefined) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: bsc.id });
  const [isPending, setIsPending] = useState(false);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(async (amountTokens: number) => {
    if (!walletClient || !publicClient || !tokenAddress) {
      setError('Wallet not connected');
      return;
    }

    setIsPending(true);
    setError(null);
    setHash(null);

    try {
      // Convert tokens to wei
      const amountWei = parseEther(amountTokens.toString());
      
      // Get mint cost
      const cost = await publicClient.readContract({
        address: tokenAddress,
        abi: FAIR_MINT_TOKEN_ABI,
        functionName: 'mintCost',
        args: [amountWei],
      }) as bigint;

      // Send mint transaction
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: FAIR_MINT_TOKEN_ABI,
        functionName: 'mint',
        args: [amountWei],
        value: cost,
      });

      setHash(txHash);
      
      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    } catch (e) {
      console.error('Mint failed:', e);
      setError(e instanceof Error ? e.message : 'Mint failed');
    } finally {
      setIsPending(false);
    }
  }, [walletClient, publicClient, tokenAddress]);

  return { mint, isPending, hash, error };
}

export function useFinalize(tokenAddress: Address | undefined) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: bsc.id });
  const [isPending, setIsPending] = useState(false);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finalize = useCallback(async () => {
    if (!walletClient || !publicClient || !tokenAddress) {
      setError('Wallet not connected');
      return;
    }

    setIsPending(true);
    setError(null);
    setHash(null);

    try {
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: FAIR_MINT_TOKEN_ABI,
        functionName: 'finalize',
      });

      setHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    } catch (e) {
      console.error('Finalize failed:', e);
      setError(e instanceof Error ? e.message : 'Finalize failed');
    } finally {
      setIsPending(false);
    }
  }, [walletClient, publicClient, tokenAddress]);

  return { finalize, isPending, hash, error };
}

export interface CreateFairMintParams {
  name: string;
  symbol: string;
  totalSupply: number;      // whole tokens (not wei)
  mintPrice: string;        // BNB per token as string
  perWalletLimit: number;   // whole tokens
  lpRatioBps: number;       // e.g., 2000 = 20%
  duration: number;         // seconds
  beneficiary: Address;
  agentOnly: boolean;
}

export function useCreateFairMint() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: bsc.id });
  const [isPending, setIsPending] = useState(false);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (params: CreateFairMintParams) => {
    if (!walletClient || !publicClient) {
      setError('Wallet not connected');
      return null;
    }

    setIsPending(true);
    setError(null);
    setHash(null);
    setTokenAddress(null);

    try {
      // Get creation fee from factory
      const creationFee = await publicClient.readContract({
        address: FAIR_MINT_FACTORY_ADDRESS,
        abi: FAIR_MINT_FACTORY_ABI,
        functionName: 'creationFee',
      }) as bigint;

      // Convert mint price to wei (price per whole token)
      const mintPriceWei = parseEther(params.mintPrice);

      // Prepare create params tuple
      const createParams = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: BigInt(params.totalSupply),
        mintPrice: mintPriceWei,
        perWalletLimit: BigInt(params.perWalletLimit),
        lpRatioBps: BigInt(params.lpRatioBps),
        duration: BigInt(params.duration),
        beneficiary: params.beneficiary,
        agentOnly: params.agentOnly,
      };

      // Send create transaction
      const txHash = await walletClient.writeContract({
        address: FAIR_MINT_FACTORY_ADDRESS,
        abi: FAIR_MINT_FACTORY_ABI,
        functionName: 'createToken',
        args: [createParams],
        value: creationFee,
      });

      setHash(txHash);
      
      // Wait for confirmation and get the token address from logs
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      // Parse TokenCreated event to get the new token address
      // Event signature: TokenCreated(address indexed token, address indexed creator, ...)
      const tokenCreatedLog = receipt.logs.find(log => 
        log.topics[0] === '0x' + 'TokenCreated(address,address,string,string,uint256,uint256,bool)'
      );
      
      if (receipt.logs.length > 0) {
        // The first indexed param (token address) is in topics[1]
        const newTokenAddr = ('0x' + receipt.logs[0].topics[1]?.slice(26)) as Address;
        setTokenAddress(newTokenAddr);
        return newTokenAddr;
      }

      return null;
    } catch (e) {
      console.error('Create FairMint failed:', e);
      setError(e instanceof Error ? e.message : 'Create failed');
      return null;
    } finally {
      setIsPending(false);
    }
  }, [walletClient, publicClient]);

  const reset = useCallback(() => {
    setHash(null);
    setTokenAddress(null);
    setError(null);
  }, []);

  return { create, isPending, hash, tokenAddress, error, reset };
}
