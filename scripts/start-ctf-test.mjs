#!/usr/bin/env node
/**
 * CTF 全量测试启动脚本
 * 执行实际的浏览器启动和基础测试
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

const TEST_LOG = {
  timestamp: new Date().toISOString(),
  results: [],
  currentStep: 0
};

function log(step, status, message, data = null) {
  const entry = {
    step,
    status,
    message,
    data,
    time: new Date().toISOString()
  };
  TEST_LOG.results.push(entry);
  const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳';
  console.log(`${icon} [${step}] ${message}`);
}

console.log('═══════════════════════════════════════════');
console.log('🚀 jshookmcp CTF 全量测试');
console.log('═══════════════════════════════════════════\n');

// Step 1: Check build
log('1/10', 'running', '检查 TypeScript 编译...');
try {
  await execAsync('npm run build', { cwd: 'D:/coding/reverse/jshhookmcp' });
  log('1/10', 'success', 'TypeScript 编译通过');
} catch (e) {
  log('1/10', 'error', '编译失败', e.message);
  process.exit(1);
}

// Step 2: Check MCP Server can start
log('2/10', 'running', '检查 MCP Server 启动...');
const checkServer = new Promise((resolve) => {
  const child = spawn('node', ['dist/index.js'], {
    cwd: 'D:/coding/reverse/jshhookmcp',
    timeout: 10000
  });

  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
    if (output.includes('MCP server started successfully')) {
      log('2/10', 'success', 'MCP Server 可正常启动');
      child.kill();
      resolve(true);
    }
  });

  child.stderr.on('data', (data) => {
    // Ignore warnings
  });

  setTimeout(() => {
    child.kill();
    if (!output.includes('MCP server started')) {
      log('2/10', 'error', 'MCP Server 启动失败或超时');
      resolve(false);
    }
  }, 8000);
});

await checkServer;

// Step 3: Check process tools
log('3/10', 'running', '检查进程管理模块...');
try {
  const { ProcessManager } = await import('../dist/modules/process/ProcessManager.js');
  const pm = new ProcessManager();
  log('3/10', 'success', 'ProcessManager 实例化成功');
} catch (e) {
  log('3/10', 'error', 'ProcessManager 加载失败', e.message);
}

// Step 4: Check memory tools
log('4/10', 'running', '检查内存管理模块...');
try {
  const { MemoryManager } = await import('../dist/modules/process/MemoryManager.js');
  const mm = new MemoryManager();
  log('4/10', 'success', 'MemoryManager 实例化成功 (Windows)');
} catch (e) {
  log('4/10', 'error', 'MemoryManager 加载失败', e.message);
}

// Step 5: Check tool registration
log('5/10', 'running', '检查工具注册...');
try {
  const { allTools } = await import('../dist/server/ToolCatalog.js');
  const processTools = allTools.filter(t =>
    t.name.includes('process') ||
    t.name.includes('memory') ||
    t.name.includes('inject')
  );
  log('5/10', 'success', `已注册 ${processTools.length} 个进程/内存工具`);
  console.log('   工具列表:', processTools.map(t => t.name).join(', '));
} catch (e) {
  log('5/10', 'error', '工具注册检查失败', e.message);
}

// Step 6: Check Chrome exists
log('6/10', 'running', '检查 Chrome 浏览器...');
try {
  const { default: puppeteer } = await import('puppeteer');
  log('6/10', 'success', 'Puppeteer 已安装');
} catch (e) {
  log('6/10', 'warning', 'Puppeteer 检查失败 (可能未安装)', e.message);
}

// Step 7: Check admin privileges (for memory)
log('7/10', 'running', '检查管理员权限 (内存操作需要)...');
const isAdmin = process.platform === 'win32' &&
  (await execAsync('powershell.exe -Command "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"').catch(() => ({ stdout: 'False' }))).stdout.trim() === 'True';

if (isAdmin) {
  log('7/10', 'success', '当前以管理员权限运行，内存操作可用');
} else {
  log('7/10', 'warning', '当前非管理员权限，内存操作可能失败');
}

// Step 8: Find existing processes
log('8/10', 'running', '查找现有进程...');
try {
  const { exec: execPS } = await import('child_process');
  const { promisify: p } = await import('util');
  const execP = p(execPS);

  // Check Chrome
  const chromeResult = await execP('powershell.exe -Command "Get-Process chrome -ErrorAction SilentlyContinue | Select-Object -First 1"').catch(() => ({ stdout: '' }));
  if (chromeResult.stdout.trim()) {
    log('8/10', 'info', '检测到 Chrome 进程正在运行');
  } else {
    log('8/10', 'info', '未检测到 Chrome 进程');
  }

  // Check WeChatAppEx
  const wechatResult = await execP('powershell.exe -Command "Get-Process WeChatAppEx -ErrorAction SilentlyContinue | Select-Object -First 1"').catch(() => ({ stdout: '' }));
  if (wechatResult.stdout.trim()) {
    log('8/10', 'success', '检测到微信小程序进程 (WeChatAppEx)');
  } else {
    log('8/10', 'warning', '未检测到微信小程序进程，请打开游戏后重试');
  }
} catch (e) {
  log('8/10', 'error', '进程查找失败', e.message);
}

// Step 9: Output test checklist
log('9/10', 'running', '生成测试清单...');
console.log('\n📋 手动测试清单 (请在 MCP Server 中执行):\n');

const checklist = [
  { phase: '🌐 浏览器测试', cmds: [
    'browser_launch({ headless: false })',
    'stealth_inject()',
    'page_navigate({ url: "https://chat.qwen.ai" })',
    'page_screenshot({ path: "qwen.png" })'
  ]},
  { phase: '🔍 代码分析', cmds: [
    'get_all_scripts()',
    'collect_code()',
    'search_in_scripts({ keyword: "api" })',
    'detect_obfuscation()'
  ]},
  { phase: '📡 API 拦截', cmds: [
    'console_enable()',
    'console_inject_fetch_interceptor()',
    'network_enable()'
  ]},
  { phase: '🎣 Hook 注入', cmds: [
    'ai_hook_generate({ pattern: "fetch" })',
    'ai_hook_inject({ hookId: "..." })'
  ]},
  { phase: '🧩 CTF 专项', cmds: [
    'webpack_enumerate()',
    'source_map_extract()',
    'indexeddb_dump()'
  ]},
  { phase: '💻 进程管理', cmds: [
    'process_find({ pattern: "WeChatAppEx" })',
    'process_find_wechatappex()',
    'process_get({ pid: 12345 })'
  ]},
  { phase: '🧠 内存操作 (需管理员)', cmds: [
    'memory_list_regions({ pid: 12345 })',
    'memory_scan({ pid: 12345, pattern: "1000", patternType: "int32" })',
    'enumerate_modules({ pid: 12345 })'
  ]}
];

checklist.forEach(({ phase, cmds }) => {
  console.log(`${phase}:`);
  cmds.forEach(cmd => console.log(`  ☐ ${cmd}`));
  console.log('');
});

log('9/10', 'success', '测试清单生成完成');

// Step 10: Save report
log('10/10', 'running', '保存测试报告...');
const reportDir = 'D:/coding/reverse/jshhookmcp/test-results';
if (!existsSync(reportDir)) {
  mkdirSync(reportDir, { recursive: true });
}

const reportPath = join(reportDir, `test-log-${Date.now()}.json`);
writeFileSync(reportPath, JSON.stringify(TEST_LOG, null, 2));
log('10/10', 'success', `测试报告已保存: ${reportPath}`);

// Summary
console.log('\n═══════════════════════════════════════════');
console.log('📊 测试总结');
console.log('═══════════════════════════════════════════');
const success = TEST_LOG.results.filter(r => r.status === 'success').length;
const error = TEST_LOG.results.filter(r => r.status === 'error').length;
const warning = TEST_LOG.results.filter(r => r.status === 'warning').length;

console.log(`✅ 成功: ${success}`);
console.log(`❌ 失败: ${error}`);
console.log(`⚠️  警告: ${warning}`);

console.log('\n📝 下一步操作:');
console.log('1. 在管理员 PowerShell 中启动 MCP Server:');
console.log('   cd D:/coding/reverse/jshhookmcp && npm start');
console.log('2. 在 Claude Code 中执行上述测试清单');
console.log('3. 登录 chat.qwen.ai 测试账号');
console.log('4. 打开微信小程序游戏');
console.log('5. 执行进程/内存工具测试');

console.log('\n✨ 测试准备完成！');
