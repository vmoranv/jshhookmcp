import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Note: CTF tools have been reorganized into more appropriate domains:
// - webpack_enumerate, source_map_extract -> analysis domain
// - framework_state_extract, indexeddb_dump -> browser domain
// - electron_attach -> process domain
// This file is kept for backward compatibility and future CTF-specific tools.

export const ctfTools: Tool[] = [
  // Placeholder for future CTF-specific tools that don't fit other domains
];
