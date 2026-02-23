export interface DetectedEnvironmentVariables {
  window: string[];
  document: string[];
  navigator: string[];
  location: string[];
  screen: string[];
  other: string[];
}

export interface MissingAPI {
  name: string;
  type: 'function' | 'object' | 'property';
  path: string;
  suggestion: string;
}

export interface EmulationCode {
  nodejs: string;
  python: string;
}

export interface EnvironmentEmulatorOptions {
  code: string;
  targetRuntime?: 'nodejs' | 'python' | 'both';
  autoFetch?: boolean;
  browserUrl?: string;
  browserType?: 'chrome' | 'firefox' | 'safari';
  includeComments?: boolean;
  extractDepth?: number;
  useAI?: boolean;
}

export interface EnvironmentEmulatorResult {
  detectedVariables: DetectedEnvironmentVariables;
  emulationCode: EmulationCode;
  missingAPIs: MissingAPI[];
  variableManifest: Record<string, unknown>;
  recommendations: string[];
  stats: {
    totalVariables: number;
    autoFilledVariables: number;
    manualRequiredVariables: number;
  };
  aiAnalysis?: unknown;
}
