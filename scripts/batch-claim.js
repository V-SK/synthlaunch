// 批量 claim 税收脚本
// 使用: PRIVATE_KEY=xxx node scripts/batch-claim.js

const { ethers } = require('ethers');

const CUSTODY_ADDRESS = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const BSC_RPC = 'https://bsc-dataseed.binance.org/';

const CUSTODY_ABI = [
  'function tokenAgent(address) view returns (string)',
  'function tokenFees(address) view returns (uint256)',
  'function tokenClaimed(address) view returns (uint256)',
  'function agentWallet(string) view returns (address)',
  'function claim(address token) external',
  'function claimBatch(address[] calldata tokens) external'
];

// 从 Supabase 查询到的 beneficiary = Custody 的 tokens
const CUSTODY_TOKENS = [
  '0xed50388a82582cb58e6b00cb93e29f0e69b27777', // NFA
  '0x9ba761bc56c7982171a97721f55f126493477777', // 1 (KingMolt)
  '0x1fa7a45630f3707a61d2b864f32c63658f077777', // 元气AI
  '0x98f6cfb2f9afd33de46bc084b7b70fa8d4c77777', // 大表哥
  '0xde8481015528b1a4065f2293f1ad4ee588597777', // 元气AI v2
  '0xf9a9a95b6bd7d04ba37ce41dbec0a97708747777', // ShellBook
  '0x85f9aab65e5cc872ce8ebbbd8e30b6991e177777', // 虾聊
  '0x1d5711cbcead740def8a2cc9dab7d24883497777', // Alice BTC
  '0x88bb130e2fe4b45a8057f944ac5445933a9f7777', // 1111
  '0xded85a57048be3005ed3100616c4cb4ad3fd7777', // 校长
  '0xa4c8fd3ab815c1c5be011cc1458b211492217777', // 壳书
  '0x9c334bc69ab48837180dc19f55aaa9356a017777', // flaboratory
  '0x151bb9a0620ef1afe1b3880a10ad603a1cc07777', // 0x0xcaofuck
  '0x6089ff7bbfc2e1bbf0284501b35d835193a37777', // flapdotsh
  '0x738addbef81845f42dcfac91a584c4b80ea47777', // Deployer
  '0x68efbe02b9f2a8ed3bde3851333dd0f153c77777', // test
  '0xa9631187697c6545dc0ad8ef9cf9fb61ed4d7777', // Rubao520
  '0xc9dd7e313ba4edafaf9c1cdd4e7d663e92b57777', // 蝴蝶
  '0xebf3c11c4f7efb33e5ec0917cabae0db97b27777', // flapdotsh v2
  '0x021a57ee442755a7777f786fe616091a41567777', // flapdotsh v3
  '0x08a482b221fd62c7c8aa696054536e6d59f57777', // xxx
  '0x649cf5332383257c34c25f803708defab5117777', // eth_cedric
  '0x4037579507af4200ab6966929b38a128dd3b7777', // CherryWang2024
  '0x7ab568e15334667b85fbbd6f0cbd98c9968b7777', // lxfater
  '0x0313d31eeea994e50acc4749c54f9a8e90097777', // jiamigou
  '0xe2c37658719feaf8891a48a50c2e121ac3f57777', // webhogwatrs
  '0x47c1557033f62c261135db5ccfd7d3a639a97777', // test v2
  '0x03f7311e31f942cc6c71f9d9593c9b3b8d477777', // shui918918
  '0xc3f14868faec544a20eaed9b31311039e77a7777', // cz_binance
  '0xf1d9580e86d3de6f47d8d5642fb0e70c0b107777', // grok
  '0x933d7621c7d6d34c5cd3f114265ae319de5a7777', // lxfater v2
  '0x84f1fcebd483045ce97929fcfdf3899783ee7777', // 金狗社区
  '0x5b16adc563e4c05d7f41de3b476492fb8fb27777', // cc77140_cc
  '0xa072a4c6a80bb4b992e5630821aac4dbea717777', // 0xajc
  '0x1a86605d400109d934fffc35d7bee5c6bcd37777', // 主理人
  '0x0c2a39e6256c93456080d62008e47e29f3b17777', // 0x0xcaofuck v2
  '0x08898baa77f423da114d406a4d9ea4f05d997777', // kinforge_lab
  '0xa1dbe5454347b51936fd3f13b19b9d1776c17777', // MrBeast
  '0x611c2745626916b94017ba34560e1ac56c527777', // mostafanas82319
];

async function main() {
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const custody = new ethers.Contract(CUSTODY_ADDRESS, CUSTODY_ABI, provider);

  console.log('=== 扫描可 claim 的 tokens ===\n');

  let claimableTokens = [];
  let totalClaimable = 0n;

  for (const token of CUSTODY_TOKENS) {
    try {
      const agentName = await custody.tokenAgent(token);
      if (!agentName) continue;

      const fees = await custody.tokenFees(token);
      const claimed = await custody.tokenClaimed(token);
      const pending = fees - claimed;

      if (pending > 0n) {
        const wallet = await custody.agentWallet(agentName);
        const pendingBNB = ethers.formatEther(pending);
        console.log(`${agentName}: ${pendingBNB} BNB (wallet: ${wallet.slice(0,10)}...)`);
        
        // 只有绑定到 V 钱包的才能 claim
        if (wallet.toLowerCase() === '0x5c9E31B8E3fDc7356D7398165457423854C72C8e'.toLowerCase()) {
          claimableTokens.push(token);
          totalClaimable += pending;
        }
      }
    } catch (e) {
      // 跳过未注册的 token
    }
  }

  console.log(`\n=== 总计可 claim: ${ethers.formatEther(totalClaimable)} BNB ===`);
  console.log(`可 claim 的 tokens: ${claimableTokens.length} 个\n`);

  if (claimableTokens.length === 0) {
    console.log('没有可 claim 的 tokens');
    return;
  }

  // 检查是否有私钥
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('请设置 PRIVATE_KEY 环境变量来执行 claim');
    console.log('命令: PRIVATE_KEY=xxx node scripts/batch-claim.js');
    return;
  }

  // 执行批量 claim
  console.log('=== 执行批量 claim ===\n');
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`使用钱包: ${wallet.address}`);

  const custodyWithSigner = custody.connect(wallet);

  // 分批 claim (每批最多 20 个)
  const batchSize = 20;
  for (let i = 0; i < claimableTokens.length; i += batchSize) {
    const batch = claimableTokens.slice(i, i + batchSize);
    console.log(`\nClaiming batch ${Math.floor(i/batchSize) + 1}: ${batch.length} tokens...`);
    
    try {
      const tx = await custodyWithSigner.claimBatch(batch, {
        gasLimit: 500000n * BigInt(batch.length)
      });
      console.log(`TX: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ 成功! Gas used: ${receipt.gasUsed}`);
    } catch (e) {
      console.error(`❌ 失败: ${e.message}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
