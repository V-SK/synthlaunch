const { createWalletClient, createPublicClient, http, encodeFunctionData, formatEther } = require('viem');
const { bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

// 读取私钥
const envContent = fs.readFileSync('.env.local', 'utf8');
const privateKey = envContent.match(/DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)/)[1];
const account = privateKeyToAccount(privateKey);

const client = createWalletClient({
  account,
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

const TIMELOCK = '0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D';
const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const TO = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e'; // V收款地址

const custodyAbi = [{
  inputs: [{type: 'address', name: 'to'}],
  name: 'withdrawPlatformFee',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}];

const timelockAbi = [{
  inputs: [
    {type: 'address', name: 'target'},
    {type: 'uint256', name: 'value'},
    {type: 'string', name: 'signature'},
    {type: 'bytes', name: 'data'},
    {type: 'uint256', name: 'eta'}
  ],
  name: 'queueTransaction',
  outputs: [{type: 'bytes32'}],
  stateMutability: 'nonpayable',
  type: 'function'
}];

(async () => {
  console.log('💰 创建 Timelock 提案：提取平台费');
  console.log('收款地址:', TO);
  
  // 先查余额
  const balanceAbi = [{inputs: [], name: 'platformFeeBalance', outputs: [{type: 'uint256'}], stateMutability: 'view', type: 'function'}];
  const balance = await publicClient.readContract({
    address: CUSTODY,
    abi: balanceAbi,
    functionName: 'platformFeeBalance'
  });
  
  console.log('平台费余额:', formatEther(balance), 'BNB');
  
  // 编码 withdrawPlatformFee(address to)
  const data = encodeFunctionData({
    abi: custodyAbi,
    functionName: 'withdrawPlatformFee',
    args: [TO]
  });
  
  // eta = 现在 + 48小时
  const now = Math.floor(Date.now() / 1000);
  const eta = now + 48 * 60 * 60;
  
  console.log('\\n📋 提案参数:');
  console.log('  target:', CUSTODY);
  console.log('  value: 0');
  console.log('  signature: "withdrawPlatformFee(address)"');
  console.log('  data:', data);
  console.log('  eta:', eta, '(' + new Date(eta * 1000).toLocaleString('zh-CN', {timeZone: 'America/New_York'}) + ' EST)');
  
  const hash = await client.writeContract({
    address: TIMELOCK,
    abi: timelockAbi,
    functionName: 'queueTransaction',
    args: [
      CUSTODY,
      0n,
      'withdrawPlatformFee(address)',
      data,
      BigInt(eta)
    ]
  });
  
  console.log('\\n✅ 提案已提交:', hash);
  console.log('🔗 BscScan:', 'https://bscscan.com/tx/' + hash);
  console.log('⏰ 可执行时间:', new Date(eta * 1000).toLocaleString('zh-CN', {timeZone: 'America/New_York'}), 'EST');
  
  console.log('\\n💡 48小时后执行提案命令:');
  console.log('node scripts/timelock-execute-platform-fee.js');
})();
