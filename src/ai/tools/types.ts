export interface ErrorInfo {
  message: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  source?: string;
}

export interface FileInfo {
  path: string;
  content: string;
  extension: string;
  size: number;
  lastModified: number;
}

export interface QualityMetrics {
  complexity: number;
  maintainability: number;
  testability: number;
  reusability: number;
  documentation: number;
  overallScore: number;
}

export interface CodeAnalysis {
  language: string;
  description: string;
  purpose: string;
  mainFunctions: string[];
  dependencies: string[];
  codeType: 'data' | 'component' | 'utility' | 'service' | 'config' | 'test' | 'documentation' | 'style' | 'other';
  complexity: 'low' | 'medium' | 'high';
  isEntryPoint: boolean;
  relatedConcepts: string[];
  quality: QualityMetrics;
}

export interface ValidationResult {
  success: boolean;
  errors?: ErrorInfo[];
  warnings?: ErrorInfo[];
  suggestions?: string[];
}

export interface MergeResult {
  success: boolean;
  mergedContent: string;
  conflicts?: {
    start: number;
    end: number;
    content: string;
  }[];
}
