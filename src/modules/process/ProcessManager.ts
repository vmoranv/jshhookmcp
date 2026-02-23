/**
 * Windows Process Manager - Utilities for process enumeration, window handle management,
 * and process attachment for debugging purposes.
 *
 * Supports: WeChatAppEx (微信小程序), general Windows processes
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  name: string;
  executablePath?: string;
  commandLine?: string;
  windowTitle?: string;
  windowHandle?: string;
  parentPid?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface WindowInfo {
  handle: string;
  title: string;
  className: string;
  processId: number;
  threadId: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WeChatAppExProcess {
  mainProcess?: ProcessInfo;
  rendererProcesses: ProcessInfo[];
  gpuProcess?: ProcessInfo;
  utilityProcesses: ProcessInfo[];
  gameWindow?: WindowInfo;
}

/**
 * Windows Process Manager
 * Provides utilities for:
 * - Enumerating processes by name/pattern
 * - Finding window handles
 * - Attaching debuggers to processes
 * - Memory operations (read/write)
 */
export class ProcessManager {
  private powershellPath: string = 'powershell.exe';

  constructor() {
    logger.info('ProcessManager initialized for Windows platform');
  }

  /**
   * Enumerate all processes matching a pattern
   */
  async findProcesses(pattern: string): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync(
        `${this.powershellPath} -NoProfile -Command "Get-Process -Name '*${pattern}*' -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path, MainWindowTitle, MainWindowHandle, CPU, WorkingSet64 | ConvertTo-Json -Compress"`,
        { maxBuffer: 1024 * 1024 * 10 }
      );

      const processes: ProcessInfo[] = [];
      const lines = stdout.trim();

      if (!lines || lines === 'null' || lines === '') {
        return processes;
      }

      const data = JSON.parse(lines);
      const procList = Array.isArray(data) ? data : [data];

      for (const proc of procList) {
        processes.push({
          pid: proc.Id,
          name: proc.ProcessName,
          executablePath: proc.Path,
          windowTitle: proc.MainWindowTitle,
          windowHandle: proc.MainWindowHandle?.toString(),
          cpuUsage: proc.CPU,
          memoryUsage: proc.WorkingSet64,
        });
      }

