# Style and conventions
- Language: TypeScript ES modules, strict compiler settings in tsconfig.
- Patterns: domain handlers per tool group, centralized tool catalog and execution router.
- MCP response shape: JSON text payload in `content[0].text`, `isError` for failures.
- Keep public tool names stable; avoid breaking MCP tool contracts.
- Prefer concise, production-oriented logging and avoid noisy comments/hype text.
- Keep server files focused by responsibility (catalog, router, handlers, lifecycle).