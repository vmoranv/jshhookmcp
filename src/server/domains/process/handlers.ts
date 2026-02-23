/**
 * Process Manager Tool Handlers
 * Implements the MCP tool handlers for cross-platform process management
 */

import { UnifiedProcessManager, MemoryManager } from '../../../modules/process/index.js';
import { logger } from '../../../utils/logger.js';

export class ProcessToolHandlers {
  private processManager: UnifiedProcessManager;
  private memoryManager: MemoryManager;
  private platform: string;

  constructor() {
    this.processManager = new UnifiedProcessManager();
    this.memoryManager = new MemoryManager();
    this.platform = this.processManager.getPlatform();
    logger.info(`ProcessToolHandlers initialized for platform: ${this.platform}`);
  }

  async handleProcessFind(args: Record<string, unknown>) {
    try {
      const pattern = args.pattern as string;
      const processes = await this.processManager.findProcesses(pattern);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                pattern,
                count: processes.length,
                processes: processes.map((p: any) => ({
                  pid: p.pid,
                  name: p.name,
                  path: p.executablePath,
                  windowTitle: p.windowTitle,
                  windowHandle: p.windowHandle,
                  memoryMB: p.memoryUsage ? Math.round(p.memoryUsage / 1024 / 1024) : undefined,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Process find failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleProcessGet(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const process = await this.processManager.getProcessByPid(pid);

      if (!process) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `Process with PID ${pid} not found`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const cmdLine = await this.processManager.getProcessCommandLine(pid);
      const debugPort = await this.processManager.checkDebugPort(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                process: {
                  ...process,
                  commandLine: cmdLine.commandLine,
                  parentPid: cmdLine.parentPid,
                  debugPort,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Process get failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleProcessWindows(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const windows = await this.processManager.getProcessWindows(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                pid,
                windowCount: windows.length,
                windows: windows.map((w: any) => ({
                  handle: w.handle,
                  title: w.title,
                  className: w.className,
                  processId: w.processId,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Process windows failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleProcessFindWeChatAppEx(_args: Record<string, unknown>) {
    try {
      const result = await this.processManager.findBrowserProcesses();

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: 'Browser process detection not supported on this platform',
                  platform: this.platform,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Normalize platform-specific results
      const isWindows = this.platform === 'win32';
      const mainProcess = result.mainProcess;
      const renderers = result.rendererProcesses || [];
      const gpuProcess = result.gpuProcess;
      const utilityProcesses = result.utilityProcesses || [];
      // Type-safe access to platform-specific properties
      const targetWindow = isWindows
        ? (result as any).gameWindow
        : (result as any).targetWindow;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                platform: this.platform,
                browser: {
                  mainProcess: mainProcess ? {
                    pid: mainProcess.pid,
                    name: mainProcess.name,
                    path: mainProcess.executablePath,
                  } : null,
                  rendererCount: renderers.length,
                  renderers: renderers.map((p: any) => ({
                    pid: p.pid,
                    commandLine: p.commandLine?.substring(0, 200),
                  })),
                  gpuProcess: gpuProcess ? {
                    pid: gpuProcess.pid,
                  } : null,
                  utilityCount: utilityProcesses.length,
                  targetWindow: targetWindow ? {
                    handle: targetWindow.handle,
                    title: targetWindow.title,
                    className: targetWindow.className,
                  } : null,
                },
                summary: {
                  totalProcesses: (mainProcess ? 1 : 0) +
                    renderers.length +
                    (gpuProcess ? 1 : 0) +
                    utilityProcesses.length,
                  hasTargetWindow: !!targetWindow,
                  targetWindowTitle: targetWindow?.title,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Find browser processes failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleProcessCheckDebugPort(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const debugPort = await this.processManager.checkDebugPort(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                pid,
                debugPort,
                canAttach: debugPort !== null,
                attachUrl: debugPort ? `http://localhost:${debugPort}` : null,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Check debug port failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleProcessLaunchDebug(args: Record<string, unknown>) {
    try {
      const executablePath = args.executablePath as string;
      const debugPort = (args.debugPort as number) || 9222;
      const argsList = (args.args as string[]) || [];

      const process = await this.processManager.launchWithDebug(executablePath, debugPort, argsList);

      if (!process) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: 'Failed to launch process',
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
                process: {
                  pid: process.pid,
                  name: process.name,
                  path: process.executablePath,
                },
                debugPort,
                attachUrl: `http://localhost:${debugPort}`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Launch debug failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleProcessKill(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const killed = await this.processManager.killProcess(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: killed,
                pid,
                message: killed ? `Process ${pid} killed successfully` : `Failed to kill process ${pid}`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Process kill failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryRead(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const address = args.address as string;
      const size = args.size as number;

      // Check availability first
      const availability = await this.memoryManager.checkAvailability();
      if (!availability.available) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: 'Memory operations not available',
                  reason: availability.reason,
                  platform: this.platform,
                  requestedAddress: address,
                  requestedSize: size,
                  pid,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await this.memoryManager.readMemory(pid, address, size);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: result.success,
                data: result.data,
                error: result.error,
                pid,
                address,
                size,
                platform: this.platform,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory read failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryWrite(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const address = args.address as string;
      const data = args.data as string;
      const encoding = (args.encoding as 'hex' | 'base64') || 'hex';

      // Check availability first
      const availability = await this.memoryManager.checkAvailability();
      if (!availability.available) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: 'Memory operations not available',
                  reason: availability.reason,
                  platform: this.platform,
                  requestedAddress: address,
                  dataLength: data.length,
                  encoding,
                  pid,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await this.memoryManager.writeMemory(pid, address, data, encoding);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: result.success,
                bytesWritten: result.bytesWritten,
                error: result.error,
                pid,
                address,
                dataLength: data.length,
                encoding,
                platform: this.platform,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory write failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryScan(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const pattern = args.pattern as string;
      const patternType = (args.patternType as string) || 'hex';

      // Check availability first
      const availability = await this.memoryManager.checkAvailability();
      if (!availability.available) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: 'Memory operations not available',
                  reason: availability.reason,
                  platform: this.platform,
                  requestedPattern: pattern,
                  patternType,
                  pid,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await this.memoryManager.scanMemory(pid, pattern, patternType as any);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: result.success,
                addresses: result.addresses,
                error: result.error,
                pid,
                pattern,
                patternType,
                platform: this.platform,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory scan failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  // Advanced memory operation handlers

  async handleMemoryCheckProtection(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const address = args.address as string;

      const result = await this.memoryManager.checkMemoryProtection(pid, address);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory check protection failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryScanFiltered(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const pattern = args.pattern as string;
      const addresses = args.addresses as string[];
      const patternType = (args.patternType as string) || 'hex';

      const result = await this.memoryManager.scanMemoryFiltered(pid, pattern, addresses, patternType as any);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory scan filtered failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryBatchWrite(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const patches = args.patches as { address: string; data: string; encoding?: 'hex' | 'base64' }[];

      const result = await this.memoryManager.batchMemoryWrite(pid, patches);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory batch write failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryDumpRegion(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const address = args.address as string;
      const size = args.size as number;
      const outputPath = args.outputPath as string;

      const result = await this.memoryManager.dumpMemoryRegion(pid, address, size, outputPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory dump region failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleMemoryListRegions(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;

      const result = await this.memoryManager.enumerateRegions(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Memory list regions failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  // Injection handlers

  async handleInjectDll(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const dllPath = args.dllPath as string;

      const result = await this.memoryManager.injectDll(pid, dllPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('DLL injection failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleInjectShellcode(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;
      const shellcode = args.shellcode as string;
      const encoding = (args.encoding as 'hex' | 'base64') || 'hex';

      const result = await this.memoryManager.injectShellcode(pid, shellcode, encoding);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Shellcode injection failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  // Anti-detection handlers

  async handleCheckDebugPort(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;

      const result = await this.memoryManager.checkDebugPort(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Debug port check failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleEnumerateModules(args: Record<string, unknown>) {
    try {
      const pid = args.pid as number;

      const result = await this.memoryManager.enumerateModules(pid);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Module enumeration failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: false, error: error instanceof Error ? error.message : String(error) },
              null,
              2
            ),
          },
        ],
      };
    }
  }
}
