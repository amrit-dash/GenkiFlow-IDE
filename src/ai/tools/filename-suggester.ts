/**
 * @fileOverview Defines a Genkit tool for AI-powered filename suggestions.
 *
 * - filenameSuggester: A tool that analyzes file content and suggests appropriate filenames.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the tool
const FilenameSuggesterInputSchema = z.object({
  fileContent: z.string().describe('The content of the file to analyze'),
  currentFileName: z.string().optional().describe('The current filename if any'),
  fileType: z.enum(['file', 'folder']).default('file').describe('Type of the item to suggest name for'),
  context: z.string().optional().describe('Additional context about the file purpose'),
  projectStructure: z.string().optional().describe('Project file structure for context'),
});

// Define the output schema for the tool
const FilenameSuggesterOutputSchema = z.object({
  suggestions: z.array(z.object({
    filename: z.string().describe('Suggested filename with extension'),
    reasoning: z.string().describe('Explanation for why this name was suggested'),
    confidence: z.number().min(0).max(1).describe('Confidence score (0-1)'),
    category: z.enum(['descriptive', 'conventional', 'functional', 'contextual']).describe('Type of naming strategy'),
  })).describe('List of filename suggestions ordered by confidence'),
  analysis: z.object({
    detectedLanguage: z.string().describe('Programming language detected'),
    codeType: z.string().describe('Type of code (component, utility, service, etc.)'),
    mainFunctions: z.array(z.string()).describe('Main functions or exports found'),
    hasExports: z.boolean().describe('Whether file exports functions/classes'),
    isComponent: z.boolean().describe('Whether this appears to be a UI component'),
    suggestedExtension: z.string().describe('Recommended file extension'),
  }).describe('Analysis of the file content'),
});

export const filenameSuggester = ai.defineTool(
  {
    name: 'filenameSuggester',
    description: 'Analyzes file content deeply and suggests exactly 3 contextual, non-repetitive filenames based on code structure, functions, and purpose. Provides intelligent naming based on actual code content.',
    inputSchema: FilenameSuggesterInputSchema,
    outputSchema: FilenameSuggesterOutputSchema,
  },
  async (input) => {
    console.log('Filename suggester called with enhanced analysis');
    
    const content = input.fileContent;
    const currentName = input.currentFileName;
    
    // Deep analyze the file content
    const analysis = analyzeFileContentDeep(content);
    
    // Generate exactly 3 intelligent, non-repetitive suggestions
    const suggestions = generateIntelligentSuggestions(content, analysis, currentName, input.context);
    
    return {
      suggestions: suggestions.slice(0, 3), // Ensure exactly 3 suggestions
      analysis,
    };
  }
);

// Enhanced analysis function that deeply understands code structure
function analyzeFileContentDeep(content: string) {
  const lowerContent = content.toLowerCase();
  
  // Detect language and extension with high accuracy
  let detectedLanguage = 'Text';
  let suggestedExtension = '.txt';
  
  if (content.includes('def ') && (content.includes('print(') || content.includes('import ') || content.includes('return'))) {
    detectedLanguage = 'Python';
    suggestedExtension = '.py';
  } else if (content.includes('function') || content.includes('const ') || content.includes('let ') || content.includes('=>')) {
    if (content.includes('React') || content.includes('jsx') || content.includes('tsx') || /return\s*\([\s\S]*</.test(content)) {
      detectedLanguage = 'React/TypeScript';
      suggestedExtension = content.includes('interface ') || content.includes(': string') ? '.tsx' : '.jsx';
    } else if (content.includes('interface ') || content.includes('type ') || content.includes(': string') || content.includes(': number')) {
      detectedLanguage = 'TypeScript';
      suggestedExtension = '.ts';
    } else {
      detectedLanguage = 'JavaScript';
      suggestedExtension = '.js';
    }
  } else if (content.includes('#include') || content.includes('std::') || content.includes('int main')) {
    detectedLanguage = 'C++';
    suggestedExtension = '.cpp';
  } else if (content.includes('public class') || content.includes('import java')) {
    detectedLanguage = 'Java';
    suggestedExtension = '.java';
  }
  
  // Intelligent code type detection based on actual content patterns
  let codeType = 'general';
  const isComponent = /return\s*\([\s\S]*</.test(content) || lowerContent.includes('component') || content.includes('jsx') || content.includes('tsx');
  
  if (isComponent) {
    codeType = 'component';
  } else if (content.match(/^const use[A-Z]/m) || content.includes('useState') || content.includes('useEffect')) {
    codeType = 'hook';
  } else if (hasMultipleMathFunctions(content)) {
    codeType = 'math-operations';
  } else if (hasDataProcessingPatterns(content)) {
    codeType = 'data-processor';
  } else if (lowerContent.includes('util') || lowerContent.includes('helper') || hasUtilityPatterns(content)) {
    codeType = 'utility';
  } else if (lowerContent.includes('service') || lowerContent.includes('api') || hasApiPatterns(content)) {
    codeType = 'service';
  } else if (content.includes('interface ') && !content.includes('function')) {
    codeType = 'types';
  } else if (content.includes('class ')) {
    codeType = 'class';
  } else if (hasMultipleFunctions(content)) {
    codeType = 'functions';
  }
  
  // Extract meaningful function names (not generic ones)
  const mainFunctions = extractMeaningfulFunctions(content);
  
  const hasExports = content.includes('export') || content.includes('module.exports');
  
  return {
    detectedLanguage,
    codeType,
    mainFunctions: mainFunctions.slice(0, 5), // Top 5 most meaningful
    hasExports,
    isComponent,
    suggestedExtension,
  };
}

// Helper functions for intelligent code pattern detection
function hasMultipleMathFunctions(content: string): boolean {
  const mathPatterns = [
    /\b(sum|add|subtract|multiply|divide|calculate|compute)\b/gi,
    /\+|\-|\*|\/|\%/g,
    /math\./gi,
    /\b(average|mean|median|total|product)\b/gi
  ];
  
  let mathIndicators = 0;
  mathPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches && matches.length > 2) mathIndicators++;
  });
  
  return mathIndicators >= 2;
}

function hasDataProcessingPatterns(content: string): boolean {
  const dataPatterns = [
    /\b(filter|map|reduce|sort|process|transform)\b/gi,
    /\b(data|array|list|collection)\b/gi,
    /\.forEach|\.filter|\.map|\.reduce/gi
  ];
  
  return dataPatterns.some(pattern => {
    const matches = content.match(pattern);
    return matches && matches.length > 1;
  });
}

function hasUtilityPatterns(content: string): boolean {
  const utilPatterns = [
    /\b(helper|util|format|validate|convert|parse)\b/gi,
    /export.*function/gi
  ];
  
  return utilPatterns.some(pattern => content.match(pattern));
}

function hasApiPatterns(content: string): boolean {
  const apiPatterns = [
    /\b(fetch|axios|api|request|response|endpoint)\b/gi,
    /\b(get|post|put|delete|patch)\b/gi,
    /\/api\//gi
  ];
  
  return apiPatterns.some(pattern => content.match(pattern));
}

function hasMultipleFunctions(content: string): boolean {
  const functionCount = (content.match(/\b(function|def|const\s+\w+\s*=)/g) || []).length;
  return functionCount > 1;
}

// Extract meaningful function names, avoiding generic ones
function extractMeaningfulFunctions(content: string): string[] {
  const functions: string[] = [];
  
  // Function patterns for different languages
  const patterns = [
    /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
    /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
    /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
    /export\s+(?:const\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/g,
    /class\s+([A-Z][a-zA-Z0-9_]*)/g
  ];
  
  // Generic names to avoid
  const genericNames = new Set([
    'main', 'init', 'start', 'run', 'execute', 'handler', 'callback',
    'temp', 'test', 'example', 'demo', 'foo', 'bar', 'baz'
  ]);
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const funcName = match[1];
      if (funcName && 
          funcName.length > 2 && 
          funcName.length < 25 &&
          !genericNames.has(funcName.toLowerCase()) &&
          !functions.includes(funcName)) {
        functions.push(funcName);
      }
    }
  });
  
  // Prioritize more meaningful names
  return functions.sort((a, b) => {
    const scoreA = getMeaningfulnessScore(a);
    const scoreB = getMeaningfulnessScore(b);
    return scoreB - scoreA;
  });
}

function getMeaningfulnessScore(name: string): number {
  let score = 0;
  
  // Longer names tend to be more descriptive
  score += Math.min(name.length * 0.5, 5);
  
  // Names with underscores or camelCase are more structured
  if (name.includes('_') || /[a-z][A-Z]/.test(name)) score += 2;
  
  // Domain-specific terms get higher scores
  const domainTerms = ['calculate', 'process', 'handle', 'manage', 'create', 'update', 'delete', 'fetch', 'save', 'load'];
  if (domainTerms.some(term => name.toLowerCase().includes(term))) score += 3;
  
  return score;
}

// Generate exactly 3 intelligent, non-repetitive suggestions
function generateIntelligentSuggestions(content: string, analysis: any, currentName?: string, context?: string) {
  const suggestions = [];
  const usedNames = new Set();
  
  // Strategy 1: Context-aware functional naming
  if (analysis.codeType === 'math-operations' && analysis.mainFunctions.length > 0) {
    const baseName = analysis.detectedLanguage === 'Python' ? 'math_operations' : 'mathOperations';
    const filename = `${baseName}${analysis.suggestedExtension}`;
    if (!usedNames.has(filename)) {
      suggestions.push({
        filename,
        reasoning: `Generic name for multiple math functions (${analysis.mainFunctions.slice(0, 2).join(', ')}) in ${analysis.detectedLanguage}`,
        confidence: 0.95,
        category: 'contextual' as const,
      });
      usedNames.add(filename);
    }
  } else if (analysis.mainFunctions.length > 0) {
    // Use the most meaningful function name
    const primaryFunction = analysis.mainFunctions[0];
    const filename = `${primaryFunction}${analysis.suggestedExtension}`;
    if (!usedNames.has(filename)) {
      suggestions.push({
        filename,
        reasoning: `Named after the main function "${primaryFunction}"`,
        confidence: 0.90,
        category: 'functional' as const,
      });
      usedNames.add(filename);
    }
  }
  
  // Strategy 2: Semantic naming based on code purpose
  const semanticName = getSemanticName(analysis, content);
  if (semanticName && !usedNames.has(semanticName)) {
    suggestions.push({
      filename: semanticName,
      reasoning: `Descriptive name based on ${analysis.codeType} functionality`,
      confidence: 0.85,
      category: 'descriptive' as const,
    });
    usedNames.add(semanticName);
  }
  
  // Strategy 3: Conventional naming based on patterns
  const conventionalName = getConventionalName(analysis, content);
  if (conventionalName && !usedNames.has(conventionalName)) {
    suggestions.push({
      filename: conventionalName,
      reasoning: `Following ${analysis.detectedLanguage} naming conventions`,
      confidence: 0.80,
      category: 'conventional' as const,
    });
    usedNames.add(conventionalName);
  }
  
  // Fill remaining slots if needed with intelligent alternatives
  while (suggestions.length < 3) {
    const fallbackName = generateFallbackName(analysis, suggestions.length, analysis.suggestedExtension);
    if (!usedNames.has(fallbackName)) {
      suggestions.push({
        filename: fallbackName,
        reasoning: `Alternative ${analysis.codeType} file name`,
        confidence: 0.70 - (suggestions.length * 0.1),
        category: 'descriptive' as const,
      });
      usedNames.add(fallbackName);
    } else {
      break; // Avoid infinite loop
    }
  }
  
  return suggestions;
}

function getSemanticName(analysis: any, content: string): string | null {
  const ext = analysis.suggestedExtension;
  
  switch (analysis.codeType) {
    case 'math-operations':
      return analysis.detectedLanguage === 'Python' ? `math_utils${ext}` : `mathUtils${ext}`;
    case 'data-processor':
      return analysis.detectedLanguage === 'Python' ? `data_processor${ext}` : `dataProcessor${ext}`;
    case 'component':
      return analysis.mainFunctions.length > 0 ? `${analysis.mainFunctions[0]}Component${ext}` : `Component${ext}`;
    case 'hook':
      return analysis.mainFunctions.length > 0 ? `${analysis.mainFunctions[0]}${ext}` : `customHook${ext}`;
    case 'utility':
      return analysis.detectedLanguage === 'Python' ? `helpers${ext}` : `utils${ext}`;
    case 'service':
      return analysis.detectedLanguage === 'Python' ? `api_service${ext}` : `apiService${ext}`;
    case 'types':
      return `types${ext}`;
    default:
      if (analysis.mainFunctions.length > 1) {
        return analysis.detectedLanguage === 'Python' ? `functions${ext}` : `helpers${ext}`;
      }
      return null;
  }
}

function getConventionalName(analysis: any, content: string): string | null {
  const ext = analysis.suggestedExtension;
  
  if (analysis.isComponent && analysis.mainFunctions.length > 0) {
    return `${analysis.mainFunctions[0]}${ext}`;
  }
  
  if (analysis.detectedLanguage === 'Python' && analysis.mainFunctions.length > 1) {
    // Python convention: snake_case for modules with multiple functions
    const baseName = analysis.codeType === 'math-operations' ? 'calculations' : 'module';
    return `${baseName}${ext}`;
  }
  
  if (analysis.detectedLanguage.includes('TypeScript') || analysis.detectedLanguage === 'JavaScript') {
    // JS/TS convention: camelCase or PascalCase
    if (analysis.isComponent) {
      return analysis.mainFunctions.length > 0 ? `${analysis.mainFunctions[0]}${ext}` : `MyComponent${ext}`;
    }
    if (analysis.codeType === 'utility') {
      return `utilities${ext}`;
    }
  }
  
  return null;
}

function generateFallbackName(analysis: any, index: number, ext: string): string {
  const fallbacks = [
    `${analysis.codeType}${ext}`,
    `${analysis.detectedLanguage.toLowerCase().replace(/[^a-z]/g, '')}${ext}`,
    `code${ext}`
  ];
  
  return fallbacks[index] || `file${index}${ext}`;
} 