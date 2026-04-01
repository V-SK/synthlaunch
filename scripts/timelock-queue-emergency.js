const { createWalletClient, createPublicClient, http, encodeFunctionData, formatEther } = require('viem');
const { bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const privateKey = envContent.match(/DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)/)[1];
const account = privateKeyToAccount(privateKey);

const client = createWalletClient({ account, chain: bsc, transport: http('https://bsc-dataseed.binance.org/') });
const publicClient = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org/') });

const TIMELOCK = '0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D';
const CUSTODY  = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const TO       = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';

const custodyAbi = [{
  inputs: [{type: 'address', name: 'to'}],
  name: 'emergencyWithdraw',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}];

const timelockAbi = [{
  inputs: [
    {type: 'address', name: 'target'},
    {type: 'uint256', name: 'value'},
    {type: 'string',  name: 'signature'},
    {type: 'bytes',   name: 'data'},
    {type: 'uint256', name: 'eta'}
  ],
  name: 'queueTransaction',
  outputs: [{type: 'bytes32'}],
  stateMutability: 'nonpayable',
  type: 'function'
}];

(async () => {
  console.log('🚨 创建 Timelock 提案：emergencyWithdraw');
  console.log('收款地址:', TO);

  // 查 excess
  const balAbi = [
    {inputs: [], name: 'platformFeeBalance',  outputs: [{type:'uint256'}], stateMutability: 'view', type: 'function'},
    {inputs: [], name: 'totalClaimedAmount',  outputs: [{type:'uint256'}], stateMutability: 'view', type: 'function'},
    {inputs: [], name: 'totalRecorded',       outputs: [{type:'uint256'}], stateMutability: 'view', type: 'function'},
  ];
  const bal      = await publicClient.getBalance({ address: CUSTODY });
  const pf       = await publicClient.readContract({ address: CUSTODY, abi: balAbi, functionName: 'platformFeeBalance' });
  const claimed  = await publicClient.readContract({ address: CUSTODY, abi: balAbi, functionName: 'totalClaimedAmount' });
  const recorded = await publicClient.readContract({ address: CUSTODY, abi: balAbi, functionName: 'totalRecorded' });
  const unclaimed = recorded - claimed;
  const accounted = pf + unclaimed;
  const excess    = bal > accounted ? bal - accounted : 0n;
  console.log('excess (孤儿资金):', formatEther(excess), 'BNB');

  if (excess === 0n) { console.log('❌ 没有可提取的孤儿资金'); return; }

  const { encodeAbiParameters, parseAbiParameters } = require('viem');
  const data = encodeAbiParameters(parseAbiParameters('address'), [TO]);

  const now = Math.floor(Date.now() / 1000);
  const eta = now + 48 * 60 * 60;

  console.log('\n📋 提案参数:');
  console.log('  target:', CUSTODY);
  console.log('  signature: "emergencyWithdraw(address)"');
  console.log('  eta:', eta, '(' + new Date(eta * 1000).toLocaleString('zh-CN', {timeZone: 'America/New_York'}) + ' EST)');

  const hash = await client.writeContract({
    address: TIMELOCK,
    abi: timelockAbi,
    functionName: 'queueTransaction',
    args: [CUSTODY, 0n, 'emergencyWithdraw(address)', data, BigInt(eta)]
  });

  console.log('\n✅ 提案已提交:', hash);
  console.log('🔗 BscScan:', 'https://bscscan.com/tx/' + hash);
  console.log('⏰ 可执行时间:', new Date(eta * 1000).toLocaleString('zh-CN', {timeZone: 'America/New_York'}), 'EST');
  console.log('\n记下 ETA:', eta, '(填入 execute 脚本)');
})();
