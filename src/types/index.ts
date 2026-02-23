export type { CodeLocation, Result } from './common.js';
export type {
  Config,
  LLMConfig,
  PuppeteerConfig,
  MCPConfig,
  CacheConfig,
  PerformanceConfig,
} from './config.js';
export type { BrowserContext } from './browser.js';
export type {
  CollectCodeOptions,
  CodeFile,
  CollectCodeResult,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
} from './collector.js';
export type {
  ObfuscationType,
  Transformation,
  DeobfuscateOptions,
  DeobfuscateResult,
} from './deobfuscator.js';
export type {
  UnderstandCodeOptions,
  UnderstandCodeResult,
  CodeStructure,
  TechStack,
  BusinessLogic,
  DataFlow,
  DataFlowGraph,
  DataFlowNode,
  DataFlowEdge,
  DataSource,
  DataSink,
  TaintPath,
  SecurityRisk,
  FunctionInfo,
  ClassInfo,
  PropertyInfo,
  ModuleInfo,
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from './analysis.js';
export type {
  DetectCryptoOptions,
  DetectCryptoResult,
  CryptoAlgorithm,
  CryptoParameters,
  CryptoLibrary,
} from './crypto.js';
export type {
  HookOptions,
  HookCondition,
  HookHandler,
  HookContext,
  CallStackFrame,
  HookResult,
  HookRecord,
} from './hook.js';
export type {
  ScopeVariable,
  BreakpointHitEvent,
  BreakpointHitCallback,
  DebuggerSession,
  GetScopeVariablesOptions,
  GetScopeVariablesResult,
  Session,
  SessionData,
} from './debugger.js';
export type {
  DetectedEnvironmentVariables,
  MissingAPI,
  EmulationCode,
  EnvironmentEmulatorOptions,
  EnvironmentEmulatorResult,
} from './emulator.js';
export type {
  VMType,
  InstructionType,
  ComplexityLevel,
  VMInstruction,
  VMFeatures,
  UnresolvedPart,
  JSVMPDeobfuscatorOptions,
  JSVMPDeobfuscatorResult,
} from './vm.js';
