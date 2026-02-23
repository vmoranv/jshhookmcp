import { allTools } from '../src/server/ToolCatalog.js';
import { HANDLED_TOOL_NAMES } from '../src/server/ToolHandlerMap.js';

function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
}

const toolNames = allTools.map((tool) => tool.name);
const uniqueToolNames = new Set(toolNames);

if (uniqueToolNames.size !== toolNames.length) {
  const duplicates = toolNames.filter((name, index) => toolNames.indexOf(name) !== index);
  exitWithError(`Duplicate tool definitions found: ${Array.from(new Set(duplicates)).join(', ')}`);
}

const missingHandlers = toolNames.filter((name) => !HANDLED_TOOL_NAMES.has(name));
if (missingHandlers.length > 0) {
  exitWithError(`Missing handlers for tools: ${missingHandlers.join(', ')}`);
}

const orphanHandlers = Array.from(HANDLED_TOOL_NAMES).filter(
  (name) => !uniqueToolNames.has(name),
);
if (orphanHandlers.length > 0) {
  exitWithError(`Handlers without tool definitions: ${orphanHandlers.join(', ')}`);
}

console.log(`Verification passed: ${toolNames.length} tools with matching handlers.`);
