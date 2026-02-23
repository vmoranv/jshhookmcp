import { logger } from '../../utils/logger.js';
import type { NetworkRequest, NetworkResponse } from './NetworkMonitor.js';

/**
 * Lightweight network monitor for Playwright-based browsers (Camoufox/Firefox).
 * Uses page.on('request'/'response') instead of CDP Network domain.
 */
export class PlaywrightNetworkMonitor {
  private networkEnabled = false;
  private requests: Map<string, NetworkRequest> = new Map();
  private responses: Map<string, NetworkResponse> = new Map();
  private readonly MAX_NETWORK_RECORDS = 500;
  private requestCounter = 0;

  // WeakMap to correlate requests with responses
  private requestIdMap: WeakMap<object, string> = new WeakMap();

  // Stored listener references for cleanup
  private boundOnRequest: ((req: any) => void) | null = null;
  private boundOnResponse: ((res: any) => void) | null = null;

  constructor(private page: any) {}

  async enable(): Promise<void> {
    if (this.networkEnabled) {
      logger.warn('PlaywrightNetworkMonitor already enabled');
      return;
    }

    this.boundOnRequest = (req: any) => {
      const requestId = `pw-${++this.requestCounter}`;
      this.requestIdMap.set(req, requestId);

      const request: NetworkRequest = {
        requestId,
        url: req.url(),
        method: req.method(),
        headers: req.headers() as Record<string, string>,
        postData: req.postData() ?? undefined,
        timestamp: Date.now(),
        type: req.resourceType(),
      };

      this.requests.set(requestId, request);

      if (this.requests.size > this.MAX_NETWORK_RECORDS) {
        const firstKey = this.requests.keys().next().value;
        if (firstKey) this.requests.delete(firstKey);
      }
    };

    this.boundOnResponse = (res: any) => {
      const req = res.request();
      const requestId = this.requestIdMap.get(req) ?? `pw-res-${Date.now()}-${Math.random()}`;

      const response: NetworkResponse = {
        requestId,
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        headers: res.headers() as Record<string, string>,
        mimeType: (res.headers() as Record<string, string>)['content-type'] ?? 'unknown',
        timestamp: Date.now(),
      };

      this.responses.set(requestId, response);

      if (this.responses.size > this.MAX_NETWORK_RECORDS) {
        const firstKey = this.responses.keys().next().value;
        if (firstKey) this.responses.delete(firstKey);
      }
    };

    this.page.on('request', this.boundOnRequest);
    this.page.on('response', this.boundOnResponse);
    this.networkEnabled = true;

    logger.info('PlaywrightNetworkMonitor enabled');
  }

  async disable(): Promise<void> {
    if (this.boundOnRequest) {
      try {
        this.page.off('request', this.boundOnRequest);
      } catch {}
      this.boundOnRequest = null;
    }
    if (this.boundOnResponse) {
      try {
        this.page.off('response', this.boundOnResponse);
      } catch {}
      this.boundOnResponse = null;
    }
    this.networkEnabled = false;
    logger.info('PlaywrightNetworkMonitor disabled');
  }

  isEnabled(): boolean {
    return this.networkEnabled;
  }

  getRequests(filter?: { url?: string; method?: string; limit?: number }): NetworkRequest[] {
    let requests = Array.from(this.requests.values());
    if (filter?.url) requests = requests.filter((r) => r.url.includes(filter.url!));
    if (filter?.method)
      requests = requests.filter(
        (r) => r.method.toUpperCase() === filter.method!.toUpperCase()
      );
    if (filter?.limit) requests = requests.slice(-filter.limit);
    return requests;
  }

  getResponses(filter?: { url?: string; status?: number; limit?: number }): NetworkResponse[] {
    let responses = Array.from(this.responses.values());
    if (filter?.url) responses = responses.filter((r) => r.url.includes(filter.url!));
    if (filter?.status) responses = responses.filter((r) => r.status === filter.status);
    if (filter?.limit) responses = responses.slice(-filter.limit);
    return responses;
  }

