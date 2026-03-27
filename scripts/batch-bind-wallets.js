// 批量绑定钱包脚本 - 使用 AWS KMS 签名
// 使用: AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx PRIVATE_KEY=xxx node scripts/batch-bind-wallets.js

const { ethers } = require('ethers');
const { KMSClient, SignCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const CHAIN_ID = 56;
const V_WALLET = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';

const KMS_KEY_ID = 'arn:aws:kms:us-east-2:696154297091:key/34075bad-0aa0-4e8f-a23b-fae95373d327';

const CUSTODY_ABI = [
  'function agentWallet(string) view returns (address)',
  'function bindWallet(string agentName, address wallet, bytes32 nonce, bytes signature) external',
  'function signer() view returns (address)'
];

// 需要绑定的 agents (有税收但未绑定到V钱包的)
const AGENTS_TO_BIND = [
  'tw:FuSheng_0306',
  'tw:cz_binance', 
  'tw:YuanqiAIBot',
  'tw:ShellBookAI',
  'tw:ShellBook_AI',
  'tw:webhogwatrs',
  'tw:WeilianDu',
  'tw:hakuro13579',
  'tw:0x0xcaofuck',
  'tw:flapdotsh',
  'tw:rubao520',
  'tw:eth_cedric',
  'tw:cc77140_cc',
  'tw:mrbeast',
  'moltcaster'
];

// secp256k1 曲线的 n/2
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const SECP256K1_N_DIV_2 = SECP256K1_N / 2n;

// 将 DER 签名转换为 r,s,v 格式，并规范化 S 值
function derToRS(derSig) {
  let offset = 2;
  const rLength = derSig[offset + 1];
  let r = derSig.slice(offset + 2, offset + 2 + rLength);
  offset += 2 + rLength;
  const sLength = derSig[offset + 1];
  let s = derSig.slice(offset + 2, offset + 2 + sLength);
  
  // 移除前导零
  if (r.length === 33 && r[0] === 0) r = r.slice(1);
  if (s.length === 33 && s[0] === 0) s = s.slice(1);
  
  // 填充到32字节
  while (r.length < 32) r = Buffer.concat([Buffer.from([0]), r]);
  while (s.length < 32) s = Buffer.concat([Buffer.from([0]), s]);
  
  // 规范化 S 值 (low-S)
  let sBigInt = BigInt('0x' + s.toString('hex'));
  if (sBigInt > SECP256K1_N_DIV_2) {
    sBigInt = SECP256K1_N - sBigInt;
    s = Buffer.from(sBigInt.toString(16).padStart(64, '0'), 'hex');
  }
  
  return { r, s };
}

// 使用 KMS 签名，确保恢复出正确的 signer 地址
async function signWithKMS(kmsClient, messageHash, expectedSigner) {
  const command = new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: Buffer.from(messageHash.slice(2), 'hex'),
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256'
  });
  
  const response = await kmsClient.send(command);
  const { r, s } = derToRS(Buffer.from(response.Signature));
  
  // 尝试 v=27 和 v=28，找到能恢复出正确地址的
  for (const v of [27, 28]) {
    const sig = ethers.concat([r, s, new Uint8Array([v])]);
    try {
      const recovered = ethers.recoverAddress(messageHash, sig);
      if (recovered.toLowerCase() === expectedSigner.toLowerCase()) {
        return { signature: ethers.hexlify(sig), recoveredAddress: recovered };
      }
    } catch (e) {}
  }
  throw new Error(`Failed to recover address matching ${expectedSigner}`);
}

async function main() {
  // 检查环境变量
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('请设置 AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY');
    return;
  }
  if (!process.env.PRIVATE_KEY) {
    console.log('请设置 PRIVATE_KEY (用于发送交易)');
    return;
  }

  const kmsClient = new KMSClient({ region: 'us-east-2' });
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const custody = new ethers.Contract(CUSTODY_ADDRESS, CUSTODY_ABI, provider);
  const custodyWithSigner = custody.connect(wallet);

  // 验证 signer
  const contractSigner = await custody.signer();
  console.log(`合约 signer: ${contractSigner}`);

  // 已知合约 signer，直接使用
  const kmsAddress = contractSigner;
  console.log(`使用合约 signer 地址: ${kmsAddress}\n`);

  console.log('=== 开始批量绑定 ===\n');

  let bound = 0;
  for (const agentName of AGENTS_TO_BIND) {
    // 检查是否已绑定
    const currentWallet = await custody.agentWallet(agentName);
    if (currentWallet !== ethers.ZeroAddress) {
      console.log(`${agentName}: 已绑定到 ${currentWallet.slice(0,10)}...，跳过`);
      continue;
    }

    // 生成 nonce
    const nonce = ethers.randomBytes(32);
    const nonceHex = ethers.hexlify(nonce);

    // 构造消息 hash (EIP-191)
    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'address', 'string', 'address', 'bytes32', 'uint256'],
      ['SynthLaunch:BindWallet', CUSTODY_ADDRESS, agentName, V_WALLET, nonceHex, CHAIN_ID]
    ));
    const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));

    try {
      // 使用 KMS 签名
      const { signature, recoveredAddress } = await signWithKMS(kmsClient, ethSignedHash, kmsAddress);
      console.log(`${agentName}: 签名完成，recovered: ${recoveredAddress.slice(0,10)}...`);

      // 调用 bindWallet
      const tx = await custodyWithSigner.bindWallet(agentName, V_WALLET, nonceHex, signature, {
        gasLimit: 200000n
      });
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ 绑定成功!`);
      bound++;
    } catch (e) {
      console.log(`  ❌ 失败: ${e.message}`);
    }
  }

  console.log(`\n=== 完成: ${bound}/${AGENTS_TO_BIND.length} 个绑定成功 ===`);
}

main().catch(console.error);
