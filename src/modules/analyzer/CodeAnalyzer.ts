import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type {
  UnderstandCodeOptions,
  UnderstandCodeResult,
  CodeStructure,
  TechStack,
  BusinessLogic,
  DataFlow,
  FunctionInfo,
  ClassInfo,
  CallGraph,
} from '../../types/index.js';
import { LLMService } from '../../services/LLMService.js';
import { generateCodeAnalysisPrompt } from '../../services/prompts/analysis.js';
import { generateTaintAnalysisPrompt } from '../../services/prompts/taint.js';
import { logger } from '../../utils/logger.js';
import { identifySecurityRisks, checkSanitizer } from './SecurityCodeAnalyzer.js';
import {
  calculateQualityScore,
  detectCodePatterns,
  analyzeComplexityMetrics,
} from './QualityAnalyzer.js';

export class CodeAnalyzer {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  async understand(options: UnderstandCodeOptions): Promise<UnderstandCodeResult> {
    logger.info('Starting code understanding...');
    const startTime = Date.now();

    try {
      const { code, context, focus = 'all' } = options;

      const structure = await this.analyzeStructure(code);
      logger.debug('Code structure analyzed');

      const aiAnalysis = await this.aiAnalyze(code, focus);
      logger.debug('AI analysis completed');

      const techStack = this.detectTechStack(code, aiAnalysis);
      logger.debug('Tech stack detected');

      const businessLogic = this.extractBusinessLogic(aiAnalysis, context);
      logger.debug('Business logic extracted');

      const dataFlow = await this.analyzeDataFlow(code);
      logger.debug('Data flow analyzed');

      const securityRisks = identifySecurityRisks(code, aiAnalysis);
      logger.debug('Security risks identified');

      const { patterns, antiPatterns } = detectCodePatterns(code);
      logger.debug(`Detected ${patterns.length} patterns and ${antiPatterns.length} anti-patterns`);

      const complexityMetrics = analyzeComplexityMetrics(code);
      logger.debug('Complexity metrics calculated');

      const qualityScore = calculateQualityScore(
        structure,
        securityRisks,
        aiAnalysis,
        complexityMetrics,
        antiPatterns
      );

      const duration = Date.now() - startTime;
      logger.success(`Code understanding completed in ${duration}ms`);

      return {
        structure,
        techStack,
        businessLogic,
        dataFlow,
        securityRisks,
        qualityScore,
        codePatterns: patterns,
        antiPatterns,
        complexityMetrics,
      };
    } catch (error) {
      logger.error('Code understanding failed', error);
      throw error;
    }
  }

