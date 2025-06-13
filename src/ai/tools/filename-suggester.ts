
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
  currentFileName: z.string().optional().describe('The current filename if any (e.g., "untitled.txt", "myComponent.tsx")'),
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
    currentFileNameForFiltering: z.string().optional().describe('The current filename, passed through for filtering.'),
  }).describe('Analysis of the file content'),
});

export const filenameSuggester = ai.defineTool(
  {
    name: 'filenameSuggester',
    description: 'Analyzes file content deeply and suggests exactly 3 contextual, non-repetitive filenames based on code structure, functions, and purpose. Provides intelligent naming based on actual code content and distinguishes between file and folder naming conventions. Filters out suggestions identical to the current name.',
    inputSchema: FilenameSuggesterInputSchema,
    outputSchema: FilenameSuggesterOutputSchema,
  },
  async (input) => {
    console.log(`Filename suggester called for ${input.fileType}: ${input.currentFileName || 'New Item'}`);
    
    const content = input.fileContent;
    const currentName = input.currentFileName;
    const fileType = input.fileType || 'file';
    
    const analysis = analyzeFileContentDeep(content, fileType, currentName);
    
    let generatedSuggestions = generateIntelligentSuggestions(analysis, fileType, input.context, currentName);
    
    // Filter out suggestions that are identical to the current file name
    let finalSuggestions = generatedSuggestions;
    if (currentName) {
        if (fileType === 'file') {
            const currentNameLower = currentName.toLowerCase();
            const currentFileParts = currentName.split('.');
            // Handle dotfiles like ".gitignore" where base is "" and ext is ".gitignore"
            // Or ".babelrc.js" where base is ".babelrc" and ext is ".js"
            let currentFileExt = '';
            let currentFileBase = currentNameLower;

            const lastDotIndex = currentName.lastIndexOf('.');
            if (lastDotIndex > 0) { // Regular file like "file.ts" or dotfile with extension like ".config.js"
                currentFileExt = currentName.substring(lastDotIndex).toLowerCase();
                currentFileBase = currentName.substring(0, lastDotIndex).toLowerCase();
            } else if (lastDotIndex === 0) { // Dotfile like ".gitignore"
                currentFileExt = currentName.toLowerCase(); // The whole name is the "extension"
                currentFileBase = ""; // No base before the dot
            }
            // If no dot, base is the whole name, ext is empty (handled by suggestion logic)

            finalSuggestions = generatedSuggestions.filter(s => {
                const suggestionNameLower = s.filename.toLowerCase();
                let suggestionExt = '';
                let suggestionBase = suggestionNameLower;

                const sugLastDotIndex = s.filename.lastIndexOf('.');
                if (sugLastDotIndex > 0) {
                    suggestionExt = s.filename.substring(sugLastDotIndex).toLowerCase();
                    suggestionBase = s.filename.substring(0, sugLastDotIndex).toLowerCase();
                } else if (sugLastDotIndex === 0) {
                    suggestionExt = s.filename.toLowerCase();
                    suggestionBase = "";
                }
                
                // If both current and suggestion have no discernible standard extension (e.g. "Makefile" or ".gitattributes")
                if (currentFileExt === '' && suggestionExt === '') {
                    return suggestionBase !== currentFileBase;
                }
                 // If one is a dotfile (ext is the full name like ".gitignore") and other is regular (ext is like ".ts")
                if ((currentFileBase === "" && currentFileExt !== "") !== (suggestionBase === "" && suggestionExt !== "")) {
                    return true; // They are structurally different
                }

                // Direct comparison if both are similar structure
                if (currentFileBase === suggestionBase && currentFileExt === suggestionExt) {
                    return false;
                }
                return true;
            });
        } else if (fileType === 'folder') {
            const cleanedCurrentFolderName = cleanFolderName(currentName).toLowerCase();
            finalSuggestions = generatedSuggestions.filter(s => {
                return cleanFolderName(s.filename).toLowerCase() !== cleanedCurrentFolderName;
            });
        }
    }
    
    return {
      suggestions: finalSuggestions.slice(0, 3), 
      analysis: { ...analysis, currentFileNameForFiltering: currentName }
    };
  }
);

