import type { DebuggerManager } from '../../../modules/debugger/DebuggerManager.js';
import type { RuntimeInspector } from '../../../modules/debugger/RuntimeInspector.js';

export class DebuggerToolHandlers {
  constructor(
    private debuggerManager: DebuggerManager,
    private runtimeInspector: RuntimeInspector
  ) {}

  async handleDebuggerEnable(_args: Record<string, unknown>) {
    await this.debuggerManager.init();
    await this.runtimeInspector.init();
    await this.debuggerManager.initAdvancedFeatures(this.runtimeInspector);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Debugger enabled',
              enabled: this.debuggerManager.isEnabled(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerDisable(_args: Record<string, unknown>) {
    await this.debuggerManager.disable();
    await this.runtimeInspector.disable();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Debugger disabled',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerPause(_args: Record<string, unknown>) {
    await this.debuggerManager.pause();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Execution paused',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerResume(_args: Record<string, unknown>) {
    await this.debuggerManager.resume();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Execution resumed',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerStepInto(_args: Record<string, unknown>) {
    await this.debuggerManager.stepInto();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Stepped into',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerStepOver(_args: Record<string, unknown>) {
    await this.debuggerManager.stepOver();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Stepped over',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerStepOut(_args: Record<string, unknown>) {
    await this.debuggerManager.stepOut();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Stepped out',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleBreakpointSet(args: Record<string, unknown>) {
    const url = args.url as string | undefined;
    const scriptId = args.scriptId as string | undefined;
    const lineNumber = args.lineNumber as number;
    const columnNumber = args.columnNumber as number | undefined;
    const condition = args.condition as string | undefined;

    let breakpoint;

    if (url) {
      breakpoint = await this.debuggerManager.setBreakpointByUrl({
        url,
        lineNumber,
        columnNumber,
        condition,
      });
    } else if (scriptId) {
      breakpoint = await this.debuggerManager.setBreakpoint({
        scriptId,
        lineNumber,
        columnNumber,
        condition,
      });
    } else {
      throw new Error('Either url or scriptId must be provided');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              breakpoint: {
                breakpointId: breakpoint.breakpointId,
                location: breakpoint.location,
                condition: breakpoint.condition,
                enabled: breakpoint.enabled,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleBreakpointRemove(args: Record<string, unknown>) {
    const breakpointId = args.breakpointId as string;

    await this.debuggerManager.removeBreakpoint(breakpointId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Breakpoint ${breakpointId} removed`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleBreakpointList(_args: Record<string, unknown>) {
    const breakpoints = this.debuggerManager.listBreakpoints();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: breakpoints.length,
              breakpoints: breakpoints.map((bp) => ({
                breakpointId: bp.breakpointId,
                location: bp.location,
                condition: bp.condition,
                enabled: bp.enabled,
                hitCount: bp.hitCount,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleGetCallStack(_args: Record<string, unknown>) {
    const callStack = await this.runtimeInspector.getCallStack();

    if (!callStack) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Not in paused state. Set a breakpoint and trigger it first.',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              callStack: {
                frameCount: callStack.callFrames.length,
                reason: callStack.reason,
                frames: callStack.callFrames.map((frame, index) => ({
                  index,
                  callFrameId: frame.callFrameId,
                  functionName: frame.functionName,
                  location: `${frame.location.url}:${frame.location.lineNumber}:${frame.location.columnNumber}`,
                  scopeCount: frame.scopeChain.length,
                })),
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerEvaluate(args: Record<string, unknown>) {
    const expression = args.expression as string;
    const callFrameId = args.callFrameId as string | undefined;

    const result = await this.runtimeInspector.evaluate(expression, callFrameId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              expression,
              result,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerEvaluateGlobal(args: Record<string, unknown>) {
    const expression = args.expression as string;

    const result = await this.runtimeInspector.evaluateGlobal(expression);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              expression,
              result,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDebuggerWaitForPaused(args: Record<string, unknown>) {
    const timeout = (args.timeout as number) || 30000;

    try {
      const pausedState = await this.debuggerManager.waitForPaused(timeout);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                paused: true,
                reason: pausedState.reason,
                location: pausedState.callFrames[0]?.location,
                hitBreakpoints: pausedState.hitBreakpoints,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                paused: false,
                message: 'Timeout waiting for paused event',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleDebuggerGetPausedState(_args: Record<string, unknown>) {
    const pausedState = this.debuggerManager.getPausedState();

    if (!pausedState) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                paused: false,
                message: 'Debugger is not paused',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              paused: true,
              reason: pausedState.reason,
              frameCount: pausedState.callFrames.length,
              topFrame: {
                functionName: pausedState.callFrames[0]?.functionName,
                location: pausedState.callFrames[0]?.location,
              },
              hitBreakpoints: pausedState.hitBreakpoints,
              timestamp: pausedState.timestamp,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleGetObjectProperties(args: Record<string, unknown>) {
    const objectId = args.objectId as string;

    const properties = await this.runtimeInspector.getObjectProperties(objectId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              propertyCount: properties.length,
              properties: properties.map((p) => ({
                name: p.name,
                value: p.value,
                type: p.type,
                objectId: p.objectId,
                description: p.description,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleBreakpointSetOnException(args: Record<string, unknown>) {
    const state = (args.state as 'none' | 'uncaught' | 'all') || 'none';

    await this.debuggerManager.setPauseOnExceptions(state);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Pause on exceptions set to: ${state}`,
              state,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleGetScopeVariablesEnhanced(args: Record<string, unknown>) {
    const callFrameId = args.callFrameId as string | undefined;
    const includeObjectProperties = args.includeObjectProperties as boolean | undefined;
    const maxDepth = args.maxDepth as number | undefined;
    const skipErrors = args.skipErrors !== false;

    try {
      const result = await this.debuggerManager.getScopeVariables({
        callFrameId,
        includeObjectProperties,
        maxDepth,
        skipErrors,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: error.message || 'Failed to get scope variables',
                error: String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleSaveSession(args: Record<string, unknown>) {
    const filePath = args.filePath as string | undefined;
    const metadata = args.metadata as any | undefined;

    try {
      const savedPath = await this.debuggerManager.saveSession(filePath, metadata);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Session saved successfully',
                filePath: savedPath,
                breakpointCount: this.debuggerManager.listBreakpoints().length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to save session',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleLoadSession(args: Record<string, unknown>) {
    const filePath = args.filePath as string | undefined;
    const sessionData = args.sessionData as string | undefined;

    try {
      if (filePath) {
        await this.debuggerManager.loadSessionFromFile(filePath);
      } else if (sessionData) {
        await this.debuggerManager.importSession(sessionData);
      } else {
        throw new Error('Either filePath or sessionData must be provided');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Session loaded successfully',
                breakpointCount: this.debuggerManager.listBreakpoints().length,
                pauseOnExceptions: this.debuggerManager.getPauseOnExceptionsState(),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to load session',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleExportSession(args: Record<string, unknown>) {
    const metadata = args.metadata as any | undefined;

    try {
      const session = this.debuggerManager.exportSession(metadata);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Session exported successfully',
                session,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to export session',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleListSessions(_args: Record<string, unknown>) {
    try {
      const sessions = await this.debuggerManager.listSavedSessions();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: sessions.length,
                sessions: sessions.map((s) => ({
                  path: s.path,
                  timestamp: s.timestamp,
                  date: new Date(s.timestamp).toISOString(),
                  metadata: s.metadata,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to list sessions',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleWatchAdd(args: Record<string, unknown>) {
    try {
      const expression = args.expression as string;
      const name = args.name as string | undefined;

      const watchManager = this.debuggerManager.getWatchManager();
      const watchId = watchManager.addWatch(expression, name);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Watch expression added',
                watchId,
                expression,
                name: name || expression,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to add watch expression',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleWatchRemove(args: Record<string, unknown>) {
    try {
      const watchId = args.watchId as string;
      const watchManager = this.debuggerManager.getWatchManager();
      const removed = watchManager.removeWatch(watchId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: removed,
                message: removed ? 'Watch expression removed' : 'Watch expression not found',
                watchId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to remove watch expression',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleWatchList(_args: Record<string, unknown>) {
    try {
      const watchManager = this.debuggerManager.getWatchManager();
      const watches = watchManager.getAllWatches();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Found ${watches.length} watch expression(s)`,
                watches,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to list watch expressions',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleWatchEvaluateAll(args: Record<string, unknown>) {
    try {
      const callFrameId = args.callFrameId as string | undefined;
      const watchManager = this.debuggerManager.getWatchManager();
      const results = await watchManager.evaluateAll(callFrameId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Evaluated ${results.length} watch expression(s)`,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to evaluate watch expressions',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleWatchClearAll(_args: Record<string, unknown>) {
    try {
      const watchManager = this.debuggerManager.getWatchManager();
      watchManager.clearAll();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'All watch expressions cleared',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to clear watch expressions',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleXHRBreakpointSet(args: Record<string, unknown>) {
    try {
      const urlPattern = args.urlPattern as string;
      const xhrManager = this.debuggerManager.getXHRManager();
      const breakpointId = await xhrManager.setXHRBreakpoint(urlPattern);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'XHR breakpoint set',
                breakpointId,
                urlPattern,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to set XHR breakpoint',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleXHRBreakpointRemove(args: Record<string, unknown>) {
    try {
      const breakpointId = args.breakpointId as string;
      const xhrManager = this.debuggerManager.getXHRManager();
      const removed = await xhrManager.removeXHRBreakpoint(breakpointId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: removed,
                message: removed ? 'XHR breakpoint removed' : 'XHR breakpoint not found',
                breakpointId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to remove XHR breakpoint',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleXHRBreakpointList(_args: Record<string, unknown>) {
    try {
      const xhrManager = this.debuggerManager.getXHRManager();
      const breakpoints = xhrManager.getAllXHRBreakpoints();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Found ${breakpoints.length} XHR breakpoint(s)`,
                breakpoints,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to list XHR breakpoints',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleEventBreakpointSet(args: Record<string, unknown>) {
    try {
      const eventName = args.eventName as string;
      const targetName = args.targetName as string | undefined;
      const eventManager = this.debuggerManager.getEventManager();
      const breakpointId = await eventManager.setEventListenerBreakpoint(eventName, targetName);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Event breakpoint set',
                breakpointId,
                eventName,
                targetName,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to set event breakpoint',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleEventBreakpointSetCategory(args: Record<string, unknown>) {
    try {
      const category = args.category as 'mouse' | 'keyboard' | 'timer' | 'websocket';
      const eventManager = this.debuggerManager.getEventManager();

      let breakpointIds: string[];
      switch (category) {
        case 'mouse':
          breakpointIds = await eventManager.setMouseEventBreakpoints();
          break;
        case 'keyboard':
          breakpointIds = await eventManager.setKeyboardEventBreakpoints();
          break;
        case 'timer':
          breakpointIds = await eventManager.setTimerEventBreakpoints();
          break;
        case 'websocket':
          breakpointIds = await eventManager.setWebSocketEventBreakpoints();
          break;
        default:
          throw new Error(`Unknown category: ${category}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Set ${breakpointIds.length} ${category} event breakpoint(s)`,
                category,
                breakpointIds,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to set event breakpoints',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleEventBreakpointRemove(args: Record<string, unknown>) {
    try {
      const breakpointId = args.breakpointId as string;
      const eventManager = this.debuggerManager.getEventManager();
      const removed = await eventManager.removeEventListenerBreakpoint(breakpointId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: removed,
                message: removed ? 'Event breakpoint removed' : 'Event breakpoint not found',
                breakpointId,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to remove event breakpoint',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleEventBreakpointList(_args: Record<string, unknown>) {
    try {
      const eventManager = this.debuggerManager.getEventManager();
      const breakpoints = eventManager.getAllEventBreakpoints();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Found ${breakpoints.length} event breakpoint(s)`,
                breakpoints,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to list event breakpoints',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleBlackboxAdd(args: Record<string, unknown>) {
    try {
      const urlPattern = args.urlPattern as string;
      const blackboxManager = this.debuggerManager.getBlackboxManager();
      await blackboxManager.blackboxByPattern(urlPattern);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Pattern blackboxed',
                urlPattern,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to blackbox pattern',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleBlackboxAddCommon(_args: Record<string, unknown>) {
    try {
      const blackboxManager = this.debuggerManager.getBlackboxManager();
      await blackboxManager.blackboxCommonLibraries();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Common libraries blackboxed',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to blackbox common libraries',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleBlackboxList(_args: Record<string, unknown>) {
    try {
      const blackboxManager = this.debuggerManager.getBlackboxManager();
      const patterns = blackboxManager.getAllBlackboxedPatterns();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Found ${patterns.length} blackboxed pattern(s)`,
                patterns,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Failed to list blackboxed patterns',
                error: error.message || String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
}
