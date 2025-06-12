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
  fileType: z.enum(['file', 'folder']).default('file').describe('Type of the item to suggest name for (file or folder)'),
  context: z.string().optional().describe('Additional context about the file purpose'),
  projectStructure: z.string().optional().describe('Project file structure for context'),
});

// Define the output schema for the tool
const FilenameSuggesterOutputSchema = z.object({
  suggestions: z.array(z.object({
    filename: z.string().describe('Suggested filename (with extension for files, without for folders)'),
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
    suggestedExtension: z.string().describe('Recommended file extension (relevant for fileType="file")'),
  }).describe('Analysis of the file content'),
});

export const filenameSuggester = ai.defineTool(
  {
    name: 'filenameSuggester',
    description: 'Analyzes file content deeply and suggests exactly 3 contextual, non-repetitive filenames based on code structure, functions, and purpose. Provides intelligent naming based on actual code content and distinguishes between file and folder naming conventions.',
    inputSchema: FilenameSuggesterInputSchema,
    outputSchema: FilenameSuggesterOutputSchema,
  },
  async (input) => {
    console.log(`Filename suggester called for ${input.fileType}: ${input.currentFileName || 'New Item'}`);
    
    const content = input.fileContent;
    const currentName = input.currentFileName;
    const fileType = input.fileType || 'file';
    
    // Deep analyze the file content
    const analysis = analyzeFileContentDeep(content, fileType);
    
    // Generate exactly 3 intelligent, non-repetitive suggestions
    let suggestions = generateIntelligentSuggestions(content, analysis, fileType, currentName, input.context);
    
    return {
      suggestions: suggestions.slice(0, 3), // Ensure exactly 3 suggestions
      analysis,
    };
  }
);

// Helper to clean and capitalize folder names
function cleanFolderName(name: string): string {
  let base = name.split('.')[0]; // Remove any extension
  // Capitalize first letter and ensure camelCase or PascalCase for multi-word names
  base = base.replace(/[-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Enhanced analysis function that deeply understands code structure
function analyzeFileContentDeep(content: string, fileType: 'file' | 'folder') {
  const lowerContent = content.toLowerCase();
  
  let detectedLanguage = 'Text';
  let suggestedExtension = '.txt';

  if (fileType === 'folder') {
    detectedLanguage = 'Folder';
    suggestedExtension = ''; // No extension for folders
  } else {
    // Language and extension detection for files
    if (content.includes('def ') && (content.includes('print(') || content.includes('import ') || content.includes('return')) && !lowerContent.includes('<script') && !lowerContent.includes('function')) {
      detectedLanguage = 'Python';
      suggestedExtension = '.py';
    } else if (content.includes('function') || content.includes('const ') || content.includes('let ') || content.includes('=>') || content.includes('class ') && (content.includes('React') || content.includes('render()'))) {
      if (content.includes('React') || content.includes('jsx') || content.includes('tsx') || /return\s*\([\s\S]*</.test(content)) {
        detectedLanguage = content.includes('interface ') || content.includes(': string') || content.includes('type ') ? 'TypeScript (React)' : 'JavaScript (React)';
        suggestedExtension = detectedLanguage.includes('TypeScript') ? '.tsx' : '.jsx';
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
    } else if (lowerContent.includes('<html>') || lowerContent.includes('<body>')) {
      detectedLanguage = 'HTML';
      suggestedExtension = '.html';
    } else if (lowerContent.match(/[\.#\w-]+\s*\{[\s\S]*\}/)) { // Basic CSS pattern
      detectedLanguage = 'CSS';
      suggestedExtension = '.css';
    } else if (lowerContent.startsWith('{') && lowerContent.endsWith('}') || lowerContent.startsWith('[') && lowerContent.endsWith(']')) {
        try { JSON.parse(content); detectedLanguage = 'JSON'; suggestedExtension = '.json'; } catch (e) { /* not JSON */ }
    } else if (lowerContent.includes('---') && (lowerContent.includes('layout:') || lowerContent.includes('title:'))) {
        detectedLanguage = 'Markdown (Frontmatter)';
        suggestedExtension = '.md';
    } else if (lowerContent.includes('# ') || lowerContent.includes('## ')) {
        detectedLanguage = 'Markdown';
        suggestedExtension = '.md';
    }
  }
  
  let codeType = 'general';
  const isComponent = /return\s*\([\s\S]*</.test(content) && (detectedLanguage.includes('React') || detectedLanguage.includes('JavaScript') || detectedLanguage.includes('TypeScript'));
  
  if (fileType === 'folder') {
    codeType = 'folder';
  } else if (isComponent) {
    codeType = 'component';
  } else if (content.match(/\b(useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue)\b/g)) {
    codeType = 'hook';
  } else if (hasMultipleMathFunctions(content)) {
    codeType = 'math-operations';
  } else if (hasDataProcessingPatterns(content)) {
    codeType = 'data-processor';
  } else if (lowerContent.includes('util') || lowerContent.includes('helper') || hasUtilityPatterns(content)) {
    codeType = 'utility';
  } else if (lowerContent.includes('service') || lowerContent.includes('api') || hasApiPatterns(content)) {
    codeType = 'service';
  } else if ((content.includes('interface ') || content.includes('type ')) && !content.includes('function') && !content.includes('class ') && (detectedLanguage.includes('TypeScript'))) {
    codeType = 'types';
  } else if (content.includes('class ')) {
    codeType = 'class';
  } else if (hasMultipleFunctions(content, detectedLanguage)) {
    codeType = 'functions-module';
  }
  
  const mainFunctions = extractMeaningfulFunctions(content, detectedLanguage);
  const hasExports = content.includes('export') || content.includes('module.exports');
  
  return {
    detectedLanguage,
    codeType,
    mainFunctions: mainFunctions.slice(0, 5),
    hasExports,
    isComponent,
    suggestedExtension,
  };
}

function hasMultipleMathFunctions(content: string): boolean {
  const mathPatterns = [
    /\b(sum|add|subtract|multiply|divide|calculate|compute|average|mean|median|total|product|power|sqrt|abs|round|floor|ceil|min|max)\b/gi,
    /\b(Math\.\w+)\b/g, // Math.sqrt, Math.pow etc.
  ];
  let count = 0;
  mathPatterns.forEach(pattern => {
    count += (content.match(pattern) || []).length;
  });
  return count > 2; // At least 3 math-related terms or functions
}

function hasDataProcessingPatterns(content: string): boolean {
  const dataPatterns = [
    /\b(filter|map|reduce|sort|find|forEach|some|every|group|transform|process|parse|extract|load|save)\b/gi,
    /\b(data|array|list|object|collection|item|record|entry|json|csv|xml)\b/gi,
    /\.(forEach|filter|map|reduce|sort|find)\b/g, // Array methods
  ];
  let count = 0;
  dataPatterns.forEach(pattern => {
    count += (content.match(pattern) || []).length;
  });
  return count > 2;
}

function hasUtilityPatterns(content: string): boolean {
  const utilPatterns = [
    /\b(util|helper|format|validate|convert|parse|is\w+|get\w+|set\w+|create\w+|build\w+|generate\w+)\b/gi,
    /export\s+(function|const|let|var|class)/gi
  ];
   let count = 0;
  utilPatterns.forEach(pattern => {
    count += (content.match(pattern) || []).length;
  });
  // Needs multiple utility-like functions or exports
  return count > 2 && (content.match(/export\s+(function|const|let|var|class)/gi) || []).length > 1;
}

function hasApiPatterns(content: string): boolean {
  const apiPatterns = [
    /\b(fetch|axios|request|response|endpoint|http|https|url|api|client|query|mutation)\b/gi,
    /\b(get|post|put|delete|patch)\s*\(/gi, // Common HTTP methods as functions
    /\/api\//gi,
    /\.(get|post|put|delete|patch)\s*\(/gi, // Chained methods like client.get()
  ];
  let count = 0;
  apiPatterns.forEach(pattern => {
    count += (content.match(pattern) || []).length;
  });
  return count > 1;
}

function hasMultipleFunctions(content: string, language: string): boolean {
  let functionCount = 0;
  if (language.includes('JavaScript') || language.includes('TypeScript')) {
    functionCount = (content.match(/\b(function|=>|class\s+\w+\s*\{[\s\S]*constructor)\b/g) || []).length;
    functionCount += (content.match(/^(?:export\s+)?(?:async\s+)?(?:function\*?\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|class\s+\w+)/gm) || []).length;
  } else if (language === 'Python') {
    functionCount = (content.match(/^\s*def\s+\w+\s*\(|^\s*class\s+\w+\s*\(/gm) || []).length;
  }
  return functionCount > 1;
}

function extractMeaningfulFunctions(content: string, language: string): string[] {
  const functions: string[] = [];
  const uniqueFunctions = new Set<string>();

  const patterns: RegExp[] = [];
  if (language.includes('JavaScript') || language.includes('TypeScript')) {
    patterns.push(
      /(?:export\s+)?(?:async\s+)?function\*?\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, // function foo / export function foo
      /(?:export\s+)?const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s+)?(?:\([^)]*\))?\s*=>/g, // const foo = () => / export const foo = async () =>
      /(?:export\s+default\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g, // class Foo / export default class Foo
      /(?:export\s+)?(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g // export class Foo / abstract class Foo
    );
  } else if (language === 'Python') {
    patterns.push(
      /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, // def foo(
      /^\s*class\s+([A-Z][a-zA-Z0-9_]*)\s*[\(:]/gm // class Foo: / class Foo(
    );
  }

  const genericNames = new Set([
    'main', 'init', 'start', 'run', 'execute', 'handler', 'callback', 'constructor',
    'temp', 'test', 'example', 'demo', 'foo', 'bar', 'baz', 'data', 'item', 'value', 'key',
    'get', 'set', 'update', 'create', 'delete', 'index', 'app', 'config', 'util', 'helper', 'render'
  ]);

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const funcName = match[1];
      if (funcName && 
          funcName.length > 2 && 
          funcName.length < 30 && // Avoid overly long names
          !genericNames.has(funcName.toLowerCase()) &&
          !/^[A-Z_0-9]+$/.test(funcName) && // Avoid CONSTANTS
          !uniqueFunctions.has(funcName)) {
        functions.push(funcName);
        uniqueFunctions.add(funcName);
      }
    }
  });
  
  return functions.sort((a, b) => getMeaningfulnessScore(b) - getMeaningfulnessScore(a));
}

function getMeaningfulnessScore(name: string): number {
  let score = name.length; // Longer names are often more descriptive
  if (/[A-Z]/.test(name) && /[a-z]/.test(name)) score += 5; // Camel/PascalCase bonus
  if (name.includes('_')) score += 3; // Snake_case bonus
  
  // Penalize if it looks like a variable name (all caps or starts with lowercase and no clear verb)
  if (/^[A-Z_0-9]+$/.test(name)) score -= 10; // Likely a constant
  if (/^[a-z]/.test(name) && !/\b(get|set|is|has|handle|create|update|delete|calculate|process|validate|format|convert|parse|render|build|generate|fetch|load|save)\b/i.test(name)) {
      score -= 5; // Might be a variable rather than function/class
  }
  return score;
}

function generateIntelligentSuggestions(content: string, analysis: any, fileType: 'file' | 'folder', currentName?: string, context?: string) {
  const suggestions: Array<{filename: string, reasoning: string, confidence: number, category: 'descriptive' | 'conventional' | 'functional' | 'contextual'}> = [];
  const usedNames = new Set<string>();

  const addSuggestion = (name: string, reason: string, conf: number, cat: 'descriptive' | 'conventional' | 'functional' | 'contextual') => {
    if (name && !usedNames.has(name.toLowerCase()) && suggestions.length < 3) {
      suggestions.push({ filename: name, reasoning: reason, confidence: Math.min(0.95, Math.max(0.1, conf)), category: cat });
      usedNames.add(name.toLowerCase());
    }
  };
  
  let baseName = '';

  // Strategy 1: Primary function/class/component name
  if (analysis.mainFunctions.length > 0) {
    baseName = analysis.mainFunctions[0];
    let suggestedName = fileType === 'folder' ? cleanFolderName(baseName) : `${baseName}${analysis.suggestedExtension}`;
    addSuggestion(suggestedName, `Based on the primary entity: ${baseName}`, 0.9, 'functional');
  }

  // Strategy 2: Code type based conventional naming
  if (analysis.codeType !== 'general' && analysis.codeType !== 'folder') {
    let conventional = '';
    if (analysis.codeType === 'component') conventional = baseName || 'NewComponent';
    else if (analysis.codeType === 'hook') conventional = baseName || 'useNewHook';
    else if (analysis.codeType === 'utility') conventional = 'utils';
    else if (analysis.codeType === 'service') conventional = baseName ? `${baseName}Service` : 'apiService';
    else if (analysis.codeType === 'types') conventional = 'types';
    else if (analysis.codeType === 'math-operations') conventional = 'mathUtils';
    else if (analysis.codeType === 'data-processor') conventional = 'dataProcessor';
    else if (analysis.codeType === 'functions-module') conventional = baseName ? `${baseName}Module` : 'helpers';


    if (conventional) {
       let suggestedName = fileType === 'folder' ? cleanFolderName(conventional) : `${conventional}${analysis.suggestedExtension}`;
       addSuggestion(suggestedName, `Conventional name for a ${analysis.codeType}`, 0.8, 'conventional');
    }
  }
  
  // Strategy 3: Context from user prompt if available
  if (context) {
    const contextWords = context.toLowerCase().match(/\b\w{4,}\b/g) || []; // Meaningful words
    if (contextWords.length > 0) {
      let contextBase = contextWords.slice(0,2).join('_'); // e.g. "create_user" from "create user profile"
      contextBase = contextBase.replace(/[^a-zA-Z0-9_]/g, ''); // Sanitize
      let suggestedName = fileType === 'folder' ? cleanFolderName(contextBase) : `${contextBase}${analysis.suggestedExtension}`;
      addSuggestion(suggestedName, `Based on your instruction: "${context}"`, 0.75, 'contextual');
    }
  }

  // Strategy 4: Descriptive name if others are weak or missing
  if (suggestions.length < 2 && analysis.codeType !== 'general') {
    let descriptiveBase = analysis.codeType.replace(/-/g, '_'); // e.g. "math_operations"
    if (analysis.mainFunctions.length > 1) descriptiveBase += `_${analysis.mainFunctions[1]}`; // Add secondary function
    descriptiveBase = descriptiveBase.slice(0, 30); // Limit length
    let suggestedName = fileType === 'folder' ? cleanFolderName(descriptiveBase) : `${descriptiveBase}${analysis.suggestedExtension}`;
    addSuggestion(suggestedName, `Descriptive name for ${analysis.codeType}`, 0.7, 'descriptive');
  }

  // Fallback suggestions
  const fallbacks = fileType === 'folder' 
    ? ['NewUtilities', 'SharedLogic', 'MyModule']
    : ['app', 'core', 'utils', 'index', 'script'];
  
  let fallbackIndex = 0;
  while (suggestions.length < 3 && fallbackIndex < fallbacks.length) {
    let fallbackBase = fallbacks[fallbackIndex++];
    let suggestedName = fileType === 'folder' ? cleanFolderName(fallbackBase) : `${fallbackBase}${analysis.suggestedExtension}`;
    addSuggestion(suggestedName, 'General purpose fallback name', 0.5 - (suggestions.length * 0.1), 'descriptive');
  }
  
  // Ensure first letter is capitalized for folders if not already handled by cleanFolderName
  if (fileType === 'folder') {
    suggestions.forEach(sugg => {
        if (sugg.filename.length > 0 && sugg.filename[0] === sugg.filename[0].toLowerCase()) {
            sugg.filename = sugg.filename.charAt(0).toUpperCase() + sugg.filename.slice(1);
        }
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

