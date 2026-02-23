import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const debuggerTools: Tool[] = [
  {
    name: 'debugger_enable',
    description: 'Enable the debugger (must be called before setting breakpoints)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_disable',
    description: 'Disable the debugger and clear all breakpoints',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_pause',
    description: 'Pause execution at the next statement',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_resume',
    description: 'Resume execution (continue)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_step_into',
    description: 'Step into the next function call',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_step_over',
    description: 'Step over the next function call',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_step_out',
    description: 'Step out of the current function',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'breakpoint_set',
    description:
      'Set a breakpoint at a specific location. Supports URL-based and scriptId-based breakpoints with optional conditions.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the script (e.g., "app.js", "https://cdn.example.com/app.js")',
        },
        scriptId: {
          type: 'string',
          description: 'Script ID (alternative to URL, get from get_all_scripts)',
        },
        lineNumber: {
          type: 'number',
          description: 'Line number (0-based)',
        },
        columnNumber: {
          type: 'number',
          description: 'Column number (0-based, optional)',
        },
        condition: {
          type: 'string',
          description: 'Conditional breakpoint expression (e.g., "x > 100")',
        },
      },
      required: ['lineNumber'],
    },
  },

  {
    name: 'breakpoint_remove',
    description: 'Remove a breakpoint by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        breakpointId: {
          type: 'string',
          description: 'Breakpoint ID (from breakpoint_set or breakpoint_list)',
        },
      },
      required: ['breakpointId'],
    },
  },

  {
    name: 'breakpoint_list',
    description: 'List all active breakpoints',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'get_call_stack',
    description: 'Get the current call stack (only available when paused at a breakpoint)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'debugger_evaluate',
    description:
      'Evaluate an expression in the context of the current call frame (only when paused)',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to evaluate (e.g., "x + y", "user.name")',
        },
        callFrameId: {
          type: 'string',
          description: 'Call frame ID (from get_call_stack, defaults to current frame)',
        },
      },
      required: ['expression'],
    },
  },

  {
    name: 'debugger_evaluate_global',
    description: 'Evaluate an expression in the global context (does not require paused state)',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to evaluate',
        },
      },
      required: ['expression'],
    },
  },

  {
    name: 'debugger_wait_for_paused',
    description:
      'Wait for the debugger to pause (useful after setting breakpoints and triggering code)',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
          default: 30000,
        },
      },
    },
  },

  {
    name: 'debugger_get_paused_state',
    description: 'Get the current paused state (check if debugger is paused and why)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'breakpoint_set_on_exception',
    description: 'Pause on exceptions (all exceptions or only uncaught)',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          description: 'Exception pause state',
          enum: ['none', 'uncaught', 'all'],
          default: 'none',
        },
      },
      required: ['state'],
    },
  },

  {
    name: 'get_object_properties',
    description: 'Get all properties of an object (when paused, use objectId from variables)',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'string',
          description: 'Object ID (from get_scope_variables)',
        },
      },
      required: ['objectId'],
    },
  },

  {
    name: 'get_scope_variables_enhanced',
    description: `Enhanced scope variable inspection with deep object traversal.

Improvements over get_scope_variables:
1. Graceful error handling for "Could not find object" errors (retries with fallback)
2. Configurable object property expansion
3. Adjustable traversal depth
4. Selective error skipping

Use cases:
- Inspect complex nested objects
- Debug variable state in async/closure scopes
- Examine prototype chains

Examples:
get_scope_variables_enhanced()
get_scope_variables_enhanced(callFrameId="xxx", includeObjectProperties=true)`,
    inputSchema: {
      type: 'object',
      properties: {
        callFrameId: {
          type: 'string',
          description: 'Call frame ID (from get_call_stack, defaults to current frame)',
        },
        includeObjectProperties: {
          type: 'boolean',
          description: 'Expand object properties recursively (default: false)',
          default: false,
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum traversal depth for nested objects (default: 1)',
          default: 1,
        },
        skipErrors: {
          type: 'boolean',
          description: 'Skip properties that throw errors during access (default: true)',
          default: true,
        },
      },
    },
  },

  {
    name: 'debugger_save_session',
    description: `Save the current debugging session to a JSON file for later restoration.

Captures:
- All active breakpoints (location, condition, action)
- Watch expressions
- Blackboxed script patterns

Saved to:
- Default: ./debugger-sessions/<timestamp>.json
- Custom: specified filePath

Examples:
debugger_save_session()
debugger_save_session(filePath="my-debug-session.json", metadata={description: "Login flow debugging"})`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Output file path (defaults to ./debugger-sessions/<timestamp>.json)',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata to attach (e.g., description, tags)',
        },
      },
    },
  },

  {
    name: 'debugger_load_session',
    description: `Load a previously saved debugging session to restore breakpoints and watches.

Two input modes:
1. File path: provide filePath to load from disk
2. Inline JSON: provide sessionData as JSON string

Restores:
- Breakpoints with original conditions
- Watch expressions
- Blackboxed patterns

Examples:
debugger_load_session(filePath="my-debug-session.json")
debugger_load_session(sessionData="{...}")`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the saved session file',
        },
        sessionData: {
          type: 'string',
          description: 'Session JSON string (alternative to filePath)',
        },
      },
    },
  },

  {
    name: 'debugger_export_session',
    description: `Export the current debugging session as a JSON string for sharing or backup.

Returns session data as JSON, including:
- Active breakpoints
- Watch expressions
- Blackboxed patterns

Examples:
debugger_export_session()
debugger_export_session(metadata={description: "API debugging session"})`,
    inputSchema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          description: 'Optional metadata to include in the export',
        },
      },
    },
  },

  {
    name: 'debugger_list_sessions',
    description: `List all saved debugging sessions in the ./debugger-sessions/ directory.

Returns for each session:
- File name and path
- Creation timestamp
- Attached metadata (if any)

Use cases:
- Browse available sessions to restore
- Clean up old sessions

Examples:
debugger_list_sessions()`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'watch_add',
    description: ` Add a watch expression to monitor variable values

Usage:
- Monitor key variables during debugging
- Automatically evaluate on each pause
- Track value changes over time

Example:
watch_add(expression="window.byted_acrawler", name="acrawler")`,
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to watch (e.g., "window.obj", "arguments[0]")',
        },
        name: {
          type: 'string',
          description: 'Optional friendly name for the watch expression',
        },
      },
      required: ['expression'],
    },
  },

  {
    name: 'watch_remove',
    description: 'Remove a watch expression by ID',
    inputSchema: {
      type: 'object',
      properties: {
        watchId: {
          type: 'string',
          description: 'Watch expression ID (from watch_add or watch_list)',
        },
      },
      required: ['watchId'],
    },
  },

  {
    name: 'watch_list',
    description: 'List all watch expressions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'watch_evaluate_all',
    description: `Evaluate all enabled watch expressions

Returns:
- Current values of all watch expressions
- Value change indicators
- Error information if evaluation fails

Best used when paused at a breakpoint.`,
    inputSchema: {
      type: 'object',
      properties: {
        callFrameId: {
          type: 'string',
          description: 'Optional call frame ID (from get_call_stack)',
        },
      },
    },
  },

  {
    name: 'watch_clear_all',
    description: 'Clear all watch expressions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'xhr_breakpoint_set',
    description: ` Set XHR/Fetch breakpoint (pause before network requests)

Usage:
- Intercept API calls
- Debug request parameter generation
- Trace network request logic

Supports wildcard patterns:
- "*api*" - matches any URL containing "api"
- "*/aweme/v1/*" - matches specific API path
- "*" - matches all requests

Example:
xhr_breakpoint_set(urlPattern="*aweme/v1/*")`,
    inputSchema: {
      type: 'object',
      properties: {
        urlPattern: {
          type: 'string',
          description: 'URL pattern (supports wildcards *)',
        },
      },
      required: ['urlPattern'],
    },
  },

  {
    name: 'xhr_breakpoint_remove',
    description: 'Remove XHR breakpoint by ID',
    inputSchema: {
      type: 'object',
      properties: {
        breakpointId: {
          type: 'string',
          description: 'XHR breakpoint ID',
        },
      },
      required: ['breakpointId'],
    },
  },

  {
    name: 'xhr_breakpoint_list',
    description: 'List all XHR breakpoints',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'event_breakpoint_set',
    description: ` Set event listener breakpoint (pause on event)

Common event names:
- Mouse: click, dblclick, mousedown, mouseup, mousemove
- Keyboard: keydown, keyup, keypress
- Timer: setTimeout, setInterval, requestAnimationFrame
- WebSocket: message, open, close, error

Example:
event_breakpoint_set(eventName="click")
event_breakpoint_set(eventName="setTimeout")`,
    inputSchema: {
      type: 'object',
      properties: {
        eventName: {
          type: 'string',
          description: 'Event name (e.g., "click", "setTimeout")',
        },
        targetName: {
          type: 'string',
          description: 'Optional target name (e.g., "WebSocket")',
        },
      },
      required: ['eventName'],
    },
  },

  {
    name: 'event_breakpoint_set_category',
    description: `Set breakpoints for entire event category

Categories:
- mouse: All mouse events (click, mousedown, etc.)
- keyboard: All keyboard events (keydown, keyup, etc.)
- timer: All timer events (setTimeout, setInterval, etc.)
- websocket: All WebSocket events (message, open, etc.)

Example:
event_breakpoint_set_category(category="mouse")`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['mouse', 'keyboard', 'timer', 'websocket'],
          description: 'Event category',
        },
      },
      required: ['category'],
    },
  },

  {
    name: 'event_breakpoint_remove',
    description: 'Remove event breakpoint by ID',
    inputSchema: {
      type: 'object',
      properties: {
        breakpointId: {
          type: 'string',
          description: 'Event breakpoint ID',
        },
      },
      required: ['breakpointId'],
    },
  },

  {
    name: 'event_breakpoint_list',
    description: 'List all event breakpoints',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'blackbox_add',
    description: ` Blackbox scripts (skip during debugging)

Usage:
- Skip third-party library code
- Focus on business logic
- Improve debugging efficiency

Common patterns:
- "*jquery*.js" - jQuery
- "*react*.js" - React
- "*node_modules/*" - All npm packages
- "*webpack*" - Webpack bundles

Example:
blackbox_add(urlPattern="*node_modules/*")`,
    inputSchema: {
      type: 'object',
      properties: {
        urlPattern: {
          type: 'string',
          description: 'URL pattern to blackbox (supports wildcards *)',
        },
      },
      required: ['urlPattern'],
    },
  },

  {
    name: 'blackbox_add_common',
    description: `Blackbox all common libraries (one-click)

Includes:
- jquery, react, vue, angular
- lodash, underscore, moment
- webpack, node_modules, vendor bundles

Example:
blackbox_add_common()`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'blackbox_list',
    description: 'List all blackboxed patterns',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
