import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type ToolArgs = Record<string, unknown>;
export type ToolResponse = CallToolResult;
export type ToolHandler = (args: ToolArgs) => Promise<ToolResponse>;