  getStatus() {
    return {
      enabled: this.networkEnabled,
      requestCount: this.requests.size,
      responseCount: this.responses.size,
      listenerCount: this.networkEnabled ? 2 : 0,
      cdpSessionActive: false,
    };
  }

  getActivity(requestId: string) {
    return {
      request: this.requests.get(requestId),
      response: this.responses.get(requestId),
    };
  }

  clearRecords(): void {
    this.requests.clear();
    this.responses.clear();
  }

  getStats() {
    const requests = Array.from(this.requests.values());
    const responses = Array.from(this.responses.values());

    const byMethod: Record<string, number> = {};
    requests.forEach((r) => {
      byMethod[r.method] = (byMethod[r.method] || 0) + 1;
    });

    const byStatus: Record<string, number> = {};
    responses.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    const byType: Record<string, number> = {};
    requests.forEach((r) => {
      const type = r.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalRequests: requests.length,
      totalResponses: responses.length,
      byMethod,
      byStatus,
      byType,
    };
  }

  /** Response body retrieval is not supported in Playwright mode without async interception. */
  async getResponseBody(_requestId: string): Promise<{ body: string; base64Encoded: boolean } | null> {
    logger.warn('getResponseBody is not supported in Playwright/camoufox mode');
    return null;
  }

  /** Inject a script via page.evaluate (Playwright equivalent of CDP Runtime.evaluate). */
  async injectScript(script: string): Promise<void> {
    await this.page.evaluate(script);
  }

  async injectXHRInterceptor(): Promise<void> {
    await this.page.evaluate(`
      (function() {
        if (window.__xhrInterceptorInjected) return;
        window.__xhrInterceptorInjected = true;
        const OrigXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
          const xhr = new OrigXHR();
          const origOpen = xhr.open.bind(xhr);
          const origSend = xhr.send.bind(xhr);
          xhr.open = function(method, url, ...rest) {
            xhr.__hookMeta = { method, url, timestamp: Date.now() };
            return origOpen(method, url, ...rest);
          };
          xhr.send = function(body) {
            xhr.addEventListener('load', function() {
              if (!window.__xhrRequests) window.__xhrRequests = [];
              window.__xhrRequests.push({
                ...xhr.__hookMeta, body: body ? String(body).slice(0, 2048) : null,
                status: xhr.status, response: xhr.responseText.slice(0, 2048),
              });
            });
            return origSend(body);
          };
          return xhr;
        };
        console.log('[PlaywrightXHR] XHR interceptor injected');
      })();
    `);
  }

  async injectFetchInterceptor(): Promise<void> {
    await this.page.evaluate(`
      (function() {
        if (window.__fetchInterceptorInjected) return;
        window.__fetchInterceptorInjected = true;
        const origFetch = window.fetch;
        window.fetch = function(...args) {
          const [url, opts] = args;
          if (!window.__fetchRequests) window.__fetchRequests = [];
          const entry = { url: String(url), method: opts?.method || 'GET', timestamp: Date.now() };
          return origFetch.apply(this, args).then(res => {
            entry.status = res.status;
            window.__fetchRequests.push(entry);
            return res;
          });
        };
        console.log('[PlaywrightFetch] Fetch interceptor injected');
      })();
    `);
  }

  async getXHRRequests(): Promise<any[]> {
    try {
      return await this.page.evaluate(() => (window as any).__xhrRequests || []);
    } catch {
      return [];
    }
  }

  async getFetchRequests(): Promise<any[]> {
    try {
      return await this.page.evaluate(() => (window as any).__fetchRequests || []);
    } catch {
      return [];
    }
  }

  async getAllJavaScriptResponses(): Promise<any[]> {
    return Array.from(this.responses.values()).filter((r) =>
      r.mimeType.includes('javascript')
    );
  }
}