function cleanFolderName(name: string): string {
  if (!name) return "NewFolder";
  let base = name.split('.')[0]; 
  base = base.replace(/[-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  if (!base) return "NewFolder"; 
  const cleaned = base.charAt(0).toUpperCase() + base.slice(1);
  return cleaned.replace(/\/$/, '');
}

function analyzeFileContentDeep(content: string, fileType: 'file' | 'folder', currentFileName?: string) {
  const lowerContent = content.toLowerCase();
  
  let detectedLanguage = 'Text';
  let suggestedExtension = '.txt';

  if (fileType === 'folder') {
    detectedLanguage = 'Folder';
    suggestedExtension = ''; 
  } else {
    let extFromCurrentName = '';
    if (currentFileName && currentFileName.includes('.')) {
        const parts = currentFileName.split('.');
        if (parts.length > 1 && parts[0] !== "") { 
            extFromCurrentName = '.' + parts.pop()!.toLowerCase();
        } else if (parts.length === 1 && parts[0].startsWith('.')) { 
            extFromCurrentName = parts[0].toLowerCase();
        }
    }

    const languageMap: Record<string, {lang: string, ext: string}> = {
      '.gs': { lang: 'Google Apps Script', ext: '.gs' },
      '.js': { lang: 'JavaScript', ext: '.js' },
      '.jsx': { lang: 'JavaScript (React)', ext: '.jsx' },
      '.ts': { lang: 'TypeScript', ext: '.ts' },
      '.tsx': { lang: 'TypeScript (React)', ext: '.tsx' },
      '.py': { lang: 'Python', ext: '.py' },
      '.java': { lang: 'Java', ext: '.java' },
      '.cpp': { lang: 'C++', ext: '.cpp' },
      '.cxx': { lang: 'C++', ext: '.cxx' },
      '.h': { lang: 'C/C++ Header', ext: '.h' },
      '.hpp': { lang: 'C++ Header', ext: '.hpp' },
      '.html': { lang: 'HTML', ext: '.html' },
      '.htm': { lang: 'HTML', ext: '.htm' },
      '.css': { lang: 'CSS', ext: '.css' },
      '.json': { lang: 'JSON', ext: '.json' },
      '.md': { lang: 'Markdown', ext: '.md' },
      '.markdown': { lang: 'Markdown', ext: '.markdown' },
      '.gitignore': { lang: 'Git Ignore', ext: '.gitignore' },
      '.npmrc': { lang: 'NPM Config', ext: '.npmrc' },
      '.env': { lang: 'Environment Variables', ext: '.env' },
      // Add more specific dotfiles if needed
    };
    
    if (extFromCurrentName && languageMap[extFromCurrentName]) {
        detectedLanguage = languageMap[extFromCurrentName].lang;
        suggestedExtension = languageMap[extFromCurrentName].ext;
    } else if (extFromCurrentName && extFromCurrentName.startsWith('.')) { 
        // Generic dotfile handling
        const knownDotfile = Object.keys(languageMap).find(k => k === extFromCurrentName);
        if (knownDotfile) {
            detectedLanguage = languageMap[knownDotfile].lang;
            suggestedExtension = languageMap[knownDotfile].ext;
        } else {
            detectedLanguage = `Configuration (${extFromCurrentName})`; 
            suggestedExtension = extFromCurrentName; // Keep the original dotfile "extension"
        }
    } else { 
        if (content.includes('def ') && (content.includes('import ') || content.includes('return')) && !lowerContent.includes('<script') && !lowerContent.includes('function')) {
          detectedLanguage = 'Python'; suggestedExtension = '.py';
        } else if (content.includes('function') || content.includes('const ') || content.includes('let ') || content.includes('=>') || content.includes('class ')) {
          if (content.includes('React') || content.includes('jsx') || content.includes('tsx') || /return\s*\([\s\S]*</.test(content)) {
            detectedLanguage = content.includes('interface ') || content.includes(': string') || content.includes('type ') ? 'TypeScript (React)' : 'JavaScript (React)';
            suggestedExtension = detectedLanguage.includes('TypeScript') ? '.tsx' : '.jsx';
          } else if (content.includes('interface ') || content.includes('type ') || content.includes(': string') || content.includes(': number')) {
            detectedLanguage = 'TypeScript'; suggestedExtension = '.ts';
          } else {
            detectedLanguage = 'JavaScript'; suggestedExtension = '.js';
          }
        } else if (content.includes('#include') || content.includes('std::') || content.includes('int main')) {
          detectedLanguage = 'C++'; suggestedExtension = '.cpp';
        } else if (content.includes('public class') || content.includes('import java')) {
          detectedLanguage = 'Java'; suggestedExtension = '.java';
        } else if (lowerContent.includes('<html>') || lowerContent.includes('<body>')) {
          detectedLanguage = 'HTML'; suggestedExtension = '.html';
        } else if (lowerContent.match(/[\.#\w-]+\s*\{[\s\S]*\}/)) { 
          detectedLanguage = 'CSS'; suggestedExtension = '.css';
        } else if ((lowerContent.startsWith('{') && lowerContent.endsWith('}')) || (lowerContent.startsWith('[') && lowerContent.endsWith(']'))) {
            try { JSON.parse(content); detectedLanguage = 'JSON'; suggestedExtension = '.json'; } catch (e) { /* not JSON */ }
        } else if (lowerContent.includes('---') && (lowerContent.includes('layout:') || lowerContent.includes('title:'))) {
            detectedLanguage = 'Markdown (Frontmatter)'; suggestedExtension = '.md';
        } else if (lowerContent.includes('# ') || lowerContent.includes('## ')) {
            detectedLanguage = 'Markdown'; suggestedExtension = '.md';
        }
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
    /\b(Math\.\w+)\b/g, 
  ];
  let count = 0;
  mathPatterns.forEach(pattern => {
    count += (content.match(pattern) || []).length;
  });
  return count > 2; 
}

function hasDataProcessingPatterns(content: string): boolean {
  const dataPatterns = [
    /\b(filter|map|reduce|sort|find|forEach|some|every|group|transform|process|parse|extract|load|save)\b/gi,
    /\b(data|array|list|object|collection|item|record|entry|json|csv|xml)\b/gi,
    /\.(forEach|filter|map|reduce|sort|find)\b/g, 
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
  return count > 2 && (content.match(/export\s+(function|const|let|var|class)/gi) || []).length > 1;
}

function hasApiPatterns(content: string): boolean {
  const apiPatterns = [
    /\b(fetch|axios|request|response|endpoint|http|https|url|api|client|query|mutation)\b/gi,
    /\b(get|post|put|delete|patch)\s*\(/gi, 
    /\/api\//gi,
    /\.(get|post|put|delete|patch)\s*\(/gi, 
  ];
  let count = 0;
  apiPatterns.forEach(pattern => {
    count += (content.match(pattern) || []).length;
  });
  return count > 1;
}

function hasMultipleFunctions(content: string, language: string): boolean {
  let functionCount = 0;
  if (language.includes('JavaScript') || language.includes('TypeScript') || language.includes('Google Apps Script')) {
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
  if (language.includes('JavaScript') || language.includes('TypeScript') || language.includes('Google Apps Script')) {
    patterns.push(
      /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, 
      /(?:export\s+)?const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s+)?(?:\([^)]*\))?\s*=>/g, 
      /(?:export\s+default\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g, 
      /(?:export\s+)?(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g 
    );
  } else if (language === 'Python') {
    patterns.push(
      /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 
      /^\s*class\s+([A-Z][a-zA-Z0-9_]*)\s*[\(:]/gm 
    );
  }

  const genericNames = new Set([
    'main', 'init', 'start', 'run', 'execute', 'handler', 'callback', 'constructor',
    'temp', 'test', 'example', 'demo', 'foo', 'bar', 'baz', 'data', 'item', 'value', 'key',
    'get', 'set', 'update', 'create', 'delete', 'index', 'app', 'config', 'util', 'helper', 'render',
    'controller', 'service', 'repository', 'model', 'view', 'module', 'component', 'page'
  ]);

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const funcName = match[1]; 
      if (funcName && 
          funcName.length > 2 && 
          funcName.length < 30 && 
          !genericNames.has(funcName.toLowerCase()) &&
          !/^[A-Z_0-9]+$/.test(funcName) && 
          !uniqueFunctions.has(funcName)) {
        functions.push(funcName);
        uniqueFunctions.add(funcName);
      }
    }
  });
  
  return functions.sort((a, b) => getMeaningfulnessScore(b) - getMeaningfulnessScore(a));
}

function getMeaningfulnessScore(name: string): number {
  let score = name.length; 
  if (/[A-Z]/.test(name) && /[a-z]/.test(name)) score += 5; 
  if (name.includes('_')) score += 3; 
  
  if (/^[A-Z_0-9]+$/.test(name)) score -= 10; 
  if (/^[a-z]/.test(name) && !/\b(get|set|is|has|handle|create|update|delete|calculate|process|validate|format|convert|parse|render|build|generate|fetch|load|save|sum|product)\b/i.test(name)) { 
      score -= 5; 
  }
  return score;
}

const commandLikeWords = new Set([
    'rename', 'create', 'delete', 'move', 'update', 'change', 'make', 'generate', 'write',
    'file', 'folder', 'item', 'this', 'that', 'the', 'a', 'an', 'for', 'to', 'in', 'of', 'is', 'add',
    'script', 'code', 'program', 'function', 'class', 'component', 'module', 'page', 'view',
    'set', 'get', 'put', 'post', 'style', 'config', 'setting', 'main', 'init'
]);

function generateIntelligentSuggestions(
    analysis: ReturnType<typeof analyzeFileContentDeep>, 
    fileType: 'file' | 'folder', 
    context?: string,
    currentFileName?: string
) {
  const suggestions: Array<{filename: string, reasoning: string, confidence: number, category: 'descriptive' | 'conventional' | 'functional' | 'contextual'}> = [];
  const usedNames = new Set<string>();

  const addSuggestion = (baseNameInput: string, reason: string, conf: number, cat: 'descriptive' | 'conventional' | 'functional' | 'contextual') => {
    if (!baseNameInput || baseNameInput.trim() === "" || (baseNameInput.trim().startsWith('.') && baseNameInput.trim().length === 1 && fileType === 'file') ) return;

    let baseNameOriginal = baseNameInput.trim();
    let cleanBase = baseNameOriginal;

    if (fileType === 'file') {
        // More aggressive cleaning for base name before adding extension
        cleanBase = baseNameOriginal
            .replace(/\.[^/.]+$/, "")       // Remove any existing extension
            .replace(/[^a-zA-Z0-9_-]+/g, '_') // Replace invalid chars (allow hyphen)
            .replace(/_{2,}/g, '_')          // Reduce multiple underscores
            .replace(/^_+|_+$/g, '')         // Trim underscores
            .replace(/^-+|-+$/g, '');        // Trim hyphens

        // Special handling for dotfiles: if original was a dotfile, preserve the dot
        if (baseNameOriginal.startsWith('.') && !cleanBase.startsWith('.')) {
            cleanBase = '.' + cleanBase;
        }
        // If cleaning resulted in an empty string but it was a dotfile like ".git" (becomes ""), restore
        if (!cleanBase && baseNameOriginal.startsWith('.')) {
             cleanBase = baseNameOriginal.replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/[,]$/, ""); // Less aggressive for dotfiles
        }
        if (!cleanBase && !baseNameOriginal.startsWith('.')) cleanBase = "suggestion"; // Fallback if cleaning results in empty string
    }


    let finalName = cleanBase;

    if (fileType === 'file') {
        const extensionToUse = analysis.suggestedExtension.startsWith('.')
                               ? analysis.suggestedExtension
                               : (analysis.suggestedExtension ? '.' + analysis.suggestedExtension : '');
        
        if (finalName.startsWith('.')) { // Handles dotfiles like ".gitignore", ".env"
            if (finalName === "." || finalName === "..") {
                 finalName = (analysis.codeType !== 'general' && analysis.codeType !== 'folder') ? analysis.codeType : 'config'; // Default for bad dotfile names
            }
            // If suggestedExtension IS the full dotfile name (e.g., ".gitignore"), it's already set in finalName if cleanBase was derived from it.
            // If finalName is like ".babelrc" and suggestedExtension is ".js", it should be ".babelrc.js"
            // Check if suggestedExtension is a standard one and not already part of finalName (for complex dotfiles)
            const standardExtensions = ['.ts', '.js', '.json', '.md', '.py', '.html', '.css', '.xml', '.yaml', '.yml', '.sh', '.java', '.cs', '.go', '.rb', '.php'];
            if (standardExtensions.includes(extensionToUse) && !finalName.endsWith(extensionToUse)) {
                finalName += extensionToUse;
            } else if (!finalName.includes('.') && extensionToUse.startsWith('.')){ // e.g. base "env", ext ".env"
                finalName = extensionToUse;
            } else if (finalName.includes('.') && extensionToUse && finalName.split('.').pop() !== extensionToUse.substring(1)) {
                // This means finalName might be like ".config" and extensionToUse is ".local" -> ".config.local"
                // Or finalName is "my.config" and extToUse is ".json" -> "my.config.json"
                // This part is tricky; let's assume suggestedExtension for dotfiles is usually the full name.
                // If finalName is like ".eslintrc" and suggestedExtension is also ".eslintrc", this is fine.
                // If finalName is "babelrc" (no dot) and suggestedExtension is ".babelrc", this is also fine.
                 if (extensionToUse && !finalName.endsWith(extensionToUse) && !standardExtensions.includes(extensionToUse) && extensionToUse.startsWith('.')) {
                    // if ext is like ".local" and filename is ".config"
                    finalName += extensionToUse;
                 } else if (!finalName.startsWith('.')) { // base "eslintrc", ext ".eslintrc"
                     finalName = extensionToUse;
                 }
            }
        } else { // Not a dotfile
            finalName = finalName + extensionToUse;
        }
         // Final check if finalName is just an extension (e.g. user typed ".ts")
        if (finalName.startsWith('.') && !/[a-zA-Z0-9]/.test(finalName.substring(1))) {
            finalName = `file${finalName}`;
        }
        if (finalName === extensionToUse) { // If base was empty and only extension remained
            finalName = `untitled${extensionToUse}`;
        }


    } else { // folder
      finalName = cleanFolderName(finalName); 
    }
    
    if (finalName && !usedNames.has(finalName.toLowerCase()) && suggestions.length < 5) {
      suggestions.push({ filename: finalName, reasoning: reason, confidence: Math.min(0.95, Math.max(0.1, conf)), category: cat });
      usedNames.add(finalName.toLowerCase());
    }
  };
  
  if (analysis.mainFunctions.length > 0) {
    addSuggestion(analysis.mainFunctions[0], `Based on the primary entity: ${analysis.mainFunctions[0]}`, 0.9, 'functional');
  }

  if (analysis.codeType !== 'general' && analysis.codeType !== 'folder') {
    let conventionalBase = '';
    if (analysis.codeType === 'component') conventionalBase = analysis.mainFunctions[0] || 'NewComponent';
    else if (analysis.codeType === 'hook') conventionalBase = analysis.mainFunctions[0] || 'useNewHook';
    else if (analysis.codeType === 'utility') conventionalBase = 'utils';
    else if (analysis.codeType === 'service') conventionalBase = analysis.mainFunctions[0] ? `${analysis.mainFunctions[0]}Service` : 'apiService';
    else if (analysis.codeType === 'types') conventionalBase = 'types';
    else if (analysis.codeType === 'math-operations') conventionalBase = analysis.mainFunctions[0] || 'mathUtils';
    else if (analysis.codeType === 'data-processor') conventionalBase = analysis.mainFunctions[0] || 'dataProcessor';
    else if (analysis.codeType === 'functions-module') conventionalBase = analysis.mainFunctions[0] ? `${analysis.mainFunctions[0]}Module` : 'helpers';
    else if (analysis.codeType === 'class') conventionalBase = analysis.mainFunctions[0] || 'NewClass';

    if (conventionalBase) {
       addSuggestion(conventionalBase, `Conventional name for a ${analysis.codeType}`, 0.8, 'conventional');
    }
  }
  
  if (context) {
    const allWords = context.toLowerCase().split(/\s+/);
    const meaningfulContextWords = allWords
        .map(word => word.replace(/[^a-z0-9_-]/gi, '')) // Allow hyphen and underscore in words initially
        .filter(word => word.length >= 3 && !commandLikeWords.has(word.toLowerCase()));

    if (meaningfulContextWords.length > 0) {
        let contextBase = meaningfulContextWords.slice(0, 2).join('_');
        contextBase = contextBase.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 35); // Allow hyphens, limit length
        if (contextBase) {
             addSuggestion(contextBase, `From your instruction: "${context.length > 30 ? context.substring(0,27) + '...' : context}"`, 0.75, 'contextual');
        }
    }
  }

  if (suggestions.length < 2 && analysis.codeType !== 'general' && analysis.codeType !== 'folder') {
    let descriptiveBase = analysis.codeType.replace(/-/g, '_'); 
    if (analysis.mainFunctions.length > 1) { 
      descriptiveBase += `_${analysis.mainFunctions[1]}`;
    } else if (analysis.mainFunctions.length === 0 && context) { 
      const contextWord = context.toLowerCase().match(/\b[a-zA-Z_][a-zA-Z0-9_-]{3,}\b/g)?.filter(w => !commandLikeWords.has(w.toLowerCase()))[0];
      if (contextWord) descriptiveBase += `_${contextWord}`;
    }
    descriptiveBase = descriptiveBase.slice(0, 30); 
    addSuggestion(descriptiveBase, `Descriptive name for ${analysis.codeType}`, 0.7, 'descriptive');
  }

  const fallbacks = fileType === 'folder' 
    ? ['CommonUtils', 'SharedComponents', 'CoreLogic', 'AppModules', 'DomainServices']
    : ['appLogic', 'coreFunctionality', 'utilsCollection', 'mainScript', 'dataModule', 'eventHandlers'];
  
  let fallbackIndex = 0;
  while (suggestions.length < 5 && fallbackIndex < fallbacks.length) { 
    let fallbackBase = fallbacks[fallbackIndex++];
    addSuggestion(fallbackBase, 'General purpose fallback name', 0.5 - (suggestions.length * 0.1), 'descriptive');
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

