#!/usr/bin/env node
/**
 * SynthLaunch 全面监控脚本
 * 运行: node scripts/monitor.js
 * Cron: 每 30 分钟运行一次
 */

const https = require('https');
const http = require('http');

// ============ 配置 ============
const CONFIG = {
  // 合约地址
  CUSTODY: '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7',
  DEPLOYER: '0x8028227C43947F41bB431571002D512815D77C4F',
  TIMELOCK: '0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D',
  SYNTH_TOKEN: '0x83c8c815bbf6a239816aa0b14ba9d9222b817777',
  
  // 阈值
  MIN_DEPLOYER_BNB: 0.05,  // Deployer 最低余额警告
  MIN_CUSTODY_BNB: 0.5,    // Custody 最低余额警告
  LARGE_WITHDRAWAL_BNB: 5, // 大额提款警报阈值
  
  // API endpoints
  BSC_RPC: 'https://bsc-dataseed1.binance.org',
  WEBSITE_URL: 'https://synthlaunch.fun',
  API_HEALTH: 'https://synthlaunch.fun/api/health',
  API_TOKENS: 'https://synthlaunch.fun/api/tokens',
  
  // Telegram 通知 (可选)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '1374267485',
};

// ============ 工具函数 ============
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
          json: () => {
            try { return JSON.parse(data); } 
            catch { return null; }
          }
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function rpcCall(method, params) {
  const res = await fetch(CONFIG.BSC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1
    })
  });
  const json = res.json();
  return json?.result;
}

async function getBalance(address) {
  const result = await rpcCall('eth_getBalance', [address, 'latest']);
  return parseInt(result, 16) / 1e18;
}

function formatBNB(bnb) {
  return `${bnb.toFixed(4)} BNB (~$${(bnb * 770).toFixed(0)})`;
}

// ============ 监控检查 ============
const alerts = [];
const warnings = [];
const info = [];

async function checkWalletBalances() {
  console.log('\n💰 检查钱包余额...');
  
  try {
    const [custodyBal, deployerBal] = await Promise.all([
      getBalance(CONFIG.CUSTODY),
      getBalance(CONFIG.DEPLOYER)
    ]);
    
    info.push(`Custody: ${formatBNB(custodyBal)}`);
    info.push(`Deployer: ${formatBNB(deployerBal)}`);
    
    if (deployerBal < CONFIG.MIN_DEPLOYER_BNB) {
      alerts.push(`🚨 Deployer 余额过低: ${formatBNB(deployerBal)} (需要充值!)`);
    }
    
    if (custodyBal < CONFIG.MIN_CUSTODY_BNB) {
      warnings.push(`⚠️ Custody 余额较低: ${formatBNB(custodyBal)}`);
    }
    
    console.log(`  ✅ Custody: ${formatBNB(custodyBal)}`);
    console.log(`  ✅ Deployer: ${formatBNB(deployerBal)}`);
    
    return { custodyBal, deployerBal };
  } catch (err) {
    alerts.push(`🚨 无法获取钱包余额: ${err.message}`);
    console.log(`  ❌ 错误: ${err.message}`);
    return null;
  }
}

async function checkWebsiteHealth() {
  console.log('\n🌐 检查网站健康...');
  
  try {
    const start = Date.now();
    const res = await fetch(CONFIG.API_HEALTH);
    const latency = Date.now() - start;
    
    if (res.status === 200) {
      const data = res.json();
      console.log(`  ✅ 网站正常 (${latency}ms)`);
      info.push(`网站: 正常 (${latency}ms)`);
      
      // 检查 health 端点返回的详细状态
      if (data?.checks) {
        for (const [key, val] of Object.entries(data.checks)) {
          if (val.status !== 'ok') {
            warnings.push(`⚠️ Health check ${key}: ${val.status}`);
          }
        }
      }
      return true;
    } else {
      alerts.push(`🚨 网站返回 ${res.status}`);
      console.log(`  ❌ 状态码: ${res.status}`);
      return false;
    }
  } catch (err) {
    alerts.push(`🚨 网站无法访问: ${err.message}`);
    console.log(`  ❌ 错误: ${err.message}`);
    return false;
  }
}

async function checkTokenStats() {
  console.log('\n📊 检查 Token 统计...');
  
  try {
    const res = await fetch(CONFIG.API_TOKENS);
    if (res.status === 200) {
      const tokens = res.json();
      const total = Array.isArray(tokens) ? tokens.length : 0;
      
      // 统计今日新增
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 86400;
      const newToday = tokens.filter(t => t.createdAt > oneDayAgo).length;
      
      // 统计活跃交易的 token (有 reserve > 0)
      const active = tokens.filter(t => t.reserve > 0).length;
      
      console.log(`  ✅ 总 Token: ${total}`);
      console.log(`  ✅ 24h 新增: ${newToday}`);
      console.log(`  ✅ 活跃交易: ${active}`);
      
      info.push(`Token 总数: ${total} (24h +${newToday})`);
      info.push(`活跃交易: ${active}`);
      
      return { total, newToday, active };
    }
  } catch (err) {
    warnings.push(`⚠️ 无法获取 Token 统计: ${err.message}`);
    console.log(`  ❌ 错误: ${err.message}`);
  }
  return null;
}

