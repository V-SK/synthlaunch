const { createPublicClient, http, formatEther } = require('viem');
const { bsc } = require('viem/chains');

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

const VAULT_PORTAL = '0x90497450f2a706f1951b5bdda52B4E5d16f34C06';

// VaultPortal ABI - 尝试不同的方法名
const portalABI = [
  {
    inputs: [{type: 'address', name: 'token'}],
    name: 'claimableFees',
    outputs: [{type: 'uint256'}],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{type: 'address', name: 'token'}],
    name: 'accumulatedFees',
    outputs: [{type: 'uint256'}],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{type: 'address', name: 'token'}],
    name: 'fees',
    outputs: [{type: 'uint256'}],
    stateMutability: 'view',
    type: 'function'
  }
];

async function checkTokenFees(tokenAddress) {
  // 尝试多种方法
  const methods = ['claimableFees', 'accumulatedFees', 'fees'];
  
  for (const method of methods) {
    try {
      const fees = await client.readContract({
        address: VAULT_PORTAL,
        abi: portalABI,
        functionName: method,
        args: [tokenAddress]
      });
      if (fees > 0n) {
        return { method, fees: formatEther(fees) };
      }
    } catch (e) {
      // 尝试下一个方法
      continue;
    }
  }
  
  return null;
}

async function main() {
  // 获取token列表
  const response = await fetch('https://synthlaunch.fun/api/tokens');
  const tokens = await response.json();
  
  console.log(`检查 ${tokens.length} 个 token 的税收累积...\n`);
  
  let totalFees = 0n;
  const tokensWithFees = [];
  
  // 只检查前20个作为测试
  const sampleTokens = tokens.slice(0, 20);
  
  for (const token of sampleTokens) {
    const result = await checkTokenFees(token.address);
    if (result) {
      tokensWithFees.push({
        name: token.name,
        symbol: token.symbol,
        address: token.address,
        creator: token.creator,
        fees: result.fees,
        method: result.method
      });
      console.log(`✅ ${token.symbol}: ${result.fees} BNB (creator: ${token.creator.slice(0,10)}...)`);
    } else {
      console.log(`   ${token.symbol}: 0 BNB`);
    }
  }
  
  console.log(`\n找到 ${tokensWithFees.length} 个有税收累积的token`);
  console.log(JSON.stringify(tokensWithFees, null, 2));
}

main().catch(console.error);
