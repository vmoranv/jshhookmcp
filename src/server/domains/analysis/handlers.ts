import { logger } from '../../../utils/logger.js';
import type { ToolArgs, ToolResponse } from '../../types.js';
import { asJsonResponse, asTextResponse, serializeError } from '../shared/response.js';
import { CodeCollector } from '../../../modules/collector/CodeCollector.js';
import { ScriptManager } from '../../../modules/debugger/ScriptManager.js';
import { Deobfuscator } from '../../../modules/deobfuscator/Deobfuscator.js';
import { AdvancedDeobfuscator } from '../../../modules/deobfuscator/AdvancedDeobfuscator.js';
import { ASTOptimizer } from '../../../modules/deobfuscator/ASTOptimizer.js';
import { ObfuscationDetector } from '../../../modules/detector/ObfuscationDetector.js';
import { CodeAnalyzer } from '../../../modules/analyzer/CodeAnalyzer.js';
import { CryptoDetector } from '../../../modules/crypto/CryptoDetector.js';
import { HookManager } from '../../../modules/hook/HookManager.js';

interface CoreAnalysisHandlerDeps {
  collector: CodeCollector;
  scriptManager: ScriptManager;
  deobfuscator: Deobfuscator;
  advancedDeobfuscator: AdvancedDeobfuscator;
  astOptimizer: ASTOptimizer;
  obfuscationDetector: ObfuscationDetector;
  analyzer: CodeAnalyzer;
  cryptoDetector: CryptoDetector;
  hookManager: HookManager;
}

export class CoreAnalysisHandlers {
  private readonly collector: CodeCollector;
  private readonly scriptManager: ScriptManager;
  private readonly deobfuscator: Deobfuscator;
  private readonly advancedDeobfuscator: AdvancedDeobfuscator;
  private readonly astOptimizer: ASTOptimizer;
  private readonly obfuscationDetector: ObfuscationDetector;
  private readonly analyzer: CodeAnalyzer;
  private readonly cryptoDetector: CryptoDetector;
  private readonly hookManager: HookManager;

  constructor(deps: CoreAnalysisHandlerDeps) {
    this.collector = deps.collector;
    this.scriptManager = deps.scriptManager;
    this.deobfuscator = deps.deobfuscator;
    this.advancedDeobfuscator = deps.advancedDeobfuscator;
    this.astOptimizer = deps.astOptimizer;
    this.obfuscationDetector = deps.obfuscationDetector;
    this.analyzer = deps.analyzer;
    this.cryptoDetector = deps.cryptoDetector;
    this.hookManager = deps.hookManager;
  }

  async handleCollectCode(args: ToolArgs): Promise<ToolResponse> {
    const returnSummaryOnly = (args.returnSummaryOnly as boolean) ?? false;
    let smartMode = args.smartMode as 'summary' | 'priority' | 'incremental' | 'full' | undefined;

    if (returnSummaryOnly && !smartMode) {
      smartMode = 'summary';
    }

    const result = await this.collector.collect({
      url: args.url as string,
      includeInline: args.includeInline as boolean | undefined,
      includeExternal: args.includeExternal as boolean | undefined,
      includeDynamic: args.includeDynamic as boolean | undefined,
      smartMode,
      compress: args.compress as boolean | undefined,
      maxTotalSize: args.maxTotalSize as number | undefined,
      maxFileSize: args.maxFileSize ? (args.maxFileSize as number) * 1024 : undefined,
      priorities: args.priorities as string[] | undefined,
    });

    if (returnSummaryOnly) {
      return asJsonResponse({
        mode: 'summary',
        totalSize: result.totalSize,
        totalSizeKB: (result.totalSize / 1024).toFixed(2),
        filesCount: result.files.length,
        collectTime: result.collectTime,
        summary: result.files.map((file: any) => ({
          url: file.url,
          type: file.type,
          size: file.size,
          sizeKB: (file.size / 1024).toFixed(2),
          truncated: file.metadata?.truncated || false,
          preview: `${file.content.substring(0, 200)}...`,
        })),
        hint: 'Use get_script_source for specific files.',
      });
    }

    const maxSafeSize = 1024 * 1024;
    if (result.totalSize > maxSafeSize) {
      logger.warn(
        `Collected code is too large (${(result.totalSize / 1024).toFixed(2)}KB), returning summary mode.`
      );

      return asJsonResponse({
        warning: 'Code size exceeds safe response threshold; summary returned.',
        totalSize: result.totalSize,
        totalSizeKB: (result.totalSize / 1024).toFixed(2),
        filesCount: result.files.length,
        collectTime: result.collectTime,
        summary: result.files.map((file: any) => ({
          url: file.url,
          type: file.type,
          size: file.size,
          sizeKB: (file.size / 1024).toFixed(2),
          truncated: file.metadata?.truncated || false,
          preview: `${file.content.substring(0, 200)}...`,
        })),
        recommendations: [
          'Use get_script_source for targeted files.',
          'Use more specific priority filters.',
          'Use smartMode=summary for initial reconnaissance.',
        ],
      });
    }

    return asJsonResponse(result);
  }

