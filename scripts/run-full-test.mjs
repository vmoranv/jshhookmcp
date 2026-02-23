#!/usr/bin/env node
/**
 * Full Test Execution Script for jshookmcp CTF
 */

import { spawn } from 'child_process';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Test results
const testResults = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: { total: 0, passed: 0, failed: 0 }
};

// Test configuration
const TEST_CONFIG = {
  targetUrl: 'https://chat.qwen.ai',
  outputDir: join(rootDir, 'test-results', new Date().toISOString().replace(/[:.]/g, '-')),
  browserTimeout: 120000,
};

// Ensure output directory exists
if (!existsSync(TEST_CONFIG.outputDir)) {
  mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
}

console.log('🚀 jshookmcp Full Test Execution');
console.log('=================================');
console.log(`输出目录: ${TEST_CONFIG.outputDir}`);
console.log('');

// Tool test definitions
const TEST_CASES = [
  // Phase 1: Build Verification
  {
    phase: '构建检查',
    name: 'TypeScript 编译',
    command: 'npm run build',
    check: 'Build success'
  },

  // Phase 2: Process Tools (Windows)
  {
    phase: '进程管理',
    name: 'process_find',
    description: '查找 Chrome 进程'
  },
  {
    phase: '进程管理',
    name: 'process_find_wechatappex',
    description: '查找微信小程序进程'
  },

  // Phase 3: Memory Tools
  {
    phase: '内存操作',
    name: 'memory_check_protection',
    description: '检查内存保护',
    requiresAdmin: true
  },
  {
    phase: '内存操作',
    name: 'memory_list_regions',
    description: '列出内存区域',
    requiresAdmin: true
  },
  {
    phase: '内存操作',
    name: 'enumerate_modules',
    description: '枚举加载模块',
    requiresAdmin: true
  },

  // Phase 4: Injection Tools
  {
    phase: '代码注入',
    name: 'inject_dll',
    description: 'DLL 注入功能',
    requiresAdmin: true
  },
  {
    phase: '代码注入',
    name: 'inject_shellcode',
    description: 'Shellcode 注入',
    requiresAdmin: true
  },
];

console.log('📋 测试用例准备完成');
console.log(`   总测试数: ${TEST_CASES.length}`);
console.log('');

// Print checklist for manual testing
console.log('📋 手动测试清单 (请在 MCP Server 启动后执行):');
console.log('');

const manualTests = [
  { cat: '浏览器', tools: ['browser_launch', 'stealth_inject', 'page_navigate', 'page_screenshot'] },
  { cat: '代码分析', tools: ['get_all_scripts', 'collect_code', 'search_in_scripts', 'detect_obfuscation'] },
  { cat: 'API 拦截', tools: ['console_enable', 'console_inject_fetch_interceptor', 'network_enable'] },
  { cat: 'Hook 注入', tools: ['ai_hook_generate', 'ai_hook_inject', 'ai_hook_list'] },
  { cat: '调试器', tools: ['debugger_enable', 'breakpoint_set', 'watch_add'] },
  { cat: 'CTF 专项', tools: ['webpack_enumerate', 'source_map_extract', 'indexeddb_dump', 'framework_state_extract'] },
];

manualTests.forEach(({ cat, tools }) => {
  console.log(`\n${cat}:`);
  tools.forEach(t => console.log(`  ☐ ${t}`));
});

console.log('\n');
console.log('=================================');
console.log('✅ 测试准备完成!');
console.log('');
console.log('下一步:');
console.log('1. 确保 MCP Server 在运行: npm start');
console.log('2. 在 Claude Code 中执行工具测试');
console.log('3. 按 FULL-TEST-EXECUTION.md 的清单逐个测试');
console.log('');
console.log(`测试报告将保存到: ${TEST_CONFIG.outputDir}`);
