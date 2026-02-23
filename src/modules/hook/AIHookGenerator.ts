import { logger } from '../../utils/logger.js';

export interface AIHookRequest {
  description: string;

  target: {
    type: 'function' | 'object-method' | 'api' | 'property' | 'event' | 'custom';
    name?: string;
    pattern?: string;
    object?: string;
    property?: string;
  };

  behavior: {
    captureArgs?: boolean;
    captureReturn?: boolean;
    captureStack?: boolean;
    modifyArgs?: boolean;
    modifyReturn?: boolean;
    blockExecution?: boolean;
    logToConsole?: boolean;
  };

  condition?: {
    argFilter?: string;
    returnFilter?: string;
    urlPattern?: string;
    maxCalls?: number;
  };

  customCode?: {
    before?: string;
    after?: string;
    replace?: string;
  };
}

export interface AIHookResponse {
  success: boolean;
  hookId: string;
  generatedCode: string;
  explanation: string;
  injectionMethod: 'evaluateOnNewDocument' | 'evaluate' | 'addScriptTag';
  warnings?: string[];
}

export class AIHookGenerator {
  private hookCounter = 0;

  generateHook(request: AIHookRequest): AIHookResponse {
    logger.info(` AI Hook Generator: ${request.description}`);

    const hookId = `ai-hook-${++this.hookCounter}-${Date.now()}`;
    const warnings: string[] = [];

    try {
      let generatedCode = '';
      let explanation = '';
      let injectionMethod: AIHookResponse['injectionMethod'] = 'evaluateOnNewDocument';

      switch (request.target.type) {
        case 'function':
          ({ code: generatedCode, explanation } = this.generateFunctionHook(request, hookId));
          break;

        case 'object-method':
          ({ code: generatedCode, explanation } = this.generateObjectMethodHook(request, hookId));
          break;

        case 'api':
          ({ code: generatedCode, explanation } = this.generateAPIHook(request, hookId));
          injectionMethod = 'evaluateOnNewDocument';
          break;

        case 'property':
          ({ code: generatedCode, explanation } = this.generatePropertyHook(request, hookId));
          break;

        case 'event':
          ({ code: generatedCode, explanation } = this.generateEventHook(request, hookId));
          injectionMethod = 'evaluate';
          break;

        case 'custom':
          ({ code: generatedCode, explanation } = this.generateCustomHook(request, hookId));
          break;

        default:
          throw new Error(`Unsupported target type: ${request.target.type}`);
      }

      generatedCode = this.wrapWithGlobalStorage(generatedCode, hookId);

      this.validateGeneratedCode(generatedCode, warnings);

      logger.success(` Hook generated: ${hookId}`);

      return {
        success: true,
        hookId,
        generatedCode,
        explanation,
        injectionMethod,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('Failed to generate hook', error);
      return {
        success: false,
        hookId,
        generatedCode: '',
        explanation: `Error: ${error instanceof Error ? error.message : String(error)}`,
        injectionMethod: 'evaluateOnNewDocument',
        warnings: ['Hook generation failed'],
      };
    }
  }

  private generateFunctionHook(
    request: AIHookRequest,
    hookId: string
  ): { code: string; explanation: string } {
    const { target, behavior, condition, customCode } = request;
    const functionName = target.name || target.pattern || 'unknownFunction';

    let code = `
(function() {
  const originalFunction = window.${functionName};
  
  if (typeof originalFunction !== 'function') {
    console.warn('[${hookId}] Function not found: ${functionName}');
    return;
  }
  
  let callCount = 0;
  const maxCalls = ${condition?.maxCalls || 'Infinity'};
  
  window.${functionName} = function(...args) {
    callCount++;
    
    if (callCount > maxCalls) {
      return originalFunction.apply(this, args);
    }
    
    const hookData = {
      hookId: '${hookId}',
      functionName: '${functionName}',
      callCount,
      timestamp: Date.now(),
      ${behavior.captureArgs ? 'args: args,' : ''}
      ${behavior.captureStack ? 'stack: new Error().stack,' : ''}
    };
    
    ${customCode?.before || ''}
    
    ${
      condition?.argFilter
        ? `
    const argFilterPassed = (function() {
      try {
        return ${condition.argFilter};
      } catch (e) {
        console.error('[${hookId}] Arg filter error:', e);
        return true;
      }
    })();
    
    if (!argFilterPassed) {
      return originalFunction.apply(this, args);
    }
    `
        : ''
    }
    
    ${
      behavior.logToConsole
        ? `
    console.log('[${hookId}] Function called:', hookData);
    `
        : ''
    }
    
    ${
      behavior.blockExecution
        ? `
    console.warn('[${hookId}] Execution blocked');
    return undefined;
    `
        : `
    const startTime = performance.now();
    const result = originalFunction.apply(this, args);
    const executionTime = performance.now() - startTime;
    
    ${
      behavior.captureReturn
        ? `
    hookData.returnValue = result;
    hookData.executionTime = executionTime;
    `
        : ''
    }
    
    ${customCode?.after || ''}
    
    if (!window.__aiHooks) window.__aiHooks = {};
    if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
    window.__aiHooks['${hookId}'].push(hookData);
    
    return result;
    `
    }
  };
  
  console.log('[${hookId}] Hook installed for: ${functionName}');
})();
`;

    const explanation = `
Hook: ${functionName}
- : ${behavior.captureArgs ? '' : ''}
- : ${behavior.captureReturn ? '' : ''}
- : ${behavior.captureStack ? '' : ''}
- : ${behavior.blockExecution ? '' : ''}
${condition?.maxCalls ? `- : ${condition.maxCalls}` : ''}
`;

    return { code, explanation };
  }

  private generateObjectMethodHook(
    request: AIHookRequest,
    hookId: string
  ): { code: string; explanation: string } {
    const { target, behavior } = request;
    const objectPath = target.object || 'window';
    const methodName = target.property || target.name || 'unknownMethod';

    const code = `
(function() {
  const targetObject = ${objectPath};
  const methodName = '${methodName}';
  
  if (!targetObject || typeof targetObject[methodName] !== 'function') {
    console.warn('[${hookId}] Method not found: ${objectPath}.${methodName}');
    return;
  }
  
  const originalMethod = targetObject[methodName];
  let callCount = 0;
  
  targetObject[methodName] = function(...args) {
    callCount++;
    
    const hookData = {
      hookId: '${hookId}',
      object: '${objectPath}',
      method: '${methodName}',
      callCount,
      timestamp: Date.now(),
      ${behavior.captureArgs ? 'args: args,' : ''}
      ${behavior.captureStack ? 'stack: new Error().stack,' : ''}
    };
    
    ${
      behavior.logToConsole
        ? `
    console.log('[${hookId}] Method called:', hookData);
    `
        : ''
    }
    
    const result = originalMethod.apply(this, args);
    
    ${
      behavior.captureReturn
        ? `
    hookData.returnValue = result;
    `
        : ''
    }
    
    if (!window.__aiHooks) window.__aiHooks = {};
    if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
    window.__aiHooks['${hookId}'].push(hookData);
    
    return result;
  };
  
  console.log('[${hookId}] Hook installed for: ${objectPath}.${methodName}');
})();
`;

    const explanation = `Hook: ${objectPath}.${methodName}`;
    return { code, explanation };
  }

  private generateAPIHook(
    request: AIHookRequest,
    hookId: string
  ): { code: string; explanation: string } {
    const apiName = request.target.name || 'fetch';

    let code = '';

    if (apiName === 'fetch') {
      code = this.generateFetchAPIHook(request, hookId);
    } else if (apiName === 'XMLHttpRequest') {
      code = this.generateXHRAPIHook(request, hookId);
    } else {
      code = `console.error('[${hookId}] Unsupported API: ${apiName}');`;
    }

    const explanation = `HookAPI: ${apiName}`;
    return { code, explanation };
  }

  private generateFetchAPIHook(request: AIHookRequest, hookId: string): string {
    const { behavior, condition } = request;

    return `
(function() {
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    const [url, options] = args;
    
    ${
      condition?.urlPattern
        ? `
    const urlPattern = new RegExp('${condition.urlPattern}');
    if (!urlPattern.test(url)) {
      return originalFetch.apply(this, args);
    }
    `
        : ''
    }
    
    const hookData = {
      hookId: '${hookId}',
      type: 'fetch',
      url: url,
      method: options?.method || 'GET',
      timestamp: Date.now(),
      ${behavior.captureArgs ? 'options: options,' : ''}
    };
    
    ${
      behavior.logToConsole
        ? `
    console.log('[${hookId}] Fetch request:', hookData);
    `
        : ''
    }
    
    return originalFetch.apply(this, args).then(response => {
      ${
        behavior.captureReturn
          ? `
      hookData.status = response.status;
      hookData.statusText = response.statusText;
      `
          : ''
      }
      
      if (!window.__aiHooks) window.__aiHooks = {};
      if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
      window.__aiHooks['${hookId}'].push(hookData);
      
      return response;
    });
  };
  
  console.log('[${hookId}] Fetch Hook installed');
})();
`;
  }

  private generateXHRAPIHook(_request: AIHookRequest, hookId: string): string {
    return `
(function() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__hookData = {
      hookId: '${hookId}',
      type: 'xhr',
      method,
      url,
      timestamp: Date.now(),
    };
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    const xhr = this;
    
    xhr.addEventListener('load', function() {
      if (xhr.__hookData) {
        xhr.__hookData.status = xhr.status;
        xhr.__hookData.response = xhr.responseText;
        
        if (!window.__aiHooks) window.__aiHooks = {};
        if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
        window.__aiHooks['${hookId}'].push(xhr.__hookData);
      }
    });
    
    return originalSend.apply(this, args);
  };
  
  console.log('[${hookId}] XHR Hook installed');
})();
`;
  }

  private generatePropertyHook(
    request: AIHookRequest,
    hookId: string
  ): { code: string; explanation: string } {
    const { target, behavior, condition } = request;
    const objectPath = target.object || 'window';
    const propertyName = target.property || target.name || 'unknownProperty';

    const code = `
(function() {
  const targetObject = ${objectPath};
  const propName = '${propertyName}';

  if (!targetObject) {
    console.warn('[${hookId}] Object not found: ${objectPath}');
    return;
  }

  const descriptor = Object.getOwnPropertyDescriptor(targetObject, propName)
    || (Object.getPrototypeOf(targetObject)
        ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(targetObject), propName)
        : undefined);

  let currentValue = descriptor ? descriptor.value : targetObject[propName];
  const originalGet = descriptor && descriptor.get ? descriptor.get : null;
  const originalSet = descriptor && descriptor.set ? descriptor.set : null;
  let callCount = 0;

  Object.defineProperty(targetObject, propName, {
    configurable: true,
    enumerable: true,
    get() {
      callCount++;
      const value = originalGet ? originalGet.call(this) : currentValue;

      const hookData = {
        hookId: '${hookId}',
        type: 'property-get',
        object: '${objectPath}',
        property: propName,
        callCount,
        timestamp: Date.now(),
        ${behavior.captureReturn ? 'value: value,' : ''}
        ${behavior.captureStack ? 'stack: new Error().stack,' : ''}
      };

      ${behavior.logToConsole ? `console.log('[${hookId}] Property get:', hookData);` : ''}

      if (!window.__aiHooks) window.__aiHooks = {};
      if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
      window.__aiHooks['${hookId}'].push(hookData);

      return value;
    },
    set(newValue) {
      callCount++;

      ${
        condition?.argFilter
          ? `
      const args = [newValue];
      const argFilterPassed = (function() {
        try { return ${condition.argFilter}; } catch(e) { return true; }
      })();
      if (!argFilterPassed) {
        if (originalSet) originalSet.call(this, newValue); else currentValue = newValue;
        return;
      }
      `
          : ''
      }

      const hookData = {
        hookId: '${hookId}',
        type: 'property-set',
        object: '${objectPath}',
        property: propName,
        callCount,
        timestamp: Date.now(),
        ${behavior.captureArgs ? 'newValue: newValue,' : ''}
        ${behavior.captureStack ? 'stack: new Error().stack,' : ''}
      };

      ${behavior.logToConsole ? `console.log('[${hookId}] Property set:', hookData);` : ''}

      if (!window.__aiHooks) window.__aiHooks = {};
      if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
      window.__aiHooks['${hookId}'].push(hookData);

      if (!${behavior.blockExecution ? 'true' : 'false'}) {
        if (originalSet) originalSet.call(this, newValue); else currentValue = newValue;
      }
    },
  });

  console.log('[${hookId}] Property hook installed for: ${objectPath}.${propertyName}');
})();
`;

    const explanation = `Property hook: ${objectPath}.${propertyName} (get + set intercepted via Object.defineProperty)`;
    return { code, explanation };
  }

  private generateEventHook(
    request: AIHookRequest,
    hookId: string
  ): { code: string; explanation: string } {
    const { target, behavior, condition } = request;
    const eventType = target.name || target.property || '';
    const maxCalls = condition?.maxCalls || 'Infinity';

    const code = `
(function() {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  let callCount = 0;

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    ${
      eventType
        ? `if (type !== '${eventType}') {
      return originalAddEventListener.call(this, type, listener, options);
    }`
        : ''
    }

    const wrappedListener = function(event) {
      callCount++;
      const maxCalls = ${maxCalls};

      if (callCount <= maxCalls) {
        const hookData = {
          hookId: '${hookId}',
          type: 'event',
          eventType: type,
          callCount,
          timestamp: Date.now(),
          ${
            behavior.captureArgs
              ? `event: {
            type: event.type,
            target: event.target ? (event.target.tagName || String(event.target)) : null,
            detail: event.detail != null ? event.detail : null,
          },`
              : ''
          }
          ${behavior.captureStack ? 'stack: new Error().stack,' : ''}
        };

        ${behavior.logToConsole ? `console.log('[${hookId}] Event fired:', hookData);` : ''}

        if (!window.__aiHooks) window.__aiHooks = {};
        if (!window.__aiHooks['${hookId}']) window.__aiHooks['${hookId}'] = [];
        window.__aiHooks['${hookId}'].push(hookData);
      }

      ${
        behavior.blockExecution
          ? `// Execution blocked`
          : `if (typeof listener === 'function') {
        listener.call(this, event);
      } else if (listener && typeof listener.handleEvent === 'function') {
        listener.handleEvent(event);
      }`
      }
    };

