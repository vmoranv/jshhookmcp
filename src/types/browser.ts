import type { Browser, Page } from 'rebrowser-puppeteer';

export interface BrowserContext {
  browser: Browser;
  page: Page;
  url: string;
}

declare global {
  interface Window {
    __aiHooks?: Record<string, unknown[]>;
    __aiHookMetadata?: Record<
      string,
      {
        id: string;
        createdAt: number;
        enabled: boolean;
      }
    >;
  }
}
