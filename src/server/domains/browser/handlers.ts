import type { CodeCollector } from '../../../modules/collector/CodeCollector.js';
import type { PageController } from '../../../modules/collector/PageController.js';
import type { DOMInspector } from '../../../modules/collector/DOMInspector.js';
import type { ScriptManager } from '../../../modules/debugger/ScriptManager.js';
import type { ConsoleMonitor } from '../../../modules/monitor/ConsoleMonitor.js';
import { AICaptchaDetector } from '../../../modules/captcha/AICaptchaDetector.js';
import { LLMService } from '../../../services/LLMService.js';
import { StealthScripts } from '../../../modules/stealth/StealthScripts.js';
import { DetailedDataManager } from '../../../utils/DetailedDataManager.js';
import { CamoufoxBrowserManager } from '../../../modules/browser/CamoufoxBrowserManager.js';
import { logger } from '../../../utils/logger.js';

export class BrowserToolHandlers {
  private captchaDetector: AICaptchaDetector;
  private autoDetectCaptcha: boolean = true;
  private autoSwitchHeadless: boolean = true;
  private captchaTimeout: number = 300000;
  private detailedDataManager: DetailedDataManager;
  private camoufoxManager: CamoufoxBrowserManager | null = null;
  private activeDriver: 'chrome' | 'camoufox' = 'chrome';
  private camoufoxPage: any = null;

  constructor(
    private collector: CodeCollector,
    private pageController: PageController,
    private domInspector: DOMInspector,
    private scriptManager: ScriptManager,
    private consoleMonitor: ConsoleMonitor,
    llmService: LLMService
  ) {
    const screenshotDir = process.env.CAPTCHA_SCREENSHOT_DIR || './screenshots';
    this.captchaDetector = new AICaptchaDetector(llmService, screenshotDir);
    this.detailedDataManager = DetailedDataManager.getInstance();
  }

