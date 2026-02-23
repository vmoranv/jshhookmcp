import { DetailedDataManager } from './DetailedDataManager.js';

export interface SerializationContext {
  maxDepth?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  maxObjectKeys?: number;
  threshold?: number;
}

type DataType =
  | 'large-array'
  | 'deep-object'
  | 'code-string'
  | 'network-requests'
  | 'dom-structure'
  | 'function-tree'
  | 'primitive'
  | 'unknown';

export class AdaptiveDataSerializer {
  private readonly DEFAULT_CONTEXT: Required<SerializationContext> = {
    maxDepth: 3,
    maxArrayLength: 10,
    maxStringLength: 1000,
    maxObjectKeys: 20,
    threshold: 50 * 1024,
  };

  serialize(data: any, context: SerializationContext = {}): string {
    const ctx = { ...this.DEFAULT_CONTEXT, ...context };

    const type = this.detectType(data);

    switch (type) {
      case 'large-array':
        return this.serializeLargeArray(data, ctx);
      case 'deep-object':
        return this.serializeDeepObject(data, ctx);
      case 'code-string':
        return this.serializeCodeString(data, ctx);
      case 'network-requests':
        return this.serializeNetworkRequests(data, ctx);
      case 'dom-structure':
        return this.serializeDOMStructure(data, ctx);
      case 'function-tree':
        return this.serializeFunctionTree(data, ctx);
      case 'primitive':
        return JSON.stringify(data);
      default:
        return this.serializeDefault(data, ctx);
    }
  }

  private detectType(data: any): DataType {
    if (data === null || data === undefined) {
      return 'primitive';
    }

    const type = typeof data;

    if (type === 'string' || type === 'number' || type === 'boolean') {
      if (type === 'string' && this.isCodeString(data)) {
        return 'code-string';
      }
      return 'primitive';
    }

    if (Array.isArray(data)) {
      if (data.length > 0 && this.isNetworkRequest(data[0])) {
        return 'network-requests';
      }
      if (data.length > 100) {
        return 'large-array';
      }
    }

    if (type === 'object') {
      if (this.isDOMStructure(data)) {
        return 'dom-structure';
      }
      if (this.isFunctionTree(data)) {
        return 'function-tree';
      }
      if (this.getDepth(data) > 3) {
        return 'deep-object';
      }
    }

    return 'unknown';
  }

  private serializeLargeArray(arr: any[], ctx: Required<SerializationContext>): string {
    if (arr.length <= ctx.maxArrayLength) {
      return JSON.stringify(arr);
    }

    const sample = [...arr.slice(0, 5), ...arr.slice(-5)];

    const detailId = DetailedDataManager.getInstance().store(arr);

    return JSON.stringify({
      type: 'large-array',
      length: arr.length,
      sample,
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full array`,
    });
  }

  private serializeDeepObject(obj: any, ctx: Required<SerializationContext>): string {
    const limited = this.limitDepth(obj, ctx.maxDepth);
    return JSON.stringify(limited);
  }

  private serializeCodeString(code: string, _ctx: Required<SerializationContext>): string {
    const lines = code.split('\n');

    if (lines.length <= 100) {
      return JSON.stringify(code);
    }

    const preview = lines.slice(0, 50).join('\n');
    const detailId = DetailedDataManager.getInstance().store(code);

    return JSON.stringify({
      type: 'code-string',
      totalLines: lines.length,
      preview,
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full code`,
    });
  }

  private serializeNetworkRequests(requests: any[], ctx: Required<SerializationContext>): string {
    if (requests.length <= ctx.maxArrayLength) {
      return JSON.stringify(requests);
    }

    const summary = requests.map((req) => ({
      requestId: req.requestId,
      url: req.url,
      method: req.method,
      type: req.type,
      timestamp: req.timestamp,
    }));

    const detailId = DetailedDataManager.getInstance().store(requests);

    return JSON.stringify({
      type: 'network-requests',
      count: requests.length,
      summary: summary.slice(0, ctx.maxArrayLength),
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full requests`,
    });
  }

  private serializeDOMStructure(dom: any, ctx: Required<SerializationContext>): string {
    const limited = this.limitDepth(dom, ctx.maxDepth);
    return JSON.stringify(limited);
  }

  private serializeFunctionTree(tree: any, ctx: Required<SerializationContext>): string {
    const simplified = this.simplifyFunctionTree(tree, ctx.maxDepth);
    return JSON.stringify(simplified);
  }

  private serializeDefault(data: any, ctx: Required<SerializationContext>): string {
    const jsonStr = JSON.stringify(data);

    if (jsonStr.length <= ctx.threshold) {
      return jsonStr;
    }

    const detailId = DetailedDataManager.getInstance().store(data);

    return JSON.stringify({
      type: 'large-data',
      size: jsonStr.length,
      sizeKB: (jsonStr.length / 1024).toFixed(1),
      preview: jsonStr.substring(0, 500),
      detailId,
      hint: `Use get_detailed_data("${detailId}") to get full data`,
    });
  }

  private isCodeString(str: string): boolean {
    if (str.length < 100) return false;

    const codePatterns = [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /class\s+\w+/,
      /import\s+.*from/,
      /export\s+(default|const|function)/,
    ];

    return codePatterns.some((pattern) => pattern.test(str));
  }

  private isNetworkRequest(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      ('requestId' in obj || 'url' in obj) &&
      ('method' in obj || 'type' in obj)
    );
  }

  private isDOMStructure(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      ('tag' in obj || 'tagName' in obj) &&
      ('children' in obj || 'childNodes' in obj)
    );
  }

  private isFunctionTree(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      ('functionName' in obj || 'name' in obj) &&
      ('dependencies' in obj || 'calls' in obj || 'callGraph' in obj)
    );
  }

  private getDepth(obj: any, currentDepth = 0): number {
    if (obj === null || typeof obj !== 'object') {
      return currentDepth;
    }

    if (currentDepth > 10) return currentDepth;

    let maxDepth = currentDepth;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = this.getDepth(obj[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  private limitDepth(obj: any, maxDepth: number, currentDepth = 0): any {
    if (currentDepth >= maxDepth) {
      return '[Max depth reached]';
    }

    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.limitDepth(item, maxDepth, currentDepth + 1));
    }

    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = this.limitDepth(obj[key], maxDepth, currentDepth + 1);
      }
    }

    return result;
  }

  private simplifyFunctionTree(tree: any, maxDepth: number, currentDepth = 0): any {
    if (currentDepth >= maxDepth) {
      return { name: tree.functionName || tree.name, truncated: true };
    }

    return {
      name: tree.functionName || tree.name,
      dependencies: (tree.dependencies || []).map((dep: any) =>
        this.simplifyFunctionTree(dep, maxDepth, currentDepth + 1)
      ),
    };
  }
}