  private async analyzeStructure(code: string): Promise<CodeStructure> {
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const self = this;

      traverse(ast, {
        FunctionDeclaration(path) {
          const node = path.node;
          functions.push({
            name: node.id?.name || 'anonymous',
            params: node.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
            complexity: self.calculateComplexity(path),
          });
        },

        FunctionExpression(path) {
          const node = path.node;
          const parent = path.parent;
          let name = 'anonymous';

          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            name = parent.id.name;
          } else if (parent.type === 'AssignmentExpression' && parent.left.type === 'Identifier') {
            name = parent.left.name;
          }

          functions.push({
            name,
            params: node.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
            complexity: self.calculateComplexity(path),
          });
        },

        ArrowFunctionExpression(path) {
          const node = path.node;
          const parent = path.parent;
          let name = 'arrow';

          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            name = parent.id.name;
          }

          functions.push({
            name,
            params: node.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
            complexity: self.calculateComplexity(path),
          });
        },

        ClassDeclaration(path) {
          const node = path.node;
          const methods: FunctionInfo[] = [];
          const properties: ClassInfo['properties'] = [];

          path.traverse({
            ClassMethod(methodPath) {
              const method = methodPath.node;
              methods.push({
                name: method.key.type === 'Identifier' ? method.key.name : 'unknown',
                params: method.params.map((p) => (p.type === 'Identifier' ? p.name : 'unknown')),
                location: {
                  file: 'current',
                  line: method.loc?.start.line || 0,
                  column: method.loc?.start.column,
                },
                complexity: 1,
              });
            },
            ClassProperty(propertyPath) {
              const property = propertyPath.node;
              if (property.key.type === 'Identifier') {
                properties.push({
                  name: property.key.name,
                  type: undefined,
                  value: undefined,
                });
              }
            },
          });

          classes.push({
            name: node.id?.name || 'anonymous',
            methods,
            properties,
            location: {
              file: 'current',
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column,
            },
          });
        },
      });
    } catch (error) {
      logger.warn('Failed to parse code structure', error);
    }

    const modules = this.analyzeModules(code);

    const callGraph = this.buildCallGraph(functions, code);

    return {
      functions,
      classes,
      modules,
      callGraph,
    };
  }

  private async aiAnalyze(code: string, focus: string): Promise<Record<string, unknown>> {
    try {
      const messages = generateCodeAnalysisPrompt(code, focus);
      const response = await this.llm.chat(messages, { temperature: 0.3, maxTokens: 2000 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      }

      return { rawAnalysis: response.content };
    } catch (error) {
      logger.warn('AI analysis failed, using fallback', error);
      return {};
    }
  }

  private detectTechStack(code: string, aiAnalysis: Record<string, unknown>): TechStack {
    const techStack: TechStack = {
      other: [],
    };

    if (aiAnalysis.techStack && typeof aiAnalysis.techStack === 'object') {
      const ts = aiAnalysis.techStack as Record<string, unknown>;
      techStack.framework = ts.framework as string | undefined;
      techStack.bundler = ts.bundler as string | undefined;
      if (Array.isArray(ts.libraries)) {
        techStack.other = ts.libraries as string[];
      }
    }

    if (code.includes('React.') || code.includes('useState') || code.includes('useEffect')) {
      techStack.framework = 'React';
    } else if (code.includes('Vue.') || code.includes('createApp')) {
      techStack.framework = 'Vue';
    } else if (code.includes('@angular/')) {
      techStack.framework = 'Angular';
    }

    if (code.includes('__webpack_require__')) {
      techStack.bundler = 'Webpack';
    }

    const cryptoLibs: string[] = [];
    if (code.includes('CryptoJS')) cryptoLibs.push('CryptoJS');
    if (code.includes('JSEncrypt')) cryptoLibs.push('JSEncrypt');
    if (code.includes('crypto-js')) cryptoLibs.push('crypto-js');
    if (cryptoLibs.length > 0) {
      techStack.cryptoLibrary = cryptoLibs;
    }

    return techStack;
  }

  private extractBusinessLogic(
    aiAnalysis: Record<string, unknown>,
    context?: Record<string, unknown>
  ): BusinessLogic {
    const businessLogic: BusinessLogic = {
      mainFeatures: [],
      entities: [],
      rules: [],
      dataModel: {},
    };

    if (aiAnalysis.businessLogic && typeof aiAnalysis.businessLogic === 'object') {
      const bl = aiAnalysis.businessLogic as Record<string, unknown>;
      if (Array.isArray(bl.mainFeatures)) {
        businessLogic.mainFeatures = bl.mainFeatures as string[];
      }
      if (typeof bl.dataFlow === 'string') {
        businessLogic.rules.push(bl.dataFlow);
      }
    }

    if (context) {
      businessLogic.dataModel = { ...businessLogic.dataModel, ...context };
    }

    return businessLogic;
  }

  private analyzeModules(code: string): CodeStructure['modules'] {
    const modules: CodeStructure['modules'] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const imports: string[] = [];
      const exports: string[] = [];

      traverse(ast, {
        ImportDeclaration(path) {
          imports.push(path.node.source.value);
        },
        ExportNamedDeclaration(path) {
          if (path.node.source) {
            exports.push(path.node.source.value);
          }
        },
        ExportDefaultDeclaration() {
          exports.push('default');
        },
      });

      if (imports.length > 0 || exports.length > 0) {
        modules.push({
          name: 'current',
          imports,
          exports,
        });
      }
    } catch (error) {
      logger.warn('Module analysis failed', error);
    }

    return modules;
  }

  private buildCallGraph(functions: FunctionInfo[], code: string): CallGraph {
    const nodes: CallGraph['nodes'] = functions.map((fn) => ({
      id: fn.name,
      name: fn.name,
      type: 'function' as const,
    }));

    const edges: CallGraph['edges'] = [];

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let currentFunction = '';

      traverse(ast, {
        FunctionDeclaration(path) {
          currentFunction = path.node.id?.name || '';
        },
        FunctionExpression(path) {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            currentFunction = parent.id.name;
          }
        },
        CallExpression(path) {
          if (currentFunction) {
            const callee = path.node.callee;
            let calledFunction = '';

            if (callee.type === 'Identifier') {
              calledFunction = callee.name;
            } else if (
              callee.type === 'MemberExpression' &&
              callee.property.type === 'Identifier'
            ) {
              calledFunction = callee.property.name;
            }

            if (calledFunction && functions.some((f) => f.name === calledFunction)) {
              edges.push({
                from: currentFunction,
                to: calledFunction,
              });
            }
          }
        },
      });
    } catch (error) {
      logger.warn('Call graph construction failed', error);
    }

    return { nodes, edges };
  }

  private calculateComplexity(path: unknown): number {
    let complexity = 1;

    const anyPath = path as any;

    if (anyPath.traverse) {
      anyPath.traverse({
        IfStatement() {
          complexity++;
        },
        SwitchCase() {
          complexity++;
        },
        ForStatement() {
          complexity++;
        },
        WhileStatement() {
          complexity++;
        },
        DoWhileStatement() {
          complexity++;
        },
        ConditionalExpression() {
          complexity++;
        },
        LogicalExpression(logicalPath: any) {
          if (logicalPath.node.operator === '&&' || logicalPath.node.operator === '||') {
            complexity++;
          }
        },
        CatchClause() {
          complexity++;
        },
      });
    }

    return complexity;
  }

  private async analyzeDataFlow(code: string): Promise<DataFlow> {
    const graph: DataFlow['graph'] = { nodes: [], edges: [] };
    const sources: DataFlow['sources'] = [];
    const sinks: DataFlow['sinks'] = [];
    const taintPaths: DataFlow['taintPaths'] = [];

    const taintMap = new Map<string, { sourceType: string; sourceLine: number }>();

    const sanitizers = new Set([
      'encodeURIComponent',
      'encodeURI',
      'escape',
      'decodeURIComponent',
      'decodeURI',
      'htmlentities',
      'htmlspecialchars',
      'escapeHtml',
      'escapeHTML',
      'he.encode',
      'he.escape',
      'validator.escape',
      'validator.unescape',
      'validator.stripLow',
      'validator.blacklist',
      'validator.whitelist',
      'validator.trim',
      'validator.isEmail',
      'validator.isURL',
      'validator.isInt',
      'DOMPurify.sanitize',
      'DOMPurify.addHook',
      'crypto.encrypt',
      'crypto.hash',
      'crypto.createHash',
      'crypto.createHmac',
      'CryptoJS.AES.encrypt',
      'CryptoJS.SHA256',
      'CryptoJS.MD5',
      'bcrypt.hash',
      'bcrypt.compare',
      'btoa',
      'atob',
      'Buffer.from',
      'db.prepare',
      'db.query',
      'mysql.escape',
      'pg.query',
      'xss',
      'sanitizeHtml',
      'parseInt',
      'parseFloat',
      'Number',
      'String',
      'JSON.stringify',
      'JSON.parse',
      'String.prototype.replace',
      'String.prototype.trim',
      'Array.prototype.filter',
      'Array.prototype.map',
    ]);

    try {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const self = this;

      traverse(ast, {
        CallExpression(path) {
          const callee = path.node.callee;
          const line = path.node.loc?.start.line || 0;

          if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;

            if (['fetch', 'ajax', 'get', 'post', 'request', 'axios'].includes(methodName)) {
              const sourceId = `source-network-${line}`;
              sources.push({ type: 'network', location: { file: 'current', line } });
              graph.nodes.push({
                id: sourceId,
                name: `${methodName}()`,
                type: 'source',
                location: { file: 'current', line },
              });

              const parent = path.parent;
              if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
                taintMap.set(parent.id.name, { sourceType: 'network', sourceLine: line });
              }
            } else if (
              [
                'querySelector',
                'getElementById',
                'getElementsByClassName',
                'getElementsByTagName',
              ].includes(methodName)
            ) {
              const sourceId = `source-dom-${line}`;
              sources.push({ type: 'user_input', location: { file: 'current', line } });
              graph.nodes.push({
                id: sourceId,
                name: `${methodName}()`,
                type: 'source',
                location: { file: 'current', line },
              });
            }
          }

          if (t.isIdentifier(callee)) {
            const funcName = callee.name;

            if (['eval', 'Function', 'setTimeout', 'setInterval'].includes(funcName)) {
              const sinkId = `sink-eval-${line}`;
              sinks.push({ type: 'eval', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${funcName}()`,
                type: 'sink',
                location: { file: 'current', line },
              });

              self.checkTaintedArguments(path.node.arguments, taintMap, taintPaths, funcName, line);
            }
          }

          if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;

            if (
              ['write', 'writeln'].includes(methodName) &&
              t.isIdentifier(callee.object) &&
              callee.object.name === 'document'
            ) {
              const sinkId = `sink-document-write-${line}`;
              sinks.push({ type: 'xss', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `document.${methodName}()`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(
                path.node.arguments,
                taintMap,
                taintPaths,
                methodName,
                line
              );
            }

            if (['query', 'execute', 'exec', 'run'].includes(methodName)) {
              const sinkId = `sink-sql-${line}`;
              sinks.push({ type: 'sql-injection', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${methodName}() (SQL)`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(
                path.node.arguments,
                taintMap,
                taintPaths,
                methodName,
                line
              );
            }

            if (['exec', 'spawn', 'execSync', 'spawnSync'].includes(methodName)) {
              const sinkId = `sink-command-${line}`;
              sinks.push({ type: 'other', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${methodName}() (Command)`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(
                path.node.arguments,
                taintMap,
                taintPaths,
                methodName,
                line
              );
            }

            if (
              ['readFile', 'writeFile', 'readFileSync', 'writeFileSync', 'open'].includes(
                methodName
              )
            ) {
              const sinkId = `sink-file-${line}`;
              sinks.push({ type: 'other', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: `${methodName}() (File)`,
                type: 'sink',
                location: { file: 'current', line },
              });
              self.checkTaintedArguments(
                path.node.arguments,
                taintMap,
                taintPaths,
                methodName,
                line
              );
            }
          }
        },

        MemberExpression(path) {
          const obj = path.node.object;
          const prop = path.node.property;
          const line = path.node.loc?.start.line || 0;

          if (t.isIdentifier(obj) && obj.name === 'location' && t.isIdentifier(prop)) {
            if (['href', 'search', 'hash', 'pathname'].includes(prop.name)) {
              const sourceId = `source-url-${line}`;
              sources.push({ type: 'user_input', location: { file: 'current', line } });
              graph.nodes.push({
                id: sourceId,
                name: `location.${prop.name}`,
                type: 'source',
                location: { file: 'current', line },
              });

              const parent = path.parent;
              if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
                taintMap.set(parent.id.name, { sourceType: 'url', sourceLine: line });
              }
            }
          }

          if (
            t.isIdentifier(obj) &&
            obj.name === 'document' &&
            t.isIdentifier(prop) &&
            prop.name === 'cookie'
          ) {
            const sourceId = `source-cookie-${line}`;
            sources.push({ type: 'storage', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'document.cookie',
              type: 'source',
              location: { file: 'current', line },
            });
          }

          if (t.isIdentifier(obj) && ['localStorage', 'sessionStorage'].includes(obj.name)) {
            const sourceId = `source-storage-${line}`;
            sources.push({ type: 'storage', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: `${obj.name}.getItem()`,
              type: 'source',
              location: { file: 'current', line },
            });
          }

          if (
            t.isIdentifier(obj) &&
            obj.name === 'window' &&
            t.isIdentifier(prop) &&
            prop.name === 'name'
          ) {
            const sourceId = `source-window-name-${line}`;
            sources.push({ type: 'user_input', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'window.name',
              type: 'source',
              location: { file: 'current', line },
            });
          }

          if (
            t.isIdentifier(obj) &&
            obj.name === 'event' &&
            t.isIdentifier(prop) &&
            prop.name === 'data'
          ) {
            const sourceId = `source-postmessage-${line}`;
            sources.push({ type: 'network', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'event.data (postMessage)',
              type: 'source',
              location: { file: 'current', line },
            });
          }

          if (
            t.isIdentifier(obj) &&
            obj.name === 'message' &&
            t.isIdentifier(prop) &&
            prop.name === 'data'
          ) {
            const sourceId = `source-websocket-${line}`;
            sources.push({ type: 'network', location: { file: 'current', line } });
            graph.nodes.push({
              id: sourceId,
              name: 'WebSocket message.data',
              type: 'source',
              location: { file: 'current', line },
            });
          }
        },

        AssignmentExpression(path) {
          const left = path.node.left;
          const right = path.node.right;
          const line = path.node.loc?.start.line || 0;

          if (t.isMemberExpression(left) && t.isIdentifier(left.property)) {
            const propName = left.property.name;
            if (['innerHTML', 'outerHTML'].includes(propName)) {
              const sinkId = `sink-dom-${line}`;
              sinks.push({ type: 'xss', location: { file: 'current', line } });
              graph.nodes.push({
                id: sinkId,
                name: propName,
                type: 'sink',
                location: { file: 'current', line },
              });

              if (t.isIdentifier(right) && taintMap.has(right.name)) {
                const taintInfo = taintMap.get(right.name)!;
                taintPaths.push({
                  source: {
                    type: taintInfo.sourceType as DataFlow['sources'][0]['type'],
                    location: { file: 'current', line: taintInfo.sourceLine },
                  },
                  sink: { type: 'xss', location: { file: 'current', line } },
                  path: [
                    { file: 'current', line: taintInfo.sourceLine },
                    { file: 'current', line },
                  ],
                });
              }
            }
          }
        },
      });

      traverse(ast, {
        VariableDeclarator(path) {
          const id = path.node.id;
          const init = path.node.init;

          if (t.isIdentifier(id) && init) {
            if (t.isCallExpression(init) && checkSanitizer(init, sanitizers)) {
              const arg = init.arguments[0];
              if (t.isIdentifier(arg) && taintMap.has(arg.name)) {
                logger.debug(`Taint cleaned by sanitizer: ${arg.name} -> ${id.name}`);
                return;
              }
            }

            if (t.isIdentifier(init) && taintMap.has(init.name)) {
              const taintInfo = taintMap.get(init.name)!;
              taintMap.set(id.name, taintInfo);
            } else if (t.isBinaryExpression(init)) {
              const leftTainted = t.isIdentifier(init.left) && taintMap.has(init.left.name);
              const rightTainted = t.isIdentifier(init.right) && taintMap.has(init.right.name);

              if (leftTainted || rightTainted) {
                const taintInfo = leftTainted
                  ? taintMap.get((init.left as t.Identifier).name)!
                  : taintMap.get((init.right as t.Identifier).name)!;
                taintMap.set(id.name, taintInfo);
              }
            } else if (t.isCallExpression(init)) {
              const arg = init.arguments[0];
              if (t.isIdentifier(arg) && taintMap.has(arg.name)) {
                const taintInfo = taintMap.get(arg.name)!;
                taintMap.set(id.name, taintInfo);
              }
            }
          }
        },

        AssignmentExpression(path) {
          const left = path.node.left;
          const right = path.node.right;

          if (t.isIdentifier(left) && t.isIdentifier(right) && taintMap.has(right.name)) {
            const taintInfo = taintMap.get(right.name)!;
            taintMap.set(left.name, taintInfo);
          }
        },
      });
    } catch (error) {
      logger.warn('Data flow analysis failed', error);
    }

    if (taintPaths.length > 0 && this.llm) {
      try {
        await this.enhanceTaintAnalysisWithLLM(code, sources, sinks, taintPaths);
      } catch (error) {
        logger.warn('LLM-enhanced taint analysis failed', error);
      }
    }

    return {
      graph,
      sources,
      sinks,
      taintPaths,
    };
  }

  private async enhanceTaintAnalysisWithLLM(
    code: string,
    sources: DataFlow['sources'],
    sinks: DataFlow['sinks'],
    taintPaths: DataFlow['taintPaths']
  ): Promise<void> {
    if (!this.llm || taintPaths.length === 0) return;

    try {
      const sourcesList = sources.map((s) => `${s.type} at line ${s.location.line}`);
      const sinksList = sinks.map((s) => `${s.type} at line ${s.location.line}`);

      const messages = generateTaintAnalysisPrompt(
        code.length > 4000 ? code.substring(0, 4000) : code,
        sourcesList,
        sinksList
      );

      const response = await this.llm.chat(messages, {
        temperature: 0.2,
        maxTokens: 2000,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const llmResult = JSON.parse(jsonMatch[0]) as { taintPaths?: Array<any> };

        if (Array.isArray(llmResult.taintPaths)) {
          logger.info(`LLM identified ${llmResult.taintPaths.length} additional taint paths`);

          llmResult.taintPaths.forEach((path: any) => {
            const exists = taintPaths.some(
              (p) =>
                p.source.location.line === path.source?.location?.line &&
                p.sink.location.line === path.sink?.location?.line
            );

            if (!exists && path.source && path.sink) {
              taintPaths.push({
                source: path.source,
                sink: path.sink,
                path: path.path || [],
              });
            }
          });
        }
      }
    } catch (error) {
      logger.debug('LLM taint analysis enhancement failed', error);
    }
  }

  private checkTaintedArguments(
    args: Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>,
    taintMap: Map<string, { sourceType: string; sourceLine: number }>,
    taintPaths: DataFlow['taintPaths'],
    _funcName: string,
    line: number
  ): void {
    args.forEach((arg) => {
      if (t.isIdentifier(arg) && taintMap.has(arg.name)) {
        const taintInfo = taintMap.get(arg.name)!;
        taintPaths.push({
          source: {
            type: taintInfo.sourceType as DataFlow['sources'][0]['type'],
            location: { file: 'current', line: taintInfo.sourceLine },
          },
          sink: {
            type: 'eval',
            location: { file: 'current', line },
          },
          path: [
            { file: 'current', line: taintInfo.sourceLine },
            { file: 'current', line },
          ],
        });
      }
    });
  }
}
