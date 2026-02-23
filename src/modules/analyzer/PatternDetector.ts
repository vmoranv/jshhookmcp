import type { NetworkRequest, NetworkResponse } from '../monitor/ConsoleMonitor.js';
import type { ConsoleMessage } from '../monitor/ConsoleMonitor.js';
import type {
  EncryptionPattern,
  SignaturePattern,
  TokenPattern,
  AntiDebugPattern,
} from './IntelligentAnalyzer.js';

export const BLACKLIST_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com/tr',
  'doubleclick.net',
  'googlesyndication.com',
  'clarity.ms',
  'hotjar.com',
  'segment.com',
  'mixpanel.com',
  'amplitude.com',
  'sentry.io',
  'bugsnag.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
];

export const WHITELIST_KEYWORDS = [
  'login',
  'auth',
  'token',
  'sign',
  'encrypt',
  'decrypt',
  'verify',
  'validate',
  'captcha',
  'api',
  'data',
  'user',
  'password',
  'secret',
  'key',
  'hash',
  'crypto',
];

export const FRAMEWORK_LOG_KEYWORDS = [
  '[HMR]',
  '[WDS]',
  '[webpack]',
  'Download the React DevTools',
  'React DevTools',
  'Vue DevTools',
  'Angular DevTools',
  '%c',
  'color:',
  'font-size:',
];

export function calculateRequestPriority(req: NetworkRequest): number {
  let score = 0;

  if (req.method === 'POST' || req.method === 'PUT') score += 10;

  const keywordCount = WHITELIST_KEYWORDS.filter((keyword) =>
    req.url.toLowerCase().includes(keyword)
  ).length;
  score += keywordCount * 5;

  if (req.postData) score += 5;

  score += Math.floor(req.url.length / 100);

  return score;
}

export function filterCriticalRequests(requests: NetworkRequest[]): NetworkRequest[] {
  return requests
    .filter((req) => {
      const isBlacklisted = BLACKLIST_DOMAINS.some((domain) => req.url.includes(domain));
      if (isBlacklisted) return false;

      const isStaticResource = /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|css|ico)$/i.test(req.url);
      if (isStaticResource) return false;

      const hasKeyword = WHITELIST_KEYWORDS.some((keyword) =>
        req.url.toLowerCase().includes(keyword)
      );
      if (hasKeyword) return true;

      if (req.method === 'POST' || req.method === 'PUT') return true;

      if (req.method === 'GET' && req.url.includes('?')) return true;

      return false;
    })
    .sort((a, b) => {
      const scoreA = calculateRequestPriority(a);
      const scoreB = calculateRequestPriority(b);
      return scoreB - scoreA;
    });
}