async function checkContractState() {
  console.log('\n🔒 检查合约状态...');
  
  try {
    // 读取 totalRecorded 和 platformFeeBalance
    // totalRecorded() selector: 0x1e9a6950
    // platformFeeBalance() selector: 需要计算
    
    const totalRecordedData = await rpcCall('eth_call', [{
      to: CONFIG.CUSTODY,
      data: '0x1e9a6950' // totalRecorded()
    }, 'latest']);
    
    if (totalRecordedData && totalRecordedData !== '0x') {
      const totalRecorded = parseInt(totalRecordedData, 16) / 1e18;
      console.log(`  ✅ 累计记录: ${formatBNB(totalRecorded)}`);
      info.push(`累计 Fee: ${formatBNB(totalRecorded)}`);
    }
    
    return true;
  } catch (err) {
    warnings.push(`⚠️ 合约状态检查失败: ${err.message}`);
    console.log(`  ❌ 错误: ${err.message}`);
    return false;
  }
}

async function checkTwitterBot() {
  console.log('\n🤖 检查 Twitter Bot...');
  
  // 这里只能本地检查，通过 SSH 或者读取状态文件
  // 如果是远程运行，跳过这个检查
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      'ssh -o ConnectTimeout=5 -o BatchMode=yes ssv@192.168.1.166 "pgrep -af twitter-bot | wc -l" 2>/dev/null || echo "0"',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    
    const count = parseInt(result) || 0;
    if (count > 0) {
      console.log(`  ✅ Twitter Bot 运行中 (${count} 进程)`);
      info.push(`Twitter Bot: 运行中`);
    } else {
      alerts.push(`🚨 Twitter Bot 未运行!`);
      console.log(`  ❌ Twitter Bot 未检测到`);
    }
    return count > 0;
  } catch (err) {
    // SSH 可能失败（比如在远程环境）
    warnings.push(`⚠️ 无法检查 Twitter Bot: ${err.message}`);
    console.log(`  ⚠️ 跳过 (无法 SSH)`);
    return null;
  }
}

async function checkRecentTransactions() {
  console.log('\n🔍 检查最近交易...');
  
  try {
    // 使用 BscScan API 检查最近交易
    // 这里简化处理，实际可以用 BscScan API key 获取详细信息
    const res = await fetch(
      `https://api.bscscan.com/api?module=account&action=txlist&address=${CONFIG.CUSTODY}&page=1&offset=5&sort=desc`
    );
    
    const data = res.json();
    if (data?.result && Array.isArray(data.result)) {
      const recentTxs = data.result;
      console.log(`  ✅ 最近 ${recentTxs.length} 笔交易已检查`);
      
      // 检查大额转出
      for (const tx of recentTxs) {
        if (tx.from.toLowerCase() === CONFIG.CUSTODY.toLowerCase()) {
          const value = parseInt(tx.value) / 1e18;
          if (value > CONFIG.LARGE_WITHDRAWAL_BNB) {
            warnings.push(`⚠️ 大额转出: ${formatBNB(value)} (tx: ${tx.hash.slice(0,10)}...)`);
          }
        }
      }
    }
    return true;
  } catch (err) {
    // BscScan API 可能限流，不算严重错误
    console.log(`  ⚠️ 跳过 (API 限流)`);
    return null;
  }
}

// ============ 通知发送 ============
async function sendTelegramAlert(message) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) return;
  
  try {
    await fetch(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CONFIG.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );
  } catch (err) {
    console.error('Telegram 通知失败:', err.message);
  }
}

// ============ 主函数 ============
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  SynthLaunch 监控报告');
  console.log('  ' + new Date().toLocaleString('zh-CN', { timeZone: 'America/New_York' }));
  console.log('═══════════════════════════════════════');
  
  // 运行所有检查
  await checkWalletBalances();
  await checkWebsiteHealth();
  await checkTokenStats();
  await checkContractState();
  await checkTwitterBot();
  await checkRecentTransactions();
  
  // 输出总结
  console.log('\n═══════════════════════════════════════');
  console.log('  📋 监控总结');
  console.log('═══════════════════════════════════════');
  
  if (alerts.length > 0) {
    console.log('\n🚨 严重警报:');
    alerts.forEach(a => console.log('  ' + a));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    warnings.forEach(w => console.log('  ' + w));
  }
  
  if (alerts.length === 0 && warnings.length === 0) {
    console.log('\n✅ 所有系统正常运行');
  }
  
  // 发送 Telegram 通知（只在有警报时）
  if (alerts.length > 0) {
    const alertMsg = `🚨 <b>SynthLaunch 监控警报</b>\n\n${alerts.join('\n')}\n\n⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'America/New_York' })}`;
    await sendTelegramAlert(alertMsg);
  }
  
  // 输出状态码
  if (alerts.length > 0) {
    process.exit(1); // 有严重警报
  } else if (warnings.length > 0) {
    process.exit(0); // 有警告但不严重
  } else {
    process.exit(0); // 一切正常
  }
}

main().catch(err => {
  console.error('监控脚本错误:', err);
  process.exit(2);
});
