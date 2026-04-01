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
const TO = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';

// 从queue脚本输出的eta（手动更新）
const ETA = 1775187297; // 2026/4/2 23:34:57 EST

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
  name: 'executeTransaction',
  outputs: [{type: 'bytes'}],
  stateMutability: 'nonpayable',
  type: 'function'
}];

(async () => {
  console.log('⚙️ 执行 Timelock 提案：提取平台费');
  console.log('收款地址:', TO);
  
  const now = Math.floor(Date.now() / 1000);
  if (now < ETA) {
    const wait = ETA - now;
    console.log('\\n❌ 提案尚未到执行时间');
    console.log('  当前时间:', new Date(now * 1000).toLocaleString('zh-CN', {timeZone: 'America/New_York'}), 'EST');
    console.log('  执行时间:', new Date(ETA * 1000).toLocaleString('zh-CN', {timeZone: 'America/New_York'}), 'EST');
    console.log('  还需等待:', Math.floor(wait / 3600), '小时', Math.floor((wait % 3600) / 60), '分钟');
    return;
  }
  
  // 先查余额
  const balanceAbi = [{inputs: [], name: 'platformFeeBalance', outputs: [{type: 'uint256'}], stateMutability: 'view', type: 'function'}];
  const balance = await publicClient.readContract({
    address: CUSTODY,
    abi: balanceAbi,
    functionName: 'platformFeeBalance'
  });
  
  console.log('平台费余额:', formatEther(balance), 'BNB');
  
  // 编码数据（必须与queue时一致）
  // 正确格式：只有 address 参数，不含 function selector
  // （Timelock 执行时会自己拼 selector，不能重复）
  const { encodeAbiParameters, parseAbiParameters } = require('viem');
  const data = encodeAbiParameters(parseAbiParameters('address'), [TO]);
  
  console.log('\\n📋 执行参数:');
  console.log('  target:', CUSTODY);
  console.log('  value: 0');
  console.log('  signature: "withdrawPlatformFee(address)"');
  console.log('  data:', data);
  console.log('  eta:', ETA);
  
  const hash = await client.writeContract({
    address: TIMELOCK,
    abi: timelockAbi,
    functionName: 'executeTransaction',
    args: [
      CUSTODY,
      0n,
      'withdrawPlatformFee(address)',
      data,
      BigInt(ETA)
    ]
  });
  
  console.log('\\n✅ 执行交易已提交:', hash);
  console.log('🔗 BscScan:', 'https://bscscan.com/tx/' + hash);
  console.log('⏳ 等待确认...');
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (receipt.status === 'success') {
    console.log('\\n✅ 提取成功！');
    console.log('💰 已提取:', formatEther(balance), 'BNB 到', TO);
  } else {
    console.log('\\n❌ 执行失败');
  }
})();
