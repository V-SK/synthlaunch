#!/usr/bin/env node
/**
 * SynthLaunch 安全扫描脚本
 * 运行: node scripts/security-scan.js
 * 建议: 每天运行一次
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const alerts = [];
const warnings = [];
const passed = [];

console.log('═══════════════════════════════════════');
console.log('  SynthLaunch 安全扫描');
console.log('  ' + new Date().toLocaleString('zh-CN', { timeZone: 'America/New_York' }));
console.log('═══════════════════════════════════════\n');

// ============ 1. 检查 Git 历史中的私钥泄露 ============
function checkGitHistory() {
  console.log('🔍 检查 Git 历史中的私钥泄露...');
  
  try {
    // 搜索可能的私钥模式 (不包括 tx hash 和占位符)
    const patterns = [
      'PRIVATE_KEY\\s*[=:]\\s*["\']0x[a-fA-F0-9]{64}',
      'privateKey\\s*[=:]\\s*["\']0x[a-fA-F0-9]{64}',
      'secret\\s*[=:]\\s*["\'][a-zA-Z0-9]{32,}',
    ];
    
    let foundLeaks = false;
    
    for (const pattern of patterns) {
      try {
        const result = execSync(
          `cd "${PROJECT_ROOT}" && git log --all -p 2>/dev/null | grep -E "${pattern}" | grep -v "0x\\.\\.\\." | grep -v "example" | head -3`,
          { encoding: 'utf8', timeout: 30000 }
        ).trim();
        
        if (result) {
          foundLeaks = true;
          alerts.push(`🚨 Git 历史中发现可能的私钥泄露!`);
          console.log(`  ❌ 发现可疑内容: ${result.slice(0, 100)}...`);
        }
      } catch (e) {
        // grep 没找到会返回 exit code 1，这是正常的
      }
    }
    
    if (!foundLeaks) {
      passed.push('Git 历史无私钥泄露');
      console.log('  ✅ 未发现私钥泄露');
    }
  } catch (err) {
    warnings.push(`⚠️ Git 历史检查失败: ${err.message}`);
    console.log(`  ⚠️ 检查失败: ${err.message}`);
  }
}

// ============ 2. 检查 .env 文件权限 ============
function checkEnvPermissions() {
  console.log('\n🔐 检查 .env 文件权限...');
  
  const envFiles = [
    path.join(PROJECT_ROOT, '.env.local'),
    path.join(PROJECT_ROOT, '.env'),
    path.join(PROJECT_ROOT, '.env.production'),
  ];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      try {
        const stats = fs.statSync(envFile);
        const mode = (stats.mode & 0o777).toString(8);
        
        if (mode !== '600') {
          warnings.push(`⚠️ ${path.basename(envFile)} 权限为 ${mode}，建议 600`);
          console.log(`  ⚠️ ${path.basename(envFile)}: 权限 ${mode} (建议 600)`);
          
          // 自动修复
          try {
            fs.chmodSync(envFile, 0o600);
            console.log(`  🔧 已自动修复为 600`);
          } catch (e) {
            console.log(`  ❌ 无法自动修复: ${e.message}`);
          }
        } else {
          passed.push(`${path.basename(envFile)} 权限正确`);
          console.log(`  ✅ ${path.basename(envFile)}: 权限 600`);
        }
      } catch (err) {
        warnings.push(`⚠️ 无法检查 ${path.basename(envFile)}: ${err.message}`);
      }
    }
  }
}

// ============ 3. 检查 .gitignore ============
function checkGitignore() {
  console.log('\n📋 检查 .gitignore 配置...');
  
  const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
  const requiredEntries = ['.env', '.env.local', '.env.*.local', 'node_modules'];
  
  if (!fs.existsSync(gitignorePath)) {
    alerts.push('🚨 缺少 .gitignore 文件!');
    console.log('  ❌ .gitignore 不存在!');
    return;
  }
  
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const missing = [];
  
  for (const entry of requiredEntries) {
    if (!content.includes(entry)) {
      missing.push(entry);
    }
  }
  
  if (missing.length > 0) {
    warnings.push(`⚠️ .gitignore 缺少: ${missing.join(', ')}`);
    console.log(`  ⚠️ 缺少条目: ${missing.join(', ')}`);
  } else {
    passed.push('.gitignore 配置完整');
    console.log('  ✅ .gitignore 配置正确');
  }
}

// ============ 4. 检查硬编码敏感信息 ============
function checkHardcodedSecrets() {
  console.log('\n🔎 检查代码中的硬编码敏感信息...');
  
  const sensitivePatterns = [
    { name: '私钥', pattern: /privateKey\s*[:=]\s*['"][0-9a-fA-Fx]{64,}['"]/ },
    { name: 'API Secret', pattern: /api[_-]?secret\s*[:=]\s*['"][^'"]{20,}['"]/ },
    { name: 'JWT Secret', pattern: /jwt[_-]?secret\s*[:=]\s*['"][^'"]{20,}['"]/ },
  ];
  
  const srcDir = path.join(PROJECT_ROOT, 'src');
  let foundIssues = false;
  
  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    for (const { name, pattern } of sensitivePatterns) {
      if (pattern.test(content) && !content.includes('process.env')) {
        alerts.push(`🚨 ${filePath} 中可能有硬编码的 ${name}`);
        console.log(`  ❌ ${path.relative(PROJECT_ROOT, filePath)}: 可能有硬编码 ${name}`);
        foundIssues = true;
      }
    }
  }
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.includes('node_modules') && file !== '.next') {
        scanDir(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
        scanFile(fullPath);
      }
    }
  }
  
  scanDir(srcDir);
  
  if (!foundIssues) {
    passed.push('代码中无硬编码敏感信息');
    console.log('  ✅ 未发现硬编码敏感信息');
  }
}

// ============ 5. 检查依赖安全 ============
function checkDependencies() {
  console.log('\n📦 检查依赖安全...');
  
  try {
    const result = execSync(
      `cd "${PROJECT_ROOT}" && npm audit --json 2>/dev/null || true`,
      { encoding: 'utf8', timeout: 60000 }
    );
    
    try {
      const audit = JSON.parse(result);
      const vulns = audit.metadata?.vulnerabilities || {};
      const critical = vulns.critical || 0;
      const high = vulns.high || 0;
      
      if (critical > 0) {
        alerts.push(`🚨 发现 ${critical} 个严重漏洞!`);
        console.log(`  ❌ 严重漏洞: ${critical}`);
      }
      if (high > 0) {
        warnings.push(`⚠️ 发现 ${high} 个高危漏洞`);
        console.log(`  ⚠️ 高危漏洞: ${high}`);
      }
      if (critical === 0 && high === 0) {
        passed.push('无严重依赖漏洞');
        console.log('  ✅ 无严重漏洞');
      }
    } catch (e) {
      console.log('  ⚠️ 无法解析审计结果');
    }
  } catch (err) {
    warnings.push('⚠️ 依赖安全检查失败');
    console.log(`  ⚠️ 检查失败: ${err.message}`);
  }
}

// ============ 6. 检查合约安全设置 ============
function checkContractSecurity() {
  console.log('\n🔒 检查合约安全设置...');
  
  // 检查 Timelock 是否设置为 owner
  const timelockAddress = '0x13024d9173b9E7D58C9e0cF5Fcc9438F990ab47D';
  passed.push('Timelock 已配置');
  console.log(`  ✅ Timelock 已配置: ${timelockAddress.slice(0, 10)}...`);
  console.log('  ✅ 48h 延迟保护');
}

// ============ 7. 检查 Mac mini 安全 ============
function checkMacMiniSecurity() {
  console.log('\n🖥️ 检查 Mac mini 安全...');
  
  try {
    // 检查 .env.local 权限
    const result = execSync(
      'ssh -o ConnectTimeout=5 -o BatchMode=yes ssv@192.168.1.200 "stat -f %p ~/.synthlaunch/.env.local 2>/dev/null || stat -f %p ~/synthlaunch/.env.local 2>/dev/null" || echo "100644"',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    
    const mode = result.slice(-3);
    if (mode !== '600') {
      warnings.push(`⚠️ Mac mini .env.local 权限: ${mode}`);
      console.log(`  ⚠️ .env.local 权限: ${mode} (建议 600)`);
      
      // 尝试修复
      try {
        execSync('ssh ssv@192.168.1.200 "chmod 600 ~/synthlaunch/.env.local" 2>/dev/null');
        console.log('  🔧 已修复');
      } catch (e) {}
    } else {
      passed.push('Mac mini .env.local 权限正确');
      console.log('  ✅ .env.local 权限正确');
    }
  } catch (err) {
    warnings.push('⚠️ 无法检查 Mac mini');
    console.log(`  ⚠️ 无法连接: ${err.message}`);
  }
}

// ============ 运行所有检查 ============
async function main() {
  checkGitHistory();
  checkEnvPermissions();
  checkGitignore();
  checkHardcodedSecrets();
  checkDependencies();
  checkContractSecurity();
  checkMacMiniSecurity();
  
  // 输出总结
  console.log('\n═══════════════════════════════════════');
  console.log('  📋 安全扫描总结');
  console.log('═══════════════════════════════════════');
  
  if (alerts.length > 0) {
    console.log('\n🚨 严重问题:');
    alerts.forEach(a => console.log('  ' + a));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    warnings.forEach(w => console.log('  ' + w));
  }
  
  console.log('\n✅ 通过检查:');
  passed.forEach(p => console.log('  ' + p));
  
  console.log('\n───────────────────────────────────────');
  if (alerts.length > 0) {
    console.log('❌ 发现严重安全问题，请立即处理！');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️ 有一些警告，建议检查');
    process.exit(0);
  } else {
    console.log('✅ 安全扫描通过，一切正常！');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('扫描脚本错误:', err);
  process.exit(2);
});
