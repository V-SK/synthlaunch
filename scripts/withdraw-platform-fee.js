const { createWalletClient, http, formatEther, parseEther } = require('viem');
const { bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

// 读取私钥
const envContent = fs.readFileSync('.env.local', 'utf8');
const privateKeyMatch = envContent.match(/DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)/);
if (!privateKeyMatch) {
  throw new Error('DEPLOYER_PRIVATE_KEY not found in .env.local');
}
const privateKey = privateKeyMatch[1];

const account = privateKeyToAccount(privateKey);
const client = createWalletClient({
  account,
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org/')
});

const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const TO = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e'; // V的收款地址

const abi = [{
  inputs: [{type: 'address', name: 'to'}],
  name: 'withdrawPlatformFee',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}];

(async () => {
  console.log('💰 提取 Custody 平台费...');
  console.log('收款地址:', TO);
  
  // 先查余额
  const { createPublicClient } = require('viem');
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http('https://bsc-dataseed.binance.org/')
  });
  
  const readAbi = [{inputs: [], name: 'platformFeeBalance', outputs: [{type: 'uint256'}], stateMutability: 'view', type: 'function'}];
  const balance = await publicClient.readContract({
    address: CUSTODY,
    abi: readAbi,
    functionName: 'platformFeeBalance'
  });
  
  console.log('平台费余额:', formatEther(balance), 'BNB');
  
  if (balance === 0n) {
    console.log('❌ 平台费余额为0，无需提取');
    return;
  }
  
  // 执行提取
  const hash = await client.writeContract({
    address: CUSTODY,
    abi,
    functionName: 'withdrawPlatformFee',
    args: [TO]
  });
  
  console.log('✅ 交易已提交:', hash);
  console.log('🔗 BscScan:', 'https://bscscan.com/tx/' + hash);
  console.log('⏳ 等待确认...');
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (receipt.status === 'success') {
    console.log('✅ 提取成功！');
    console.log('提取金额:', formatEther(balance), 'BNB');
  } else {
    console.log('❌ 交易失败');
  }
})();