  async handleSearchInScripts(args: ToolArgs): Promise<ToolResponse> {
    await this.scriptManager.init();

    const maxMatches = (args.maxMatches as number) ?? 100;
    const returnSummary = (args.returnSummary as boolean) ?? false;
    const maxContextSize = (args.maxContextSize as number) ?? 50000;

    const result = await this.scriptManager.searchInScripts(args.keyword as string, {
      isRegex: args.isRegex as boolean,
      caseSensitive: args.caseSensitive as boolean,
      contextLines: args.contextLines as number,
      maxMatches,
    });

    const resultSize = JSON.stringify(result).length;
    const shouldSummarize = returnSummary || resultSize > maxContextSize;

    if (shouldSummarize) {
      return asJsonResponse({
        success: true,
        keyword: args.keyword,
        totalMatches: result.matches?.length || 0,
        resultSize,
        resultSizeKB: (resultSize / 1024).toFixed(2),
        truncated: resultSize > maxContextSize,
        reason:
          resultSize > maxContextSize
            ? `Result too large (${(resultSize / 1024).toFixed(2)}KB > ${(maxContextSize / 1024).toFixed(2)}KB)`
            : 'Summary mode enabled',
        matchesSummary: (result.matches || []).slice(0, 10).map((match: any) => ({
          scriptId: match.scriptId,
          url: match.url,
          line: match.line,
          preview: `${match.context?.substring(0, 100)}...`,
        })),
        recommendations: [
          'Use more specific keywords.',
          `Reduce maxMatches (current: ${maxMatches}).`,
          'Use get_script_source for targeted file retrieval.',
        ],
      });
    }

    return asJsonResponse(result);
  }

  async handleExtractFunctionTree(args: ToolArgs): Promise<ToolResponse> {
    await this.scriptManager.init();

    const result = await this.scriptManager.extractFunctionTree(
      args.scriptId as string,
      args.functionName as string,
      {
        maxDepth: args.maxDepth as number,
        maxSize: args.maxSize as number,
        includeComments: args.includeComments as boolean,
      }
    );

    return asJsonResponse(result);
  }

  async handleDeobfuscate(args: ToolArgs): Promise<ToolResponse> {
    const result = await this.deobfuscator.deobfuscate({
      code: args.code as string,
      llm: args.llm as 'gpt-4' | 'claude' | undefined,
      aggressive: args.aggressive as boolean | undefined,
    });

    return asJsonResponse(result);
  }

  async handleUnderstandCode(args: ToolArgs): Promise<ToolResponse> {
    const result = await this.analyzer.understand({
      code: args.code as string,
      context: args.context as Record<string, unknown> | undefined,
      focus: (args.focus as 'structure' | 'business' | 'security' | 'all') || 'all',
    });

    return asJsonResponse(result);
  }