  async handleBrowserListTabs(args: Record<string, unknown>) {
    try {
      // If not connected, try to connect to provided endpoint first
      const browserURL = args.browserURL as string | undefined;
      if (browserURL) {
        await this.collector.connect(browserURL);
      }

      const pages = await this.collector.listPages();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: pages.length,
                pages,
                hint: 'Use browser_select_tab(index=N) to switch to a specific tab',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to list tabs:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                hint: 'Make sure browser is attached via browser_attach first, or provide browserURL parameter',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  async handleBrowserSelectTab(args: Record<string, unknown>) {
    try {
      const index = args.index as number | undefined;
      const urlPattern = args.urlPattern as string | undefined;
      const titlePattern = args.titlePattern as string | undefined;

      if (index !== undefined) {
        await this.collector.selectPage(index);
        const pages = await this.collector.listPages();
        const selected = pages[index];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  selectedIndex: index,
                  url: selected?.url,
                  title: selected?.title,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Find by pattern
      const pages = await this.collector.listPages();
      let matchIndex = -1;
      for (const page of pages) {
        if (urlPattern && page.url.includes(urlPattern)) {
          matchIndex = page.index;
          break;
        }
        if (titlePattern && page.title.includes(titlePattern)) {
          matchIndex = page.index;
          break;
        }
      }

      if (matchIndex === -1) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: 'No matching tab found',
                  availablePages: pages,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      await this.collector.selectPage(matchIndex);
      const selected = pages[matchIndex];
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                selectedIndex: matchIndex,
                url: selected?.url,
                title: selected?.title,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to select tab:', error);
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

  async handleGetDetailedData(args: Record<string, unknown>) {
    try {
      const detailId = args.detailId as string;
      const path = args.path as string | undefined;

      const data = this.detailedDataManager.retrieve(detailId, path);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                detailId,
                path: path || 'full',
                data,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to get detailed data:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                hint: 'DetailId may have expired (TTL: 10 minutes) or is invalid',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }


  async handleBrowserAttach(args: Record<string, unknown>) {
    try {
      const browserURL = args.browserURL as string | undefined;
      const wsEndpoint = args.wsEndpoint as string | undefined;
      const endpoint = browserURL || wsEndpoint;

      if (!endpoint) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: false, error: 'browserURL or wsEndpoint is required' },
                null,
                2
              ),
            },
          ],
        };
      }

      this.activeDriver = 'chrome';
      await this.collector.connect(endpoint);
      const status = await this.collector.getStatus();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Attached to existing browser successfully',
                endpoint,
                status,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to attach to browser:', error);
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

  async handleBrowserLaunch(args: Record<string, unknown>) {
    const driver = (args.driver as string) || 'chrome';

    if (driver === 'camoufox') {
      const headless = (args.headless as boolean) ?? true;
      const os = (args.os as 'windows' | 'macos' | 'linux') ?? 'windows';
      const mode = (args.mode as string) ?? 'launch';

      // Connect mode: attach to an existing camoufox server
      if (mode === 'connect') {
        const wsEndpoint = args.wsEndpoint as string | undefined;
        if (!wsEndpoint) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { success: false, error: 'wsEndpoint is required for connect mode. Use camoufox_server_launch first to get a wsEndpoint.' },
                  null,
                  2
                ),
              },
            ],
          };
        }
        this.camoufoxManager = new CamoufoxBrowserManager({ headless, os });
        await this.camoufoxManager.connectToServer(wsEndpoint);
        this.activeDriver = 'camoufox';
        this.camoufoxPage = null;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  driver: 'camoufox',
                  mode: 'connect',
                  wsEndpoint,
                  message: 'Connected to Camoufox server. Use page_navigate to begin.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Launch mode (default)
      this.camoufoxManager = new CamoufoxBrowserManager({ headless, os });
      await this.camoufoxManager.launch();
      this.activeDriver = 'camoufox';
      this.camoufoxPage = null;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                driver: 'camoufox',
                mode: 'launch',
                message: 'Camoufox (Firefox) browser launched',
                note: 'Use page_navigate to begin. CDP debugger is limited in Firefox; network_enable and console_enable use Playwright events and are fully supported.',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Chrome path (default)
    this.activeDriver = 'chrome';
    const chromeHeadless = args.headless !== undefined ? (args.headless as boolean) : undefined;
    await this.collector.init(chromeHeadless);
    const status = await this.collector.getStatus();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              driver: 'chrome',
              message: 'Browser launched successfully',
              status,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleBrowserClose(_args: Record<string, unknown>) {
    if (this.activeDriver === 'camoufox' && this.camoufoxManager) {
      await this.camoufoxManager.close();
      this.camoufoxManager = null;
      this.camoufoxPage = null;
      this.activeDriver = 'chrome';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Camoufox browser closed',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    await this.collector.close();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Browser closed successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleBrowserStatus(_args: Record<string, unknown>) {
    if (this.activeDriver === 'camoufox') {
      const running = !!(this.camoufoxManager?.getBrowser());
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                driver: 'camoufox',
                running,
                hasActivePage: !!this.camoufoxPage,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const status = await this.collector.getStatus();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ driver: 'chrome', ...status }, null, 2),
        },
      ],
    };
  }

  /** Get or create camoufox page (Playwright Page). */
  private async getCamoufoxPage(): Promise<any> {
    if (!this.camoufoxManager) {
      throw new Error('Camoufox browser not launched. Call browser_launch(driver="camoufox") first.');
    }
    if (!this.camoufoxPage) {
      this.camoufoxPage = await this.camoufoxManager.newPage();
    }
    return this.camoufoxPage;
  }

  async handlePageNavigate(args: Record<string, unknown>) {
    const url = args.url as string;
    const rawWaitUntil = (args.waitUntil as string) || 'networkidle';
    const timeout = args.timeout as number | undefined;

    // Camoufox (Playwright) path
    if (this.activeDriver === 'camoufox') {
      // Playwright native waitUntil values: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'
      const playwrightWaitUntil = (rawWaitUntil === 'networkidle2' ? 'networkidle' : rawWaitUntil) as any;
      const page = await this.getCamoufoxPage();
      await page.goto(url, { waitUntil: playwrightWaitUntil, timeout });

      // Register the Playwright page with ConsoleMonitor so network_enable/console_enable work
      this.consoleMonitor.setPlaywrightPage(page);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                driver: 'camoufox',
                captcha_detected: false,
                url: page.url(),
                title: await page.title(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const waitUntilMap: Record<string, string> = {
      networkidle: 'networkidle2',
      commit: 'load',
    };
    const waitUntil = (waitUntilMap[rawWaitUntil] || rawWaitUntil) as any;
    const enableNetworkMonitoring = args.enableNetworkMonitoring as boolean | undefined;

    let networkMonitoringEnabled = false;
    if (enableNetworkMonitoring) {
      if (!this.consoleMonitor.isNetworkEnabled()) {
        try {
          await this.consoleMonitor.enable({
            enableNetwork: true,
            enableExceptions: true,
          });
          networkMonitoringEnabled = true;
          logger.info(' Network monitoring auto-enabled before navigation');
        } catch (error) {
          logger.warn('Failed to auto-enable network monitoring:', error);
        }
      } else {
        networkMonitoringEnabled = true;
        logger.info(' Network monitoring already enabled');
      }
    }

    await this.pageController.navigate(url, { waitUntil, timeout });

    if (this.autoDetectCaptcha) {
      const page = await this.pageController.getPage();
      if (page) {
        const captchaResult = await this.captchaDetector.detect(page);

        if (captchaResult.detected) {
          logger.warn(
            `CAPTCHA detected (type: ${captchaResult.type}, confidence: ${captchaResult.confidence}%)`
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    captcha_detected: true,
                    captcha_info: captchaResult,
                    url: await this.pageController.getURL(),
                    title: await this.pageController.getTitle(),
                    message: 'CAPTCHA detected, use captcha_handle to resolve',
                    network_monitoring_enabled: networkMonitoringEnabled,
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

    const currentUrl = await this.pageController.getURL();
    const title = await this.pageController.getTitle();

    const result: any = {
      success: true,
      captcha_detected: false,
      url: currentUrl,
      title,
    };

    if (networkMonitoringEnabled) {
      const networkStatus = this.consoleMonitor.getNetworkStatus();
      result.network_monitoring = {
        enabled: true,
        auto_enabled: true,
        message:
          ' Network monitoring is active. Use network_get_requests to retrieve captured requests.',
        requestCount: networkStatus.requestCount,
        responseCount: networkStatus.responseCount,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handlePageReload(_args: Record<string, unknown>) {
    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      await page.reload();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Page reloaded', driver: 'camoufox' }, null, 2) }],
      };
    }

    await this.pageController.reload();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Page reloaded',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageBack(_args: Record<string, unknown>) {
    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      await page.goBack();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, url: page.url(), driver: 'camoufox' }, null, 2) }],
      };
    }

    await this.pageController.goBack();
    const url = await this.pageController.getURL();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              url,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageForward(_args: Record<string, unknown>) {
    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      await page.goForward();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, url: page.url(), driver: 'camoufox' }, null, 2) }],
      };
    }

    await this.pageController.goForward();
    const url = await this.pageController.getURL();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              url,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDOMQuerySelector(args: Record<string, unknown>) {
    const selector = args.selector as string;
    const getAttributes = (args.getAttributes as boolean) ?? true;

    const element = await this.domInspector.querySelector(selector, getAttributes);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(element, null, 2),
        },
      ],
    };
  }

  async handleDOMQueryAll(args: Record<string, unknown>) {
    const selector = args.selector as string;
    const limit = (args.limit as number) ?? 100;

    const elements = await this.domInspector.querySelectorAll(selector, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: elements.length,
              elements,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDOMGetStructure(args: Record<string, unknown>) {
    const maxDepth = (args.maxDepth as number) ?? 3;
    const includeText = (args.includeText as boolean) ?? true;

    const structure = await this.domInspector.getStructure(maxDepth, includeText);

    const processedStructure = this.detailedDataManager.smartHandle(structure, 51200);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(processedStructure, null, 2),
        },
      ],
    };
  }

  async handleDOMFindClickable(args: Record<string, unknown>) {
    const filterText = args.filterText as string | undefined;

    const clickable = await this.domInspector.findClickable(filterText);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: clickable.length,
              elements: clickable,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageClick(args: Record<string, unknown>) {
    const selector = args.selector as string;
    const button = args.button as any;
    const clickCount = args.clickCount as number;
    const delay = args.delay as number;

    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      await page.click(selector, { button, clickCount, delay });
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, driver: 'camoufox', message: `Clicked: ${selector}` }, null, 2) }],
      };
    }

    try {
      await this.pageController.click(selector, { button, clickCount, delay });
    } catch (error: any) {
      const msg = error?.message || '';
      if (
        msg.includes('detached') ||
        msg.includes('timed out') ||
        msg.includes('Execution context was destroyed') ||
        msg.includes('callFunctionOn') ||
        msg.includes('Target closed')
      ) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Clicked ${selector} - navigation triggered`,
                  navigated: true,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      throw error;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Clicked: ${selector}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageType(args: Record<string, unknown>) {
    const selector = args.selector as string;
    const text = args.text as string;
    const delay = args.delay as number;

    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      // Playwright uses fill() for input fields (clears then types)
      await page.fill(selector, text);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, driver: 'camoufox', message: `Typed into ${selector}` }, null, 2) }],
      };
    }

    await this.pageController.type(selector, text, { delay });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Typed into ${selector}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageSelect(args: Record<string, unknown>) {
    const selector = args.selector as string;
    const values = args.values as string[];

    await this.pageController.select(selector, ...values);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Selected in ${selector}: ${values.join(', ')}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageHover(args: Record<string, unknown>) {
    const selector = args.selector as string;

    await this.pageController.hover(selector);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Hovered: ${selector}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageScroll(args: Record<string, unknown>) {
    const x = args.x as number;
    const y = args.y as number;

    await this.pageController.scroll({ x, y });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Scrolled to: x=${x || 0}, y=${y || 0}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageWaitForSelector(args: Record<string, unknown>) {
    const selector = args.selector as string;
    const timeout = args.timeout as number;

    const result = await this.pageController.waitForSelector(selector, timeout);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handlePageEvaluate(args: Record<string, unknown>) {
    const code = (args.script ?? args.code) as string;
    const autoSummarize = (args.autoSummarize as boolean) ?? true;
    const maxSize = (args.maxSize as number) ?? 51200;

    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      // Playwright evaluate accepts a function string or arrow function
      const result = await page.evaluate(new Function(`return (${code})`) as any);
      const processedResult = autoSummarize
        ? this.detailedDataManager.smartHandle(result, maxSize)
        : result;
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, driver: 'camoufox', result: processedResult }, null, 2) }],
      };
    }

    const result = await this.pageController.evaluate(code);

    const processedResult = autoSummarize
      ? this.detailedDataManager.smartHandle(result, maxSize)
      : result;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              result: processedResult,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageScreenshot(args: Record<string, unknown>) {
    const path = args.path as string;
    const type = args.type as 'png' | 'jpeg';
    const quality = args.quality as number;
    const fullPage = args.fullPage as boolean;

    if (this.activeDriver === 'camoufox') {
      const page = await this.getCamoufoxPage();
      const buffer = await page.screenshot({ path, type, quality, fullPage });
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, driver: 'camoufox', message: `Screenshot taken${path ? `: ${path}` : ''}`, size: buffer?.length ?? 0 }, null, 2) }],
      };
    }

    const buffer = await this.pageController.screenshot({ path, type, quality, fullPage });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Screenshot taken${path ? `: ${path}` : ''}`,
              size: buffer.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleGetAllScripts(args: Record<string, unknown>) {
    const includeSource = (args.includeSource as boolean) ?? false;

    const scripts = await this.scriptManager.getAllScripts(includeSource);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: scripts.length,
              scripts,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleGetScriptSource(args: Record<string, unknown>) {
    const scriptId = args.scriptId as string | undefined;
    const url = args.url as string | undefined;
    const preview = (args.preview as boolean) ?? false;
    const maxLines = (args.maxLines as number) ?? 100;
    const startLine = args.startLine as number | undefined;
    const endLine = args.endLine as number | undefined;

    const script = await this.scriptManager.getScriptSource(scriptId, url);

    if (!script) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                message: 'Script not found',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (preview || startLine !== undefined || endLine !== undefined) {
      const source = script.source || '';
      const lines = source.split('\n');
      const totalLines = lines.length;
      const size = source.length;

      let previewContent: string;
      let actualStartLine: number;
      let actualEndLine: number;

      if (startLine !== undefined && endLine !== undefined) {
        actualStartLine = Math.max(1, startLine);
        actualEndLine = Math.min(totalLines, endLine);
        previewContent = lines.slice(actualStartLine - 1, actualEndLine).join('\n');
      } else {
        actualStartLine = 1;
        actualEndLine = Math.min(maxLines, totalLines);
        previewContent = lines.slice(0, maxLines).join('\n');
      }

      const result = {
        success: true,
        scriptId: script.scriptId,
        url: script.url,
        preview: true,
        totalLines,
        size,
        sizeKB: (size / 1024).toFixed(1) + 'KB',
        showingLines: `${actualStartLine}-${actualEndLine}`,
        content: previewContent,
        hint:
          size > 51200
            ? `Script is large (${(size / 1024).toFixed(1)}KB). Use startLine/endLine to get specific sections, or set preview=false to get full source (will return detailId).`
            : 'Set preview=false to get full source',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    const processedScript = this.detailedDataManager.smartHandle(script, 51200);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(processedScript, null, 2),
        },
      ],
    };
  }

  async handleConsoleEnable(_args: Record<string, unknown>) {
    await this.consoleMonitor.enable();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Console monitoring enabled',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleConsoleGetLogs(args: Record<string, unknown>) {
    const type = args.type as any;
    const limit = args.limit as number;
    const since = args.since as number;

    const logs = this.consoleMonitor.getLogs({ type, limit, since });

    const result = {
      count: logs.length,
      logs,
    };

    const processedResult = this.detailedDataManager.smartHandle(result, 51200);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(processedResult, null, 2),
        },
      ],
    };
  }

  async handleConsoleExecute(args: Record<string, unknown>) {
    const expression = args.expression as string;

    const result = await this.consoleMonitor.execute(expression);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              result,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDOMGetComputedStyle(args: Record<string, unknown>) {
    const selector = args.selector as string;

    const styles = await this.domInspector.getComputedStyle(selector);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              selector,
              styles,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDOMFindByText(args: Record<string, unknown>) {
    const text = args.text as string;
    const tag = args.tag as string | undefined;

    const elements = await this.domInspector.findByText(text, tag);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: elements.length,
              elements,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDOMGetXPath(args: Record<string, unknown>) {
    const selector = args.selector as string;

    const xpath = await this.domInspector.getXPath(selector);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              selector,
              xpath,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleDOMIsInViewport(args: Record<string, unknown>) {
    const selector = args.selector as string;

    const inViewport = await this.domInspector.isInViewport(selector);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              selector,
              inViewport,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageGetPerformance(_args: Record<string, unknown>) {
    const metrics = await this.pageController.getPerformanceMetrics();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              metrics,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageInjectScript(args: Record<string, unknown>) {
    const script = args.script as string;

    await this.pageController.injectScript(script);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Script injected',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageSetCookies(args: Record<string, unknown>) {
    const cookies = args.cookies as any[];

    await this.pageController.setCookies(cookies);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Set ${cookies.length} cookies`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageGetCookies(_args: Record<string, unknown>) {
    const cookies = await this.pageController.getCookies();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: cookies.length,
              cookies,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageClearCookies(_args: Record<string, unknown>) {
    await this.pageController.clearCookies();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Cookies cleared',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageSetViewport(args: Record<string, unknown>) {
    const width = args.width as number;
    const height = args.height as number;

    await this.pageController.setViewport(width, height);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              viewport: { width, height },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageEmulateDevice(args: Record<string, unknown>) {
    const device = args.device as 'iPhone' | 'iPad' | 'Android';

    await this.pageController.emulateDevice(device);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              device,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageGetLocalStorage(_args: Record<string, unknown>) {
    const storage = await this.pageController.getLocalStorage();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: Object.keys(storage).length,
              storage,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageSetLocalStorage(args: Record<string, unknown>) {
    const key = args.key as string;
    const value = args.value as string;

    await this.pageController.setLocalStorage(key, value);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              key,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePagePressKey(args: Record<string, unknown>) {
    const key = args.key as string;

    await this.pageController.pressKey(key);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              key,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handlePageGetAllLinks(_args: Record<string, unknown>) {
    const links = await this.pageController.getAllLinks();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: links.length,
              links,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleCaptchaDetect(_args: Record<string, unknown>) {
    const page = await this.pageController.getPage();
    const result = await this.captchaDetector.detect(page);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              captcha_detected: result.detected,
              captcha_info: result,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleCaptchaWait(args: Record<string, unknown>) {
    const timeout = (args.timeout as number) || this.captchaTimeout;
    const page = await this.pageController.getPage();

    logger.info('Waiting for CAPTCHA to be solved...');
    const completed = await this.captchaDetector.waitForCompletion(page, timeout);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: completed,
              message: completed ? 'CAPTCHA solved' : 'CAPTCHA wait timed out',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleCaptchaConfig(args: Record<string, unknown>) {
    if (args.autoDetectCaptcha !== undefined) {
      this.autoDetectCaptcha = args.autoDetectCaptcha as boolean;
    }
    if (args.autoSwitchHeadless !== undefined) {
      this.autoSwitchHeadless = args.autoSwitchHeadless as boolean;
    }
    if (args.captchaTimeout !== undefined) {
      this.captchaTimeout = args.captchaTimeout as number;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              config: {
                autoDetectCaptcha: this.autoDetectCaptcha,
                autoSwitchHeadless: this.autoSwitchHeadless,
                captchaTimeout: this.captchaTimeout,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleStealthInject(_args: Record<string, unknown>) {
    if (this.activeDriver === 'camoufox') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                driver: 'camoufox',
                message:
                  'Camoufox uses C++ engine-level fingerprint spoofing — JS-layer stealth scripts are not needed and have been skipped.',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const page = await this.pageController.getPage();
    await StealthScripts.injectAll(page);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Stealth scripts injected successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleStealthSetUserAgent(args: Record<string, unknown>) {
    const platform = (args.platform as 'windows' | 'mac' | 'linux') || 'windows';
    const page = await this.pageController.getPage();

    await StealthScripts.setRealisticUserAgent(page, platform);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              platform,
              message: `User-Agent${platform}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleCamoufoxServerLaunch(args: Record<string, unknown>) {
    const port = args.port as number | undefined;
    const ws_path = args.ws_path as string | undefined;
    const headless = (args.headless as boolean) ?? true;
    const os = (args.os as 'windows' | 'macos' | 'linux') ?? 'windows';

    if (!this.camoufoxManager) {
      this.camoufoxManager = new CamoufoxBrowserManager({ headless, os });
    }

    const wsEndpoint = await this.camoufoxManager.launchAsServer(port, ws_path);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              wsEndpoint,
              message: 'Camoufox server launched. Connect with: browser_launch(driver="camoufox", mode="connect", wsEndpoint=<wsEndpoint>)',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleCamoufoxServerClose(_args: Record<string, unknown>) {
    if (!this.camoufoxManager) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: 'No camoufox server is running.' }, null, 2),
          },
        ],
      };
    }

    await this.camoufoxManager.closeBrowserServer();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, message: 'Camoufox server closed.' }, null, 2),
        },
      ],
    };
  }

  async handleCamoufoxServerStatus(_args: Record<string, unknown>) {
    const wsEndpoint = this.camoufoxManager?.getBrowserServerEndpoint() ?? null;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              running: wsEndpoint !== null,
              wsEndpoint,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