    return originalAddEventListener.call(this, type, wrappedListener, options);
  };

  console.log('[${hookId}] Event hook installed for: ${eventType || 'all events'}');
})();
`;

    const explanation = `Event hook: ${eventType ? `"${eventType}" events` : 'all events'} via EventTarget.prototype.addEventListener override`;
    return { code, explanation };
  }

  private generateCustomHook(
    request: AIHookRequest,
    _hookId: string
  ): { code: string; explanation: string } {
    const code = request.customCode?.replace || ``;
    const explanation = 'Custom Hook code provided by user';
    return { code, explanation };
  }

  private wrapWithGlobalStorage(code: string, hookId: string): string {
    return `
// Initialize __aiHooks and __aiHookMetadata independently to avoid race conditions
if (typeof window.__aiHooks === 'undefined') {
  window.__aiHooks = {};
}
if (typeof window.__aiHookMetadata === 'undefined') {
  window.__aiHookMetadata = {};
}

window.__aiHookMetadata['${hookId}'] = {
  id: '${hookId}',
  createdAt: Date.now(),
  enabled: true,
};

${code}
`;
  }

  private validateGeneratedCode(code: string, warnings: string[]): void {
    if (code.includes('eval(') || code.includes('Function(')) {
      warnings.push('Generated code contains eval() or Function(), which may be dangerous');
    }

    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      warnings.push('Possible syntax error: unmatched braces');
    }
  }
}