  async handleDetectCrypto(args: ToolArgs): Promise<ToolResponse> {
    const result = await this.cryptoDetector.detect({
      code: args.code as string,
    });

    return asJsonResponse(result);
  }

  async handleManageHooks(args: ToolArgs): Promise<ToolResponse> {
    const action = args.action as string;

    switch (action) {
      case 'create': {
        const result = await this.hookManager.createHook({
          target: args.target as string,
          type: args.type as 'function' | 'xhr' | 'fetch' | 'websocket' | 'localstorage' | 'cookie',
          action: (args.hookAction as 'log' | 'block' | 'modify') || 'log',
          customCode: args.customCode as string | undefined,
        });
        return asJsonResponse(result);
      }
      case 'list':
        return asJsonResponse({ hooks: this.hookManager.getAllHooks() });
      case 'records':
        return asJsonResponse({
          records: this.hookManager.getHookRecords(args.hookId as string),
        });
      case 'clear':
        this.hookManager.clearHookRecords(args.hookId as string | undefined);
        return asJsonResponse({ success: true, message: 'Hook records cleared' });
      default:
        throw new Error(`Unknown hook action: ${action}`);
    }
  }

  async handleDetectObfuscation(args: ToolArgs): Promise<ToolResponse> {
    const code = args.code as string;
    const generateReport = (args.generateReport as boolean) ?? true;
    const result = this.obfuscationDetector.detect(code);

    if (!generateReport) {
      return asJsonResponse(result);
    }

    const report = this.obfuscationDetector.generateReport(result);
    return asTextResponse(`${JSON.stringify(result, null, 2)}\n\n${report}`);
  }

  async handleAdvancedDeobfuscate(args: ToolArgs): Promise<ToolResponse> {
    const detectOnly = (args.detectOnly as boolean) ?? false;
    const aggressiveVM = (args.aggressiveVM as boolean) ?? false;
    const useASTOptimization = (args.useASTOptimization as boolean) ?? true;
    const timeout = (args.timeout as number) ?? 60000;

    const result = await this.advancedDeobfuscator.deobfuscate({
      code: args.code as string,
      detectOnly,
      aggressiveVM,
      timeout,
    });

    let finalCode = result.code;
    if (useASTOptimization && !detectOnly) {
      finalCode = this.astOptimizer.optimize(finalCode);
    }

    return asJsonResponse({
      ...result,
      code: finalCode,
      astOptimized: useASTOptimization && !detectOnly,
    });
  }

  async handleClearCollectedData(): Promise<ToolResponse> {
    try {
      await this.collector.clearAllData();
      this.scriptManager.clear();
      return asJsonResponse({
        success: true,
        message: 'All collected data cleared.',
        cleared: {
          fileCache: true,
          compressionCache: true,
          collectedUrls: true,
          scriptManager: true,
        },
      });
    } catch (error) {
      logger.error('Failed to clear collected data:', error);
      return asJsonResponse(serializeError(error));
    }
  }

  async handleGetCollectionStats(): Promise<ToolResponse> {
    try {
      const stats = await this.collector.getAllStats();
      return asJsonResponse({
        success: true,
        stats,
        summary: {
          totalCachedFiles: stats.cache.memoryEntries + stats.cache.diskEntries,
          totalCacheSize: `${(stats.cache.totalSize / 1024).toFixed(2)} KB`,
          compressionRatio: `${stats.compression.averageRatio.toFixed(1)}%`,
          cacheHitRate:
            stats.compression.cacheHits > 0
              ? `${(
                  (stats.compression.cacheHits /
                    (stats.compression.cacheHits + stats.compression.cacheMisses)) *
                  100
                ).toFixed(1)}%`
              : '0%',
          collectedUrls: stats.collector.collectedUrls,
        },
      });
    } catch (error) {
      logger.error('Failed to get collection stats:', error);
      return asJsonResponse(serializeError(error));
    }
  }
}
