export type ObfuscationType =
  | 'javascript-obfuscator'
  | 'webpack'
  | 'uglify'
  | 'vm-protection'
  | 'self-modifying'
  | 'invisible-unicode'
  | 'control-flow-flattening'
  | 'string-array-rotation'
  | 'dead-code-injection'
  | 'opaque-predicates'
  | 'jsfuck'
  | 'aaencode'
  | 'jjencode'
  | 'packer'
  | 'eval-obfuscation'
  | 'base64-encoding'
  | 'hex-encoding'
  | 'jscrambler'
  | 'urlencoded'
  | 'custom'
  | 'unknown';

export interface Transformation {
  type: string;
  description: string;
  success: boolean;
}

export interface DeobfuscateOptions {
  code: string;
  llm?: 'gpt-4' | 'claude';
  aggressive?: boolean;
  preserveLogic?: boolean;
  renameVariables?: boolean;
  inlineFunctions?: boolean;
}

export interface DeobfuscateResult {
  code: string;
  readabilityScore: number;
  confidence: number;
  obfuscationType: ObfuscationType[];
  transformations: Transformation[];
  analysis: string;
}
