export type VMType = 'custom' | 'obfuscator.io' | 'jsfuck' | 'jjencode' | 'unknown';

export type InstructionType = 'load' | 'store' | 'arithmetic' | 'control' | 'call' | 'unknown';

export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface VMInstruction {
  opcode: number | string;
  name: string;
  type: InstructionType;
  description: string;
  args?: number;
}

export interface VMFeatures {
  instructionCount: number;
  interpreterLocation: string;
  complexity: ComplexityLevel;
  hasSwitch: boolean;
  hasInstructionArray: boolean;
  hasProgramCounter: boolean;
}

export interface UnresolvedPart {
  location: string;
  reason: string;
  suggestion?: string;
}

export interface JSVMPDeobfuscatorOptions {
  code: string;
  aggressive?: boolean;
  extractInstructions?: boolean;
  timeout?: number;
  maxIterations?: number;
}

export interface JSVMPDeobfuscatorResult {
  isJSVMP: boolean;
  vmType?: VMType;
  vmFeatures?: VMFeatures;
  instructions?: VMInstruction[];
  deobfuscatedCode: string;
  confidence: number;
  warnings: string[];
  unresolvedParts?: UnresolvedPart[];
  stats?: {
    originalSize: number;
    deobfuscatedSize: number;
    reductionRate: number;
    processingTime: number;
  };
}