export function filterCriticalResponses(responses: NetworkResponse[]): NetworkResponse[] {
  return responses
    .filter((res) => {
      const isBlacklisted = BLACKLIST_DOMAINS.some((domain) => res.url.includes(domain));
      if (isBlacklisted) return false;

      if (res.mimeType.includes('json')) return true;

      if (res.mimeType.includes('javascript')) return true;

      const hasKeyword = WHITELIST_KEYWORDS.some((keyword) =>
        res.url.toLowerCase().includes(keyword)
      );
      if (hasKeyword) return true;

      return false;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function calculateLogPriority(log: ConsoleMessage): number {
  let score = 0;

  if (log.type === 'error') score += 20;
  if (log.type === 'warn') score += 10;

  const keywordCount = WHITELIST_KEYWORDS.filter((keyword) =>
    log.text.toLowerCase().includes(keyword)
  ).length;
  score += keywordCount * 5;

  return score;
}

export function filterCriticalLogs(logs: ConsoleMessage[]): ConsoleMessage[] {
  return logs
    .filter((log) => {
      const isFrameworkLog = FRAMEWORK_LOG_KEYWORDS.some((keyword) => log.text.includes(keyword));
      if (isFrameworkLog) return false;

      if (!log.text || log.text.trim().length === 0) return false;

      if (log.type === 'error' || log.type === 'warn') return true;

      const hasKeyword = WHITELIST_KEYWORDS.some((keyword) =>
        log.text.toLowerCase().includes(keyword)
      );
      if (hasKeyword) return true;

      return false;
    })
    .sort((a, b) => {
      const scoreA = calculateLogPriority(a);
      const scoreB = calculateLogPriority(b);
      return scoreB - scoreA;
    });
}

export function deduplicatePatterns<T extends { location: string; type: string }>(
  patterns: T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const pattern of patterns) {
    const key = `${pattern.type}-${pattern.location}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pattern);
    }
  }

  return result;
}

export function detectEncryptionPatterns(
  requests: NetworkRequest[],
  logs: ConsoleMessage[]
): EncryptionPattern[] {
  const patterns: EncryptionPattern[] = [];

  const cryptoKeywords = {
    AES: ['aes', 'cipher', 'encrypt', 'decrypt', 'CryptoJS.AES'],
    RSA: ['rsa', 'publickey', 'privatekey', 'RSA.encrypt'],
    MD5: ['md5', 'MD5', 'CryptoJS.MD5'],
    SHA: ['sha', 'sha1', 'sha256', 'sha512', 'CryptoJS.SHA'],
    Base64: ['base64', 'btoa', 'atob', 'Base64.encode'],
  };

  for (const req of requests) {
    for (const [type, keywords] of Object.entries(cryptoKeywords)) {
      for (const keyword of keywords) {
        if (req.url.toLowerCase().includes(keyword.toLowerCase())) {
          patterns.push({
            type: type as any,
            location: req.url,
            confidence: 0.7,
            evidence: [keyword, 'Found in URL'],
          });
        }
      }
    }

    if (req.postData) {
      const postData = req.postData.toLowerCase();
      for (const [type, keywords] of Object.entries(cryptoKeywords)) {
        for (const keyword of keywords) {
          if (postData.includes(keyword.toLowerCase())) {
            patterns.push({
              type: type as any,
              location: req.url,
              confidence: 0.8,
              evidence: [keyword, 'Found in POST data'],
            });
          }
        }
      }
    }
  }

  for (const log of logs) {
    const text = log.text.toLowerCase();
    for (const [type, keywords] of Object.entries(cryptoKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          patterns.push({
            type: type as any,
            location: log.url || 'console',
            confidence: 0.9,
            evidence: [keyword, 'Found in console log', log.text.substring(0, 100)],
          });
        }
      }
    }
  }

  return deduplicatePatterns(patterns);
}

export function detectSignaturePatterns(
  requests: NetworkRequest[],
  _logs: ConsoleMessage[]
): SignaturePattern[] {
  const patterns: SignaturePattern[] = [];

  const signatureKeywords = [
    'sign',
    'signature',
    'sig',
    'hmac',
    'hash',
    'digest',
    'checksum',
    'verify',
    'validation',
  ];

  for (const req of requests) {
    if (req.url.includes('?')) {
      try {
        const url = new URL(req.url);
        const params = url.searchParams;
        const paramNames = Array.from(params.keys());

        for (const keyword of signatureKeywords) {
          const matchedParams = paramNames.filter((p) => p.toLowerCase().includes(keyword));

          if (matchedParams.length > 0) {
            let signType: 'HMAC' | 'JWT' | 'Custom' = 'Custom';
            if (keyword.includes('hmac')) signType = 'HMAC';
            else if (keyword.includes('jwt')) signType = 'JWT';

            const otherParams = paramNames.filter(
              (p) =>
                !matchedParams.includes(p) &&
                !p.toLowerCase().includes('callback') &&
                !p.toLowerCase().includes('_')
            );

            patterns.push({
              type: signType,
              location: `${req.url} (URL params)`,
              parameters: otherParams,
              confidence: 0.82,
            });
          }
        }
      } catch {}
    }

    if (req.headers) {
      for (const [headerName, headerValue] of Object.entries(req.headers)) {
        const headerNameLower = headerName.toLowerCase();

        const isSignatureHeader = signatureKeywords.some((keyword) =>
          headerNameLower.includes(keyword)
        );

        if (isSignatureHeader && headerValue) {
          let signType: 'HMAC' | 'JWT' | 'Custom' = 'Custom';
          let confidence = 0.75;

          if (/^[a-f0-9]{64,}$/i.test(headerValue)) {
            signType = 'HMAC';
            confidence = 0.88;
          } else if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(headerValue)) {
            signType = 'JWT';
            confidence = 0.92;
          }

          const otherHeaders = Object.keys(req.headers).filter(
            (h) =>
              h.toLowerCase() !== headerNameLower &&
              !h.toLowerCase().includes('content-type') &&
              !h.toLowerCase().includes('user-agent')
          );

          patterns.push({
            type: signType,
            location: `${req.url} (header: ${headerName})`,
            parameters: otherHeaders,
            confidence,
          });
        }
      }
    }

    if (req.postData && req.postData.length > 0) {
      try {
        const bodyData = JSON.parse(req.postData);

        for (const [key, value] of Object.entries(bodyData)) {
          const keyLower = key.toLowerCase();
          const isSignatureField = signatureKeywords.some((keyword) => keyLower.includes(keyword));

          if (isSignatureField && typeof value === 'string') {
            let signType: 'HMAC' | 'JWT' | 'Custom' = 'Custom';
            let confidence = 0.7;

            if (/^[a-f0-9]{64,}$/i.test(value)) {
              signType = 'HMAC';
              confidence = 0.85;
            } else if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
              signType = 'JWT';
              confidence = 0.9;
            }

            const otherFields = Object.keys(bodyData).filter((k) => k !== key);

            patterns.push({
              type: signType,
              location: `${req.url} (POST body: ${key})`,
              parameters: otherFields,
              confidence,
            });
          }
        }
      } catch {
        for (const keyword of signatureKeywords) {
          if (req.postData.includes(`${keyword}=`)) {
            patterns.push({
              type: 'Custom',
              location: `${req.url} (POST body)`,
              parameters: ['form-urlencoded data'],
              confidence: 0.65,
            });
            break;
          }
        }
      }
    }
  }

  return patterns;
}

export function detectTokenPatterns(
  requests: NetworkRequest[],
  _logs: ConsoleMessage[]
): TokenPattern[] {
  const patterns: TokenPattern[] = [];

  const jwtRegex = /[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g;

  const tokenHeaderKeywords = [
    'authorization',
    'token',
    'auth',
    'access',
    'bearer',
    'session',
    'credential',
    'api-key',
    'apikey',
    'x-token',
    'x-auth',
    'x-access',
    'x-api-key',
    'x-session',
  ];

  for (const req of requests) {
    if (req.headers) {
      for (const [headerName, headerValue] of Object.entries(req.headers)) {
        const headerNameLower = headerName.toLowerCase();

        const isTokenHeader = tokenHeaderKeywords.some((keyword) =>
          headerNameLower.includes(keyword)
        );

        if (isTokenHeader && headerValue) {
          const jwtMatch = headerValue.match(jwtRegex);
          if (jwtMatch) {
            patterns.push({
              type: 'JWT',
              location: `${req.url} (header: ${headerName})`,
              format: `JWT in ${headerName} header`,
              confidence: 0.95,
            });
          } else if (headerValue.toLowerCase().startsWith('bearer ')) {
            patterns.push({
              type: 'Custom',
              location: `${req.url} (header: ${headerName})`,
              format: `Bearer token in ${headerName} header`,
              confidence: 0.9,
            });
          } else if (headerValue.length > 20 && /^[A-Za-z0-9_\-+=\/]+$/.test(headerValue)) {
            patterns.push({
              type: 'Custom',
              location: `${req.url} (header: ${headerName})`,
              format: `Custom token in ${headerName} header (length: ${headerValue.length})`,
              confidence: 0.75,
            });
          }
        }
      }
    }

    if (req.url.includes('?')) {
      try {
        const url = new URL(req.url);
        const params = url.searchParams;

        const tokenParamKeywords = [
          'token',
          'access_token',
          'accesstoken',
          'auth',
          'authorization',
          'session',
          'sessionid',
          'api_key',
          'apikey',
          'key',
          'credential',
        ];

        for (const [paramName, paramValue] of params.entries()) {
          const paramNameLower = paramName.toLowerCase();

          const isTokenParam = tokenParamKeywords.some((keyword) =>
            paramNameLower.includes(keyword)
          );

          if (isTokenParam && paramValue) {
            const jwtMatch = paramValue.match(jwtRegex);
            if (jwtMatch) {
              patterns.push({
                type: 'JWT',
                location: `${req.url} (param: ${paramName})`,
                format: `JWT in URL parameter '${paramName}'`,
                confidence: 0.92,
              });
            } else if (paramName.toLowerCase().includes('access_token')) {
              patterns.push({
                type: 'OAuth',
                location: `${req.url} (param: ${paramName})`,
                format: `OAuth token in URL parameter '${paramName}'`,
                confidence: 0.88,
              });
            } else if (paramValue.length > 20) {
              patterns.push({
                type: 'Custom',
                location: `${req.url} (param: ${paramName})`,
                format: `Custom token in URL parameter '${paramName}' (length: ${paramValue.length})`,
                confidence: 0.7,
              });
            }
          }
        }
      } catch {}
    }

    if (req.postData && req.postData.length > 0) {
      try {
        const bodyData = JSON.parse(req.postData);

        const tokenParamKeywords = [
          'token',
          'access_token',
          'auth',
          'authorization',
          'session',
          'api_key',
        ];

        for (const [key, value] of Object.entries(bodyData)) {
          const keyLower = key.toLowerCase();
          const isTokenField = tokenParamKeywords.some((keyword) => keyLower.includes(keyword));

          if (isTokenField && typeof value === 'string' && value.length > 20) {
            const jwtMatch = value.match(jwtRegex);
            if (jwtMatch) {
              patterns.push({
                type: 'JWT',
                location: `${req.url} (POST body: ${key})`,
                format: `JWT in POST body field '${key}'`,
                confidence: 0.93,
              });
            } else {
              patterns.push({
                type: 'Custom',
                location: `${req.url} (POST body: ${key})`,
                format: `Custom token in POST body field '${key}' (length: ${value.length})`,
                confidence: 0.72,
              });
            }
          }
        }
      } catch {
        const tokenParamKeywords = ['token', 'access_token', 'auth', 'session', 'api_key'];
        for (const keyword of tokenParamKeywords) {
          if (req.postData.includes(`${keyword}=`)) {
            patterns.push({
              type: 'Custom',
              location: `${req.url} (POST body)`,
              format: `Token in POST body (form-urlencoded, field: ${keyword})`,
              confidence: 0.68,
            });
          }
        }
      }
    }
  }

  return patterns;
}

export function detectAntiDebugPatterns(logs: ConsoleMessage[]): AntiDebugPattern[] {
  const patterns: AntiDebugPattern[] = [];

  for (const log of logs) {
    const text = log.text;

    if (text.includes('debugger')) {
      patterns.push({
        type: 'debugger',
        location: log.url || 'unknown',
        code: text.substring(0, 200),
      });
    }

    if (text.includes('console.log') && text.includes('=')) {
      patterns.push({
        type: 'console.log',
        location: log.url || 'unknown',
        code: text.substring(0, 200),
      });
    }

    if (text.includes('devtools') || text.includes('firebug')) {
      patterns.push({
        type: 'devtools-detect',
        location: log.url || 'unknown',
        code: text.substring(0, 200),
      });
    }

    if (text.includes('performance.now') || text.includes('Date.now')) {
      patterns.push({
        type: 'timing-check',
        location: log.url || 'unknown',
        code: text.substring(0, 200),
      });
    }
  }

  return patterns;
}

export function extractSuspiciousAPIs(requests: NetworkRequest[]): string[] {
  const apis = new Set<string>();

  for (const req of requests) {
    try {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path.includes('/api/') || path.includes('/v1/') || path.includes('/v2/')) {
        apis.add(`${req.method} ${path}`);
      }
    } catch {}
  }

  return Array.from(apis).slice(0, 20);
}

export function extractKeyFunctions(logs: ConsoleMessage[]): string[] {
  const functions = new Set<string>();

  const functionRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

  for (const log of logs) {
    const matches = log.text.matchAll(functionRegex);
    for (const match of matches) {
      const funcName = match[1];

      if (funcName && !['console', 'log', 'warn', 'error', 'info', 'debug'].includes(funcName)) {
        functions.add(funcName);
      }
    }
  }

  return Array.from(functions).slice(0, 30);
}
