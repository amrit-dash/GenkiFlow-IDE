
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
            const currentFileExt = currentFileParts.length > 1 && currentFileParts[0] !== "" ? `.${currentFileParts.pop()!.toLowerCase()}` : (currentFileParts[0].startsWith('.') ? currentFileParts[0].toLowerCase() : "");
            const currentFileBase = currentFileParts.join('.').toLowerCase();

            finalSuggestions = generatedSuggestions.filter(s => {
                const suggestionParts = s.filename.split('.');
                const suggestionExt = suggestionParts.length > 1 && suggestionParts[0] !== "" ? `.${suggestionParts.pop()!.toLowerCase()}` : (suggestionParts[0].startsWith('.') ? suggestionParts[0].toLowerCase() : "");
                const suggestionBase = suggestionParts.join('.').toLowerCase();

                if (currentFileExt === "" && suggestionExt === "") {
                    return suggestionBase !== currentFileBase;
                }
                // Handles cases like ".gitignore" vs ".gitignore" or "file.ts" vs "file.ts"
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
      '.h': { lang: 'C++', ext: '.h' },
      '.hpp': { lang: 'C++', ext: '.hpp' },
      '.html': { lang: 'HTML', ext: '.html' },
      '.htm': { lang: 'HTML', ext: '.htm' },
      '.css': { lang: 'CSS', ext: '.css' },
      '.json': { lang: 'JSON', ext: '.json' },
      '.md': { lang: 'Markdown', ext: '.md' },
      '.markdown': { lang: 'Markdown', ext: '.markdown' },
    };
    
    if (extFromCurrentName && languageMap[extFromCurrentName]) {
        detectedLanguage = languageMap[extFromCurrentName].lang;
        suggestedExtension = languageMap[extFromCurrentName].ext;
    } else if (extFromCurrentName && extFromCurrentName.startsWith('.')) { 
        detectedLanguage = `Configuration (${extFromCurrentName})`; 
        suggestedExtension = extFromCurrentName;
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
        // Remove common problematic patterns or existing extensions from the base name
        // Goal: get a clean identifier to which we'll append the *suggested* extension
        cleanBase = baseNameOriginal
            .replace(/\.[^/.]+$/, "") // Remove any existing extension
            .replace(/[^a-zA-Z0-9_.-]+/g, '_') // Replace invalid characters with underscore
            .replace(/[,]$/, "") // Remove trailing comma
            .replace(/_{2,}/g, '_') // Reduce multiple underscores to one
            .replace(/^_+|_+$/g, ''); // Trim underscores from start/end

        // For dotfiles, the "extension" is the whole name after the dot.
        // For regular files, ensure no dots remain in the cleanBase before appending the true extension.
        if (baseNameOriginal.startsWith('.')) {
             // e.g. ".eslintrc" -> cleanBase = ".eslintrc"
             // e.g. ".foo.bar" -> cleanBase = ".foo" (if .bar is seen as an extension to strip)
             // Let's assume for dotfiles, the base IS the name.
             cleanBase = baseNameOriginal.replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/[,]$/, "");
             if (cleanBase.lastIndexOf('.') > 0) { // if it's like ".foo.bar"
                //  cleanBase = cleanBase.substring(0, cleanBase.lastIndexOf('.'));
             }
        } else {
            cleanBase = cleanBase.split('.')[0]; // Take only the part before the first dot if not a dotfile
        }
         if (!cleanBase && baseNameOriginal.startsWith('.')) cleanBase = baseNameOriginal; // Restore if cleaning made it empty (e.g. was just ".myconfig")
         if (!cleanBase) cleanBase = "suggestion"; // Fallback if cleaning results in empty string
    }


    let finalName = cleanBase;

    if (fileType === 'file') {
        const extensionToUse = analysis.suggestedExtension.startsWith('.')
                               ? analysis.suggestedExtension
                               : (analysis.suggestedExtension ? '.' + analysis.suggestedExtension : '');
        
        if (finalName.startsWith('.')) { // Handles dotfiles like ".gitignore", ".env"
            // Dotfiles generally don't get another extension appended unless `suggestedExtension` itself implies it.
            // If `analysis.suggestedExtension` IS the dotfile name (e.g. ".gitignore"), it's fine.
            // If `finalName` is ".babelrc" and `suggestedExtension` is ".js", it should be ".babelrc.js"
            // However, `analysis.suggestedExtension` for ".babelrc" would BE ".babelrc".
            if (finalName === "." || finalName === "..") finalName = "config"; // Default for bad dotfile names
            else if (extensionToUse && finalName !== extensionToUse && !finalName.endsWith(extensionToUse)) {
                 // This case is tricky. If finalName=".config" and extToUse=".json", maybe ".config.json"?
                 // For now, if it's a dotfile, assume `finalName` is complete or `suggestedExtension` IS the full dotfilename.
                 // If `suggestedExtension` is a standard one like ".ts" AND finalName is a dotfile base, append.
                 if (['.ts', '.js', '.py', '.json', '.md', '.html', '.css'].includes(extensionToUse)) {
                    finalName = finalName + extensionToUse;
                 }
                 // else, assume finalName as a dotfile is complete. e.g. finalName = ".gitignore"
            } else if (!finalName.includes('.')) { // A base like "env" for a dotfile ".env"
                 finalName = extensionToUse; // suggestedExtension would be ".env"
            }
        } else {
            finalName = finalName + extensionToUse;
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
    const contextWords = context.toLowerCase().match(/\b\w{4,}\b/g) || []; 
    if (contextWords.length > 0) {
      let contextBase = contextWords.slice(0,2).join('_'); 
      contextBase = contextBase.replace(/[^a-zA-Z0-9_]/g, ''); 
      addSuggestion(contextBase, `Based on your instruction: "${context}"`, 0.75, 'contextual');
    }
  }

  if (suggestions.length < 2 && analysis.codeType !== 'general' && analysis.codeType !== 'folder') {
    let descriptiveBase = analysis.codeType.replace(/-/g, '_'); 
    if (analysis.mainFunctions.length > 1) { 
      descriptiveBase += `_${analysis.mainFunctions[1]}`;
    } else if (analysis.mainFunctions.length === 0 && context) { 
      const contextWord = context.toLowerCase().match(/\b\w{4,}\b/g)?.[0];
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

