const { createWalletClient, createPublicClient, http, formatEther } = require('viem');
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

// ⚠️ 从 queue 脚本输出的 ETA 填这里
const ETA = 1775187357; // 2026/4/2 23:35:57 EST

const timelockAbi = [{
  inputs: [
    {type: 'address', name: 'target'},
    {type: 'uint256', name: 'value'},
    {type: 'string',  name: 'signature'},
    {type: 'bytes',   name: 'data'},
    {type: 'uint256', name: 'eta'}
  ],
  name: 'executeTransaction',
  outputs: [{type: 'bytes'}],
  stateMutability: 'nonpayable',
  type: 'function'
}];

(async () => {
  if (ETA === 0) { console.log('❌ 先填 ETA！从 queue 脚本输出里复制'); return; }

  const now = Math.floor(Date.now() / 1000);
  if (now < ETA) {
    const wait = ETA - now;
    console.log('❌ 还没到执行时间，还需等待:', Math.floor(wait/3600), '小时', Math.floor((wait%3600)/60), '分钟');
    return;
  }

  const { encodeAbiParameters, parseAbiParameters } = require('viem');
  const data = encodeAbiParameters(parseAbiParameters('address'), [TO]);

  console.log('⚙️ 执行 emergencyWithdraw...');
  const hash = await client.writeContract({
    address: TIMELOCK,
    abi: timelockAbi,
    functionName: 'executeTransaction',
    args: [CUSTODY, 0n, 'emergencyWithdraw(address)', data, BigInt(ETA)]
  });

  console.log('tx:', hash);
  console.log('BscScan: https://bscscan.com/tx/' + hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'success') {
    console.log('✅ 成功！');
  } else {
    console.log('❌ 失败');
  }
})();