      logger.info(`Found ${processes.length} processes matching '${pattern}'`);
      return processes;
    } catch (error) {
      logger.error(`Failed to find processes with pattern '${pattern}':`, error);
      return [];
    }
  }

  /**
   * Get process info by PID
   */
  async getProcessByPid(pid: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(
        `${this.powershellPath} -NoProfile -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path, MainWindowTitle, MainWindowHandle, CPU, WorkingSet64, StartTime | ConvertTo-Json -Compress"`,
        { maxBuffer: 1024 * 1024 }
      );

      if (!stdout.trim() || stdout.trim() === 'null') {
        return null;
      }

      const proc = JSON.parse(stdout.trim());
      return {
        pid: proc.Id,
        name: proc.ProcessName,
        executablePath: proc.Path,
        windowTitle: proc.MainWindowTitle,
        windowHandle: proc.MainWindowHandle?.toString(),
        cpuUsage: proc.CPU,
        memoryUsage: proc.WorkingSet64,
      };
    } catch (error) {
      logger.error(`Failed to get process by PID ${pid}:`, error);
      return null;
    }
  }

  /**
   * Get all windows for a process
   */
  async getProcessWindows(pid: number): Promise<WindowInfo[]> {
    try {
      // Use PowerShell with Win32 API to get all windows
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string title);
            [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int pid);
            [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
            [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder className, int maxCount);
            [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
            [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
          }
"@
        $windows = @()
        $hwnd = [IntPtr]::Zero
        while ($true) {
          $hwnd = [Win32]::FindWindowEx([IntPtr]::Zero, $hwnd, $null, $null)
          if ($hwnd -eq [IntPtr]::Zero) { break }
          $windowPid = 0
          [Win32]::GetWindowThreadProcessId($hwnd, [ref]$windowPid) | Out-Null
          if ($windowPid -eq ${pid}) {
            $title = New-Object System.Text.StringBuilder 256
            $className = New-Object System.Text.StringBuilder 256
            [Win32]::GetWindowText($hwnd, $title, 256) | Out-Null
            [Win32]::GetClassName($hwnd, $className, 256) | Out-Null
            $windows += @{ Handle = $hwnd.ToString(); Title = $title.ToString(); ClassName = $className.ToString(); ProcessId = $windowPid }
          }
        }
        $windows | ConvertTo-Json -Compress
      `;

      const { stdout } = await execAsync(
        `${this.powershellPath} -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`,
        { maxBuffer: 1024 * 1024 }
      );

      if (!stdout.trim() || stdout.trim() === 'null') {
        return [];
      }

      const data = JSON.parse(stdout.trim());
      const windows: WindowInfo[] = [];
      const winList = Array.isArray(data) ? data : [data];

      for (const win of winList) {
        windows.push({
          handle: win.Handle,
          title: win.Title,
          className: win.ClassName,
          processId: win.ProcessId,
          threadId: 0, // Would need additional API call
        });
      }

      return windows;
    } catch (error) {
      logger.error(`Failed to get windows for PID ${pid}:`, error);
      return [];
    }
  }

  /**
   * Find WeChatAppEx processes (微信小程序)
   * WeChatAppEx is the mini-program runtime, typically named:
   * - WeChatAppEx.exe (main process)
   * - WeChatAppEx.exe (renderer processes - multiple)
   */
  async findWeChatAppExProcesses(): Promise<WeChatAppExProcess> {
    const result: WeChatAppExProcess = {
      rendererProcesses: [],
      utilityProcesses: [],
    };

    try {
      // Find all WeChatAppEx processes
      const processes = await this.findProcesses('WeChatAppEx');

      for (const proc of processes) {
        // Get command line to determine process type
        const detailedInfo = await this.getProcessCommandLine(proc.pid);

        if (detailedInfo?.commandLine) {
          const cmd = detailedInfo.commandLine.toLowerCase();

          if (cmd.includes('--type=renderer')) {
            result.rendererProcesses.push({ ...proc, ...detailedInfo });
          } else if (cmd.includes('--type=gpu-process')) {
            result.gpuProcess = { ...proc, ...detailedInfo };
          } else if (cmd.includes('--type=utility')) {
            result.utilityProcesses.push({ ...proc, ...detailedInfo });
          } else if (!cmd.includes('--type=')) {
            // Main process doesn't have --type argument
            result.mainProcess = { ...proc, ...detailedInfo };
          }
        } else {
          // No command line info, assume main
          if (!result.mainProcess) {
            result.mainProcess = proc;
          }
        }
      }

      // Find game window (向僵尸开炮)
      const allPids = [
        result.mainProcess?.pid,
        ...result.rendererProcesses.map(p => p.pid),
      ].filter(Boolean) as number[];

      for (const pid of allPids) {
        const windows = await this.getProcessWindows(pid);
        const gameWindow = windows.find(w =>
          w.title.includes('向僵尸开炮') ||
          w.title.includes('微信小程序') ||
          w.className.includes('Chrome_WidgetWin')
        );

        if (gameWindow) {
          result.gameWindow = gameWindow;
          break;
        }
      }

      logger.info('WeChatAppEx processes found:', {
        main: result.mainProcess?.pid,
        renderers: result.rendererProcesses.length,
        hasGameWindow: !!result.gameWindow,
      });

      return result;
    } catch (error) {
      logger.error('Failed to find WeChatAppEx processes:', error);
      return result;
    }
  }

  /**
   * Get process command line arguments
   */
  async getProcessCommandLine(pid: number): Promise<{ commandLine?: string; parentPid?: number }> {
    try {
      const { stdout } = await execAsync(
        `${this.powershellPath} -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object CommandLine, ParentProcessId | ConvertTo-Json -Compress"`,
        { maxBuffer: 1024 * 1024 }
      );

      if (!stdout.trim() || stdout.trim() === 'null') {
        return {};
      }

      const data = JSON.parse(stdout.trim());
      return {
        commandLine: data.CommandLine,
        parentPid: data.ParentProcessId,
      };
    } catch (error) {
      logger.error(`Failed to get command line for PID ${pid}:`, error);
      return {};
    }
  }

  /**
   * Check if a process has a debug port enabled
   */
  async checkDebugPort(pid: number): Promise<number | null> {
    try {
      // Check for --remote-debugging-port in command line
      const { commandLine } = await this.getProcessCommandLine(pid);

      if (commandLine) {
        const match = commandLine.match(/--remote-debugging-port=(\d+)/);
        if (match && match[1]) {
          return parseInt(match[1], 10);
        }
      }

      // Check listening ports for the process
      const { stdout } = await execAsync(
        `${this.powershellPath} -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort | ConvertTo-Json -Compress"`,
        { maxBuffer: 1024 * 1024 }
      );

      if (stdout.trim() && stdout.trim() !== 'null') {
        const data = JSON.parse(stdout.trim());
        const ports = Array.isArray(data) ? data : [data];

        // Common debug ports
        const debugPorts = [9222, 9229, 9333, 2039];
        for (const port of ports) {
          if (debugPorts.includes(port.LocalPort)) {
            return port.LocalPort;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to check debug port for PID ${pid}:`, error);
      return null;
    }
  }

  /**
   * Launch process with debugging enabled
   */
  async launchWithDebug(
    executablePath: string,
    debugPort: number = 9222,
    args: string[] = []
  ): Promise<ProcessInfo | null> {
    try {
      const debugArgs = [`--remote-debugging-port=${debugPort}`, ...args];

      const child = spawn(executablePath, debugArgs, {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      const process = await this.getProcessByPid(child.pid || 0);

      logger.info(`Launched process with debug port ${debugPort}:`, {
        pid: child.pid,
        executable: executablePath,
      });

      return process;
    } catch (error) {
      logger.error('Failed to launch process with debug:', error);
      return null;
    }
  }

  /**
   * Inject DLL into process (requires admin privileges)
   * Note: This is for educational/CTF purposes only
   */
  async injectDll(_pid: number, _dllPath: string): Promise<boolean> {
    try {
      // This would require a native helper or using something like PowerShell with P/Invoke
      // For now, we'll use a PowerShell-based approach
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Injector {
            [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int access, bool inherit, int pid);
            [DllImport("kernel32.dll")] public static extern IntPtr VirtualAllocEx(IntPtr hProcess, IntPtr addr, int size, int alloc, int protect);
            [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr addr, byte[] buffer, int size, out int written);
            [DllImport("kernel32.dll")] public static extern IntPtr CreateRemoteThread(IntPtr hProcess, IntPtr attr, int stack, IntPtr start, IntPtr param, int flags, out int threadId);
            [DllImport("kernel32.dll")] public static extern IntPtr GetModuleHandle(string name);
            [DllImport("kernel32.dll")] public static extern IntPtr GetProcAddress(IntPtr hModule, string name);
            [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
          }
"@
        # Injection logic here (simplified for safety)
        Write-Output "Injection requires elevated privileges and is disabled for safety"
      `;

      await execAsync(
        `${this.powershellPath} -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`,
        { maxBuffer: 1024 * 1024 }
      );

      logger.warn('DLL injection is disabled for safety in this implementation');
      return false;
    } catch (error) {
      logger.error('DLL injection failed:', error);
      return false;
    }
  }

  /**
   * Kill a process by PID
   */
  async killProcess(pid: number): Promise<boolean> {
    try {
      await execAsync(`${this.powershellPath} -NoProfile -Command "Stop-Process -Id ${pid} -Force"`);
      logger.info(`Process ${pid} killed successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to kill process ${pid}:`, error);
      return false;
    }
  }
}
