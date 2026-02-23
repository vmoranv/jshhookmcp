# jshhookmcp

English | [中文](./README.zh.md)

An MCP (Model Context Protocol) server providing 130 tools for AI-assisted JavaScript reverse engineering. Combines browser automation, Chrome DevTools Protocol debugging, network monitoring, intelligent JavaScript hooks, LLM-powered code analysis, and CTF-specific reverse engineering utilities in a single server.

## Features

- **Browser Automation** — Launch Chromium, navigate pages, interact with the DOM, take screenshots, manage cookies and storage
- **CDP Debugger** — Set breakpoints, step through execution, inspect scope variables, watch expressions, session save/restore
- **Network Monitoring** — Capture requests/responses, filter by URL or method, retrieve response bodies
- **JavaScript Hooks** — AI-generated hooks for any function, 20+ built-in presets (eval, crypto, atob, WebAssembly, etc.)
- **Code Analysis** — Deobfuscation (JScrambler, JSVMP, packer), crypto algorithm detection, LLM-powered understanding
- **CAPTCHA Handling** — AI vision detection, manual solve flow, configurable polling
- **Stealth Injection** — Anti-detection patches for headless browser fingerprinting
- **Performance** — Smart caching, token budget management, code coverage

## Requirements

- Node.js >= 18
- pnpm

## Installation

```bash
pnpm install
pnpm build
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_LLM_PROVIDER` | `openai` or `anthropic` | `openai` |
| `OPENAI_API_KEY` | OpenAI (or compatible) API key | — |
| `OPENAI_BASE_URL` | Base URL for OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model name | `gpt-4-turbo-preview` |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `PUPPETEER_HEADLESS` | Run browser in headless mode | `true` |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |

## MCP Client Setup

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "jshhookmcp": {
      "command": "node",
      "args": ["path/to/jshhookmcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-key",
        "OPENAI_BASE_URL": "https://api.openai.com/v1",
        "OPENAI_MODEL": "gpt-4-turbo-preview"
      }
    }
  }
}
```

## Tool Domains

### Browser (45 tools)

Browser lifecycle, page navigation, DOM interaction, form input, screenshots, scripts, cookies, and storage.

| Tool | Description |
|------|-------------|
| `browser_launch` | Launch a Chromium browser instance |
| `browser_close` | Close the browser |
| `browser_status` | Get current browser/page status |
| `page_navigate` | Navigate to a URL |
| `page_click` | Click a DOM element |
| `page_type` | Type text into an input |
| `page_evaluate` | Execute JavaScript in page context |
| `page_screenshot` | Capture a screenshot |
| `dom_query_selector` | Query a single element |
| `dom_query_all` | Query all matching elements |
| `captcha_detect` | AI-powered CAPTCHA detection |
| `captcha_wait` | Wait for manual CAPTCHA solving |
| `stealth_inject` | Inject anti-detection patches |
| ... | 32 more browser tools |

### Debugger (37 tools)

Chrome DevTools Protocol debugger: breakpoints, stepping, scope inspection, watch expressions, XHR/event breakpoints, session persistence.

| Tool | Description |
|------|-------------|
| `debugger_enable` | Enable the CDP debugger |
| `debugger_pause` | Pause execution |
| `debugger_resume` | Resume execution |
| `debugger_step_into` | Step into next call |
| `breakpoint_set` | Set a breakpoint |
| `get_call_stack` | Get current call stack |
| `debugger_evaluate` | Evaluate expression at paused frame |
| `get_scope_variables_enhanced` | Deep scope variable inspection |
| `watch_add` | Add a watch expression |
| `xhr_breakpoint_set` | Break on XHR URL pattern |
| `debugger_save_session` | Save debug session to file |
| `debugger_load_session` | Restore a saved session |
| ... | 25 more debugger tools |

### Network (15 tools)

CDP-based network monitoring, request/response capture, statistics, and console injection.

| Tool | Description |
|------|-------------|
| `network_enable` | Enable network monitoring |
| `network_get_requests` | List captured requests |
| `network_get_response_body` | Get response body by request ID |
| `network_get_stats` | Aggregated request statistics |
| `performance_get_metrics` | Page performance metrics |
| `performance_start_coverage` | Start code coverage recording |
| `console_inject_xhr_interceptor` | Inject XHR interceptor |
| `console_inject_fetch_interceptor` | Inject fetch interceptor |
| ... | 7 more network tools |

### Hooks (8 tools)

AI-generated JavaScript hooks and 20+ built-in presets for intercepting browser APIs.

| Tool | Description |
|------|-------------|
| `ai_hook_generate` | Generate a hook for a URL/function pattern |
| `ai_hook_inject` | Inject a generated hook into the page |
| `ai_hook_get_data` | Retrieve captured hook data |
| `ai_hook_list` | List all active hooks |
| `ai_hook_toggle` | Enable or disable a hook |
| `ai_hook_export` | Export hook data as JSON or HAR |
| `hook_preset` | Install a built-in preset hook |

**Built-in presets:** `eval`, `function-constructor`, `atob-btoa`, `crypto-subtle`, `json-stringify`, `object-defineproperty`, `settimeout`, `setinterval`, `addeventlistener`, `postmessage`, `webassembly`, `proxy`, `reflect`, `history-pushstate`, `location-href`, `navigator-useragent`, `eventsource`, `window-open`, `mutationobserver`, `formdata`

### Analysis (11 tools)

LLM-powered code collection, deobfuscation, crypto detection, and hook management.

| Tool | Description |
|------|-------------|
| `collect_code` | Collect JavaScript from a page |
| `search_in_scripts` | Search collected scripts for a pattern |
| `deobfuscate` | LLM-assisted code deobfuscation |
| `advanced_deobfuscate` | Deep deobfuscation with AST optimization |
| `understand_code` | LLM code explanation |
| `detect_crypto` | Identify crypto algorithms in code |
| `detect_obfuscation` | Identify obfuscation techniques |
| `extract_function_tree` | Extract a function and its dependencies |
| `manage_hooks` | Create/list/clear browser hooks |

### Maintenance (6 tools)

Token budget tracking and cache management.

| Tool | Description |
|------|-------------|
| `get_token_budget_stats` | Token usage statistics |
| `manual_token_cleanup` | Trim token budget |
| `reset_token_budget` | Reset token budget |
| `get_cache_stats` | Cache usage statistics |
| `smart_cache_cleanup` | Evict stale cache entries |
| `clear_all_caches` | Purge all caches |

## License

MIT
