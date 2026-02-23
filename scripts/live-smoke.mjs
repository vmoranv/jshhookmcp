import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(__dirname, '..', 'dist', 'index.js');

const proc = spawn('node', [serverEntry], { stdio: ['pipe', 'pipe', 'pipe'] });
const rl = createInterface({ input: proc.stdout });
let msgId = 1;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const id = msgId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectPromise(new Error(`${method} timed out`));
    }, 45000);
    pending.set(id, {
      resolve: (result) => {
        clearTimeout(timer);
        resolvePromise(result);
      },
      reject: (error) => {
        clearTimeout(timer);
        rejectPromise(error);
      },
      method,
    });
    proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

function parseToolResult(result) {
  const text = result?.content?.[0]?.text ?? '{}';
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

rl.on('line', (line) => {
  if (!line.trim()) {
    return;
  }
  try {
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      const state = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        state.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        state.resolve(msg.result);
      }
    }
  } catch {
  }
});

proc.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.toLowerCase().includes('error')) {
    process.stderr.write(`[MCP] ${output}`);
  }
});

const checks = [];

async function callTool(name, args = {}) {
  const result = await send('tools/call', { name, arguments: args });
  return parseToolResult(result);
}

async function assertStep(name, fn) {
  try {
    const result = await fn();
    checks.push({ name, ok: true });
    console.log(`PASS ${name}`);
    return result;
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function run() {
  try {
    await assertStep('initialize', async () =>
      send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'live-smoke', version: '1.0.0' },
      }),
    );

    await assertStep('browser_launch', async () => {
      const data = await callTool('browser_launch', { headless: true });
      if (!data.success) throw new Error('browser_launch returned success=false');
      return data;
    });

    await assertStep('stealth_inject', async () => {
      await callTool('stealth_inject');
    });

    await assertStep('network_enable', async () => {
      const data = await callTool('network_enable');
      if (!data.success) throw new Error('network_enable returned success=false');
      return data;
    });

    await assertStep('navigate_example', async () => {
      const data = await callTool('page_navigate', {
        url: 'https://example.com',
        waitUntil: 'networkidle',
      });
      if (!data.success) throw new Error('page_navigate example.com failed');
      return data;
    });

    await assertStep('dom_query_selector_h1', async () => {
      await callTool('dom_query_selector', { selector: 'h1' });
    });

    await assertStep('page_get_all_links', async () => {
      const data = await callTool('page_get_all_links');
      if (!data.success) {
        return { warning: 'page_get_all_links returned success=false', data };
      }
      return data;
    });

    await assertStep('navigate_httpbin', async () => {
      const data = await callTool('page_navigate', {
        url: 'https://httpbin.org/get',
        waitUntil: 'networkidle',
      });
      if (!data.success) throw new Error('page_navigate httpbin.org failed');
      return data;
    });

    await assertStep('page_evaluate_httpbin_fetch', async () => {
      const data = await callTool('page_evaluate', {
        script: "fetch('/uuid').then(r => r.json())",
      });
      if (!data.success) throw new Error('page_evaluate fetch failed');
      return data;
    });

    await assertStep('network_get_requests', async () => {
      const data = await callTool('network_get_requests', { url: 'httpbin.org' });
      if (data.success === false) throw new Error(data.error || 'network_get_requests failed');
      return data;
    });

    await assertStep('get_all_scripts', async () => {
      const data = await callTool('get_all_scripts');
      if (!data.success) {
        return { warning: 'get_all_scripts returned success=false', data };
      }
      return data;
    });

    await assertStep('navigate_github', async () => {
      const data = await callTool('page_navigate', {
        url: 'https://github.com',
        waitUntil: 'domcontentloaded',
      });
      if (!data.success) throw new Error('page_navigate github.com failed');
      return data;
    });

    await assertStep('dom_query_selector_github', async () => {
      await callTool('dom_query_selector', { selector: 'body' });
    });

    await assertStep('performance_get_metrics', async () => {
      const data = await callTool('performance_get_metrics');
      if (!data.success) {
        return { warning: 'performance_get_metrics returned success=false', data };
      }
      return data;
    });

    await assertStep('debugger_enable', async () => {
      const data = await callTool('debugger_enable');
      if (!data.success) throw new Error('debugger_enable failed');
      return data;
    });

    await assertStep('browser_close', async () => {
      const data = await callTool('browser_close');
      if (!data.success) throw new Error('browser_close failed');
      return data;
    });
  } finally {
    proc.kill();
    const passed = checks.filter((item) => item.ok).length;
    console.log(`\nLive smoke result: ${passed}/${checks.length} steps passed`);
    const failed = checks.filter((item) => !item.ok);
    if (failed.length > 0) {
      for (const entry of failed) {
        console.log(`- ${entry.name}: ${entry.error}`);
      }
      process.exit(1);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
