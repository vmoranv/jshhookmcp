# jshhookmcp overview
- Purpose: MCP server for browser-focused JavaScript analysis, debugging, hooking, and deobfuscation workflows.
- Runtime: Node.js + TypeScript, stdio transport via @modelcontextprotocol/sdk.
- Main entry: src/index.ts -> src/server/MCPServer.ts.
- Server architecture: tool catalog + tool router + domain handlers (browser/debugger/advanced/AI hook/core analysis/core maintenance).
- Key modules: collector, debugger, monitor, hook, deobfuscator, analyzer, crypto, emulator.
- LLM integration: src/services/LLMService.ts (OpenAI/Anthropic configurable).
- Cache/context: TokenBudgetManager + UnifiedCacheManager + adapters.