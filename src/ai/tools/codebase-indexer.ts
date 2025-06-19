/**
 * @fileOverview Advanced codebase indexer with retrievers and evaluators.
 *
 * - codebaseIndexer: Indexes files for semantic search and analysis
 * - codebaseRetriever: Retrieves relevant files/functions based on context
 * - codebaseEvaluator: Evaluates and scores the best places to add new code
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for indexing operations
const CodebaseIndexerInputSchema = z.object({
  operation: z.enum(['index', 'retrieve', 'evaluate', 'analyze']).describe('The indexer operation to perform'),
  fileSystemTree: z.string().describe('Current file system structure'),
  openFiles: z.array(z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().optional(),
  })).optional().describe('Currently open files and their content'),
  query: z.object({
    type: z.enum(['function', 'component', 'class', 'interface', 'utility', 'service', 'hook', 'general']),
    name: z.string().optional(),
    description: z.string(),
    language: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
  }).optional().describe('Query for code placement or retrieval'),
  currentFilePath: z.string().optional().describe('Currently active file path'),
  codeToAdd: z.string().optional().describe('Code that needs to be placed'),
});

// Define the output schema for indexer operations
const CodebaseIndexerOutputSchema = z.object({
  success: z.boolean().describe('Whether the operation was successful'),
  operation: z.enum(['index', 'retrieve', 'evaluate', 'analyze']),
  indexedFiles: z.number().optional().describe('Number of files indexed'),
  suggestions: z.array(z.object({
    filePath: z.string(),
    fileName: z.string(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
    location: z.enum(['top', 'bottom', 'after-imports', 'before-exports', 'best-fit']),
    contextMatch: z.object({
      languageMatch: z.boolean(),
      typeMatch: z.boolean(),
      namePatternMatch: z.boolean(),
      dependencyMatch: z.boolean(),
      structureMatch: z.boolean(),
    }),
  })).optional().describe('Suggested places to add code'),
  analysis: z.object({
    totalFiles: z.number(),
    relevantFiles: z.number(),
    languageDistribution: z.record(z.number()),
    patterns: z.array(z.string()),
    recommendations: z.array(z.string()),
  }).optional().describe('Codebase analysis results'),
  retrievedContent: z.array(z.object({
    filePath: z.string(),
    content: z.string(),
    relevanceScore: z.number(),
    matchedPatterns: z.array(z.string()),
  })).optional().describe('Retrieved relevant content'),
});

export const codebaseIndexer = ai.defineTool(
  {
    name: 'codebaseIndexer',
    description: 'Advanced codebase indexer with smart retrieval and evaluation for optimal code placement suggestions.',
    inputSchema: CodebaseIndexerInputSchema,
    outputSchema: CodebaseIndexerOutputSchema,
  },
  async (input) => {
    console.log(`Codebase indexer called with operation: ${input.operation}`);
    
    switch (input.operation) {
      case 'index':
        return await indexCodebase(input);
      case 'retrieve':
        return await retrieveRelevantCode(input);
      case 'evaluate':
        return await evaluateCodePlacement(input);
      case 'analyze':
        return await analyzeCodebase(input);
      default:
        return {
          success: false,
          operation: input.operation,
        };
    }
  }
);

// Indexer: Creates searchable index of codebase
async function indexCodebase(input: any) {
  const files = extractFilesFromTree(input.fileSystemTree);
  const openFiles = input.openFiles || [];
  
  // Create semantic index of all files
  const index = {
    files: files.map(file => ({
      path: file,
      language: detectLanguage(file),
      type: detectFileType(file),
      keywords: extractKeywords(file),
    })),
    content: openFiles.map((file: { path: string; content: string; language?: string }) => ({
      path: file.path,
      language: file.language || detectLanguage(file.path),
      functions: extractFunctions(file.content),
      imports: extractImports(file.content),
      exports: extractExports(file.content),
      classes: extractClasses(file.content),
      patterns: extractPatterns(file.content),
    })),
  };
  
  return {
    success: true,
    operation: 'index' as const,
    indexedFiles: files.length,
    analysis: {
      totalFiles: files.length,
      relevantFiles: openFiles.length,
      languageDistribution: calculateLanguageDistribution(files),
      patterns: extractCodePatterns(openFiles),
      recommendations: generateIndexRecommendations(index),
    },
  };
}

// Retriever: Finds relevant files based on query
async function retrieveRelevantCode(input: any) {
  const query = input.query;
  const openFiles = input.openFiles || [];
  
  if (!query) {
    return {
      success: false,
      operation: 'retrieve' as const,
    };
  }
  
  const relevantFiles = openFiles
    .map((file: { path: string; content: string; language?: string }) => ({
      ...file,
      relevanceScore: calculateRelevanceScore(file, query),
      matchedPatterns: findMatchedPatterns(file, query),
    }))
    .filter((file: any) => file.relevanceScore > 0.3)
    .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
  
  return {
    success: true,
    operation: 'retrieve' as const,
    retrievedContent: relevantFiles.map((file: { path: string; content: string; relevanceScore: number; matchedPatterns: string[] }) => ({
      filePath: file.path,
      content: file.content.substring(0, 1000) + '...',
      relevanceScore: file.relevanceScore,
      matchedPatterns: file.matchedPatterns,
    })),
  };
}

// Evaluator: Scores and ranks the best places to add new code
async function evaluateCodePlacement(input: any) {
  const query = input.query;
  const openFiles = input.openFiles || [];
  const codeToAdd = input.codeToAdd;
  
  if (!query || !codeToAdd) {
    return {
      success: false,
      operation: 'evaluate' as const,
    };
  }
  
  const suggestions = openFiles
    .map((file: { path: string; content: string; language?: string }) => evaluateFileForCodePlacement(file, query, codeToAdd))
    .filter((suggestion: any) => suggestion.confidence > 0.4)
    .sort((a: any, b: any) => b.confidence - a.confidence)
    .slice(0, 5); // Top 5 suggestions
  
  return {
    success: true,
    operation: 'evaluate' as const,
    suggestions,
  };
}

// Analyzer: Provides comprehensive codebase analysis
async function analyzeCodebase(input: any) {
  const files = extractFilesFromTree(input.fileSystemTree);
  const openFiles = input.openFiles || [];
  
  const analysis = {
    totalFiles: files.length,
    relevantFiles: openFiles.length,
    languageDistribution: calculateLanguageDistribution(files),
    patterns: extractCodePatterns(openFiles),
    recommendations: [
      'Consider organizing similar functions into modules',
      'Add TypeScript types for better code quality',
      'Create utility functions for repeated patterns',
    ],
  };
  
  return {
    success: true,
    operation: 'analyze' as const,
    analysis,
  };
}

// Helper functions
function extractFilesFromTree(tree: string): string[] {
  const lines = tree.split('\n');
  const files: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('.') && !trimmed.startsWith('├──') && !trimmed.startsWith('└──')) {
      files.push(trimmed);
    } else {
      const match = trimmed.match(/[├└]── (.+)/);
      if (match && match[1].includes('.')) {
        files.push(match[1]);
      }
    }
  }
  
  return files;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'js': 'JavaScript',
    'jsx': 'JavaScript React',
    'py': 'Python',
    'cpp': 'C++',
    'java': 'Java',
    'go': 'Go',
    'rs': 'Rust',
  };
  return languageMap[ext || ''] || 'Unknown';
}

function detectFileType(filePath: string): string {
  const path = filePath.toLowerCase();
  if (path.includes('component')) return 'component';
  if (path.includes('hook')) return 'hook';
  if (path.includes('util')) return 'utility';
  if (path.includes('service')) return 'service';
  if (path.includes('api')) return 'api';
  if (path.includes('type')) return 'types';
  return 'general';
}

function extractKeywords(file: string): string[] {
  return file.split(/[\/\-_\.]/).filter(word => word.length > 2);
}

function extractFunctions(content: string): string[] {
  const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*:\s*\()/g;
  const functions: string[] = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1] || match[2] || match[3];
    if (functionName) {
      functions.push(functionName);
    }
  }
  
  return functions;
}

function extractImports(content: string): string[] {
  const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

function extractExports(content: string): string[] {
  const exportRegex = /export\s+(?:default\s+)?(?:function\s+)?(\w+)/g;
  const exports: string[] = [];
  let match;
  
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  return exports;
}

function extractClasses(content: string): string[] {
  const classRegex = /class\s+(\w+)/g;
  const classes: string[] = [];
  let match;
  
  while ((match = classRegex.exec(content)) !== null) {
    classes.push(match[1]);
  }
  
  return classes;
}

function extractPatterns(content: string): string[] {
  const patterns: string[] = [];
  
  if (content.includes('useState')) patterns.push('React Hook');
  if (content.includes('useEffect')) patterns.push('React Effect');
  if (content.includes('interface')) patterns.push('TypeScript Interface');
  if (content.includes('async/await')) patterns.push('Async Function');
  if (content.includes('try/catch')) patterns.push('Error Handling');
  
  return patterns;
}

function calculateLanguageDistribution(files: string[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  files.forEach(file => {
    const language = detectLanguage(file);
    distribution[language] = (distribution[language] || 0) + 1;
  });
  
  return distribution;
}

function extractCodePatterns(openFiles: { content: string }[]): string[] {
  const patterns: string[] = [];
  openFiles.forEach((file: { content: string }) => {
    extractPatterns(file.content).forEach(pattern => patterns.push(pattern));
  });
  return patterns;
}

function extractDependencies(file: { content: string }): string[] {
  const dependencyRegex = /(?:import\s+.*?from\s+|require\(\s*['"])(.+?)(?:['"]\s*\))/g;
  const dependencies: string[] = [];
  let match;
  
  while ((match = dependencyRegex.exec(file.content)) !== null) {
    dependencies.push(match[1]);
  }
  
  return dependencies;
}

function generateIndexRecommendations(index: any): any[] {
  const recommendations: string[] = [];
  
  if (index.files.length > 50) {
    recommendations.push('Consider organizing files into more directories');
  }
  
  if (index.content.length > 0) {
    recommendations.push('Good file coverage for analysis');
  }
  
  return recommendations;
}

function calculateRelevanceScore(file: { path: string; content: string }, query: any): number {
  let score = 0;
  
  // Language match
  const fileLanguage = detectLanguage(file.path);
  if (query.language && fileLanguage.toLowerCase().includes(query.language.toLowerCase())) {
    score += 0.3;
  }
  
  // Type match
  const fileType = detectFileType(file.path);
  if (query.type && fileType === query.type) {
    score += 0.3;
  }
  
  // Name/description match
  if (query.name && file.content.toLowerCase().includes(query.name.toLowerCase())) {
    score += 0.2;
  }
  
  if (query.description) {
    const descWords = query.description.toLowerCase().split(' ');
    const contentLower = file.content.toLowerCase();
    const matchingWords = descWords.filter((word: string) => contentLower.includes(word));
    score += (matchingWords.length / descWords.length) * 0.2;
  }
  
  return Math.min(score, 1);
}

function findMatchedPatterns(file: { content: string }, query: any): string[] {
  const patterns: string[] = [];
  
  if (query.type === 'function' && file.content.includes('function')) {
    patterns.push('function definition');
  }
  
  if (query.type === 'component' && file.content.includes('React')) {
    patterns.push('React component');
  }
  
  return patterns;
}

function evaluateFileForCodePlacement(file: { path: string; content: string; language?: string }, query: any, codeToAdd: string): any {
  const languageMatch = detectLanguage(file.path).toLowerCase().includes(query.language?.toLowerCase() || '');
  const typeMatch = detectFileType(file.path) === query.type;
  const namePatternMatch = query.name ? file.content.includes(query.name) : false;
  const dependencyMatch = query.dependencies ? 
    query.dependencies.some((dep: string) => file.content.includes(dep)) : false;
  
  // Calculate structure match
  const hasImports = file.content.includes('import');
  const hasExports = file.content.includes('export');
  const structureMatch = hasImports && hasExports;
  
  let confidence = 0;
  confidence += languageMatch ? 0.3 : 0;
  confidence += typeMatch ? 0.25 : 0;
  confidence += namePatternMatch ? 0.2 : 0;
  confidence += dependencyMatch ? 0.15 : 0;
  confidence += structureMatch ? 0.1 : 0;
  
  const pathParts = file.path.split('/');
  const fileName = pathParts[pathParts.length - 1];
  
  return {
    filePath: file.path,
    fileName,
    reason: generatePlacementReason(languageMatch, typeMatch, namePatternMatch, dependencyMatch),
    confidence,
    location: determineBestLocation(file.content, codeToAdd, query),
    contextMatch: {
      languageMatch,
      typeMatch,
      namePatternMatch,
      dependencyMatch,
      structureMatch,
    },
  };
}

function generatePlacementReason(languageMatch: boolean, typeMatch: boolean, namePatternMatch: boolean, dependencyMatch: boolean): string {
  const reasons: string[] = [];
  
  if (languageMatch) reasons.push('matching language');
  if (typeMatch) reasons.push('matching file type');
  if (namePatternMatch) reasons.push('similar naming patterns');
  if (dependencyMatch) reasons.push('shared dependencies');
  
  if (reasons.length === 0) return 'general compatibility';
  
  return `Strong match: ${reasons.join(', ')}`;
}

function determineBestLocation(content: string, codeToAdd: string, query: any): string {
  if (query.type === 'function' || query.type === 'utility') {
    if (content.includes('export')) return 'before-exports';
    return 'bottom';
  }
  
  if (query.type === 'interface' || query.type === 'type') {
    if (content.includes('import')) return 'after-imports';
    return 'top';
  }
  
  return 'best-fit';
}