/**
 * @fileOverview Defines a Genkit tool for AI-powered filename suggestions.
 *
 * - filenameSuggester: A tool that analyzes file content and suggests appropriate filenames.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the tool
const FilenameSuggesterInputSchema = z.object({
  fileContent: z.string().describe('The content of the file to analyze (for folders, this would be a description of the folder context or purpose)'),
  currentFileName: z.string().optional().describe('The current filename if any (e.g., "untitled.txt", "myComponent.tsx")'),
  fileType: z.enum(['file', 'folder']).default('file').describe('Type of the item to suggest name for (file or folder)'),
  context: z.string().optional().describe('Additional context about the file/folder purpose, including user intent and desired location'),
  projectStructure: z.string().optional().describe('Project file structure for context'),
  folderContents: z.array(z.object({
    name: z.string().describe('File/folder name'),
    type: z.enum(['file', 'folder']).describe('Type of the item'),
    path: z.string().describe('Full path of the item'),
    content: z.string().optional().describe('File content (for files only)'),
    language: z.string().optional().describe('Detected programming language'),
    purpose: z.string().optional().describe('Inferred purpose of the file'),
  })).optional().describe('Contents of the folder being renamed/analyzed (for folder operations)'),
  targetLocation: z.string().optional().describe('Desired location/parent directory path parsed from user context'),
  userIntent: z.object({
    operation: z.enum(['create', 'rename', 'move']).describe('The intended operation'),
    locationHint: z.string().optional().describe('Location preference extracted from user query'),
    purposeHint: z.string().optional().describe('Purpose/function hint from user query'),
    domainContext: z.string().optional().describe('Domain-specific context (e.g., "components", "utils", "api")'),
  }).optional().describe('Parsed user intent and context'),
});

// Define the output schema for the tool
const FilenameSuggesterOutputSchema = z.object({
  suggestions: z.array(z.object({
    filename: z.string().describe('Suggested filename (with extension for files, without for folders)'),
    reasoning: z.string().describe('Explanation for why this name was suggested'),
    confidence: z.number().min(0).max(1).describe('Confidence score (0-1)'),
    category: z.enum(['descriptive', 'conventional', 'functional', 'contextual']).describe('Type of naming strategy'),
    suggestedLocation: z.string().optional().describe('Recommended location/parent directory for this item'),
  })).describe('List of filename suggestions ordered by confidence'),
  analysis: z.object({
    detectedLanguage: z.string().describe('Programming language detected (or "Folder" for folders)'),
    codeType: z.string().describe('Type of code/content (component, utility, service, folder-type, etc.)'),
    mainFunctions: z.array(z.string()).describe('Main functions/exports found (or key files for folders)'),
    hasExports: z.boolean().describe('Whether file exports functions/classes (or folder contains modules)'),
    isComponent: z.boolean().describe('Whether this appears to be a UI component (or component folder)'),
    suggestedExtension: z.string().describe('Recommended file extension (empty for folders)'),
    currentFileNameForFiltering: z.string().optional().describe('The current filename, passed through for filtering'),
    folderPurpose: z.string().optional().describe('Inferred purpose of the folder based on contents'),
    folderDomain: z.string().optional().describe('Domain category (e.g., "frontend", "backend", "shared", "config")'),
    isEmpty: z.boolean().describe('Whether the folder is empty (for folder operations)'),
    dominantLanguage: z.string().optional().describe('Most common programming language in folder'),
    recommendedParent: z.string().optional().describe('Suggested parent directory path'),
  }).describe('Analysis of the file/folder content'),
  locationSuggestions: z.array(z.object({
    path: z.string().describe('Suggested location path'),
    reasoning: z.string().describe('Why this location is recommended'),
    confidence: z.number().min(0).max(1).describe('Confidence in this location suggestion'),
  })).optional().describe('Suggested locations for creating/moving the item'),
});

export const filenameSuggester = ai.defineTool(
  {
    name: 'filenameSuggester',
    description: 'Analyzes file/folder content deeply and suggests exactly 3 contextual, non-repetitive names based on content, structure, functions, and user context. Provides intelligent naming with location suggestions for both files and folders. Handles folder analysis based on contents and user intent.',
    inputSchema: FilenameSuggesterInputSchema,
    outputSchema: FilenameSuggesterOutputSchema,
  },
  async (input) => {
    console.log(`Filename suggester called for ${input.fileType}: ${input.currentFileName || 'New Item'}`);
    console.log(`Context: ${input.context || 'None'}`);
    console.log(`User intent: ${input.userIntent ? JSON.stringify(input.userIntent) : 'None'}`);
    
    const content = input.fileContent;
    const currentName = input.currentFileName;
    const fileType = input.fileType || 'file';
    const folderContents = input.folderContents || [];
    const userIntent = input.userIntent;
    const targetLocation = input.targetLocation;
    
    // Enhanced analysis for files and folders
    const analysis = analyzeContentWithContext(content, fileType, currentName, folderContents, userIntent, input.projectStructure);
    
    // Generate intelligent suggestions with location awareness
    let generatedSuggestions = generateContextualSuggestions(
      analysis, 
      fileType, 
      input.context, 
      currentName,
      folderContents,
      userIntent,
      input.projectStructure
    );
    
    // Generate location suggestions
    const locationSuggestions = generateLocationSuggestions(
      analysis,
      fileType,
      input.context,
      userIntent,
      input.projectStructure,
      targetLocation
    );
    
    // Filter out suggestions that are identical to the current file name
    let finalSuggestions = generatedSuggestions;
    if (currentName) {
        if (fileType === 'file') {
            const currentNameLower = currentName.toLowerCase();
            let currentFileExt = '';
            let currentFileBase = currentNameLower;

            const lastDotIndex = currentName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                currentFileExt = currentName.substring(lastDotIndex).toLowerCase();
                currentFileBase = currentName.substring(0, lastDotIndex).toLowerCase();
            } else if (lastDotIndex === 0) {
                currentFileExt = currentName.toLowerCase();
                currentFileBase = "";
            }

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
                
                if (currentFileExt === '' && suggestionExt === '') {
                    return suggestionBase !== currentFileBase;
                }
                if ((currentFileBase === "" && currentFileExt !== "") !== (suggestionBase === "" && suggestionExt !== "")) {
                    return true;
                }

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
      analysis: { 
        ...analysis, 
        currentFileNameForFiltering: currentName 
      },
      locationSuggestions: locationSuggestions.length > 0 ? locationSuggestions : undefined
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

// Enhanced analysis function that handles both files and folders with context
function analyzeContentWithContext(
  content: string, 
  fileType: 'file' | 'folder', 
  currentFileName?: string,
  folderContents?: any[],
  userIntent?: any,
  projectStructure?: string
) {
  const lowerContent = content.toLowerCase();
  
  let detectedLanguage = 'Text';
  let suggestedExtension = '.txt';

  // Handle empty content edge case
  if (!content || content.trim() === '') {
    detectedLanguage = 'Text';
    suggestedExtension = '.txt';
    if (currentFileName) {
      // Preserve the extension from current filename for empty files
      const lastDotIndex = currentFileName.lastIndexOf('.');
      if (lastDotIndex > 0) {
        suggestedExtension = currentFileName.substring(lastDotIndex);
        // Try to determine language from extension
        const ext = suggestedExtension.toLowerCase();
        if (ext === '.js') detectedLanguage = 'JavaScript';
        else if (ext === '.ts') detectedLanguage = 'TypeScript';
        else if (ext === '.py') detectedLanguage = 'Python';
        else if (ext === '.md') detectedLanguage = 'Markdown';
        else if (ext === '.json') detectedLanguage = 'JSON';
        else if (ext === '.html') detectedLanguage = 'HTML';
        else if (ext === '.css') detectedLanguage = 'CSS';
        else detectedLanguage = 'Text';
      }
    }
  }

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
  
  // Analyze folder contents if this is a folder
  let folderPurpose = '';
  let folderDomain = '';
  let isEmpty = true;
  let dominantLanguage = '';
  let recommendedParent = '';

  if (fileType === 'folder') {
    isEmpty = !folderContents || folderContents.length === 0;
    
    if (!isEmpty && folderContents) {
      // First, try to parse rich context if available
      if (content && content.includes('Main purposes:')) {
        const purposeMatch = content.match(/Main purposes:\s*([^.]+)/);
        if (purposeMatch) {
          const mainPurpose = purposeMatch[1].trim();
          // Map main purposes to folder names
          if (mainPurpose.toLowerCase().includes('web scraping') || mainPurpose.toLowerCase().includes('scraping')) {
            folderPurpose = 'Web Scraping Tools';
            folderDomain = 'data-extraction';
          } else if (mainPurpose.toLowerCase().includes('data processing') || mainPurpose.toLowerCase().includes('data analysis')) {
            folderPurpose = 'Data Processing';
            folderDomain = 'data-analysis';
          } else if (mainPurpose.toLowerCase().includes('api') || mainPurpose.toLowerCase().includes('service')) {
            folderPurpose = 'API Services';
            folderDomain = 'backend';
          } else if (mainPurpose.toLowerCase().includes('component') || mainPurpose.toLowerCase().includes('ui')) {
            folderPurpose = 'UI Components';
            folderDomain = 'frontend';
          } else if (mainPurpose.toLowerCase().includes('util') || mainPurpose.toLowerCase().includes('helper')) {
            folderPurpose = 'Utility Functions';
            folderDomain = 'shared';
          } else if (mainPurpose.toLowerCase().includes('automation') || mainPurpose.toLowerCase().includes('script')) {
            folderPurpose = 'Automation Scripts';
            folderDomain = 'automation';
          } else if (mainPurpose.toLowerCase().includes('testing') || mainPurpose.toLowerCase().includes('test')) {
            folderPurpose = 'Testing Suite';
            folderDomain = 'testing';
          } else {
            // Use the actual purpose text but clean it up
            folderPurpose = mainPurpose.charAt(0).toUpperCase() + mainPurpose.slice(1);
            folderDomain = 'shared';
          }
        }
      }
      
      // If no rich context, fall back to original filename-based analysis
      if (!folderPurpose) {
        // Analyze folder contents to determine purpose and domain
        const fileTypes = folderContents.map(item => item.language).filter(Boolean);
        const filePurposes = folderContents.map(item => item.purpose).filter(Boolean);
        
        // Check for specific patterns in file contents if available
        const hasScrapingContent = folderContents.some(item => 
          item.content && (
            item.content.includes('requests.get') || 
            item.content.includes('BeautifulSoup') || 
            item.content.includes('scraper') ||
            item.content.includes('web scraping')
          )
        );
        
        const hasDataProcessing = folderContents.some(item =>
          item.content && (
            item.content.includes('pandas') ||
            item.content.includes('numpy') ||
            item.content.includes('data processing') ||
            item.content.includes('csv') ||
            item.content.includes('json')
          )
        );
        
        const hasApiContent = folderContents.some(item =>
          item.content && (
            item.content.includes('fetch(') ||
            item.content.includes('axios') ||
            item.content.includes('/api/') ||
            item.content.includes('endpoint')
          )
        );
        
        // Set purpose based on content analysis
        if (hasScrapingContent) {
          folderPurpose = 'Web Scraping Tools';
          folderDomain = 'data-extraction';
        } else if (hasDataProcessing) {
          folderPurpose = 'Data Processing';
          folderDomain = 'data-analysis';
        } else if (hasApiContent) {
          folderPurpose = 'API Services';
          folderDomain = 'backend';
        } else if (folderContents.some(item => item.name.includes('component') || item.name.includes('Component'))) {
          folderPurpose = 'UI Components Container';
          folderDomain = 'frontend';
        } else if (folderContents.some(item => item.name.includes('util') || item.name.includes('helper'))) {
          folderPurpose = 'Utility Functions';
          folderDomain = 'shared';
        } else if (folderContents.some(item => item.name.includes('api') || item.name.includes('service'))) {
          folderPurpose = 'API/Service Layer';
          folderDomain = 'backend';
        } else if (folderContents.some(item => item.name.includes('type') || item.name.includes('interface'))) {
          folderPurpose = 'Type Definitions';
          folderDomain = 'shared';
        } else if (folderContents.some(item => item.name.includes('config') || item.name.includes('setting'))) {
          folderPurpose = 'Configuration';
          folderDomain = 'config';
        } else {
          folderPurpose = 'General Purpose';
          folderDomain = 'shared';
        }
      }
      
      // Determine dominant language
      const fileTypes = folderContents.map(item => item.language).filter(Boolean);
      const languageCounts = fileTypes.reduce((acc: any, lang: string) => {
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      }, {});
      dominantLanguage = Object.keys(languageCounts).reduce((a, b) => 
        languageCounts[a] > languageCounts[b] ? a : b, ''
      ) || 'Mixed';
    }

    // Suggest parent directory based on purpose and user intent
    if (userIntent?.locationHint) {
      recommendedParent = userIntent.locationHint;
    } else if (folderPurpose.includes('Scraping') || folderPurpose.includes('Data')) {
      recommendedParent = 'src/tools';
    } else if (folderPurpose.includes('Component')) {
      recommendedParent = 'src/components';
    } else if (folderPurpose.includes('Utility')) {
      recommendedParent = 'src/utils';
    } else if (folderPurpose.includes('API')) {
      recommendedParent = 'src/api';
    } else if (folderPurpose.includes('Type')) {
      recommendedParent = 'src/types';
    } else if (folderPurpose.includes('Automation')) {
      recommendedParent = 'src/scripts';
    }
  }

  const mainFunctions = extractMeaningfulFunctions(content, detectedLanguage);
  const hasExports = content.includes('export') || content.includes('module.exports');
  
  return {
    detectedLanguage: detectedLanguage || 'Text',
    codeType: codeType || 'general',
    mainFunctions: mainFunctions.slice(0, 5), 
    hasExports: hasExports || false,
    isComponent: isComponent || false,
    suggestedExtension: suggestedExtension || '.txt',
    folderPurpose: folderPurpose || undefined,
    folderDomain: folderDomain || undefined,
    isEmpty: isEmpty,
    dominantLanguage: dominantLanguage || undefined,
    recommendedParent: recommendedParent || undefined,
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

// New enhanced function for contextual suggestions
function generateContextualSuggestions(
    analysis: ReturnType<typeof analyzeContentWithContext>, 
    fileType: 'file' | 'folder', 
    context?: string,
    currentFileName?: string,
    folderContents?: any[],
    userIntent?: any,
    projectStructure?: string
) {
  const suggestions: Array<{
    filename: string, 
    reasoning: string, 
    confidence: number, 
    category: 'descriptive' | 'conventional' | 'functional' | 'contextual',
    suggestedLocation?: string
  }> = [];
  const usedNames = new Set<string>();

  const addSuggestion = (
    baseNameInput: string, 
    reason: string, 
    conf: number, 
    cat: 'descriptive' | 'conventional' | 'functional' | 'contextual',
    location?: string
  ) => {
    if (!baseNameInput || baseNameInput.trim() === "") return;

    let baseNameOriginal = baseNameInput.trim();
    let cleanBase = baseNameOriginal;

    if (fileType === 'file') {
        cleanBase = baseNameOriginal
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/^-+|-+$/g, '');

        if (baseNameOriginal.startsWith('.') && !cleanBase.startsWith('.')) {
            cleanBase = '.' + cleanBase;
        }
        if (!cleanBase && baseNameOriginal.startsWith('.')) {
             cleanBase = baseNameOriginal.replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/[,]$/, "");
        }
        if (!cleanBase && !baseNameOriginal.startsWith('.')) cleanBase = "suggestion";
    }

    let finalName = cleanBase;

    if (fileType === 'file') {
        const extensionToUse = analysis.suggestedExtension.startsWith('.')
                               ? analysis.suggestedExtension
                               : (analysis.suggestedExtension ? '.' + analysis.suggestedExtension : '');
        
        if (finalName.startsWith('.')) {
            if (finalName === "." || finalName === "..") {
                 finalName = (analysis.codeType !== 'general' && analysis.codeType !== 'folder') ? analysis.codeType : 'config';
            }
            const standardExtensions = ['.ts', '.js', '.json', '.md', '.py', '.html', '.css', '.xml', '.yaml', '.yml', '.sh', '.java', '.cs', '.go', '.rb', '.php'];
            if (standardExtensions.includes(extensionToUse) && !finalName.endsWith(extensionToUse)) {
                finalName += extensionToUse;
            } else if (!finalName.includes('.') && extensionToUse.startsWith('.')){
                finalName = extensionToUse;
            } else if (finalName.includes('.') && extensionToUse && finalName.split('.').pop() !== extensionToUse.substring(1)) {
                 if (extensionToUse && !finalName.endsWith(extensionToUse) && !standardExtensions.includes(extensionToUse) && extensionToUse.startsWith('.')) {
                    finalName += extensionToUse;
                 } else if (!finalName.startsWith('.')) {
                     finalName = extensionToUse;
                 }
            }
        } else {
            finalName = finalName + extensionToUse;
        }
        if (finalName.startsWith('.') && !/[a-zA-Z0-9]/.test(finalName.substring(1))) {
            finalName = `file${finalName}`;
        }
        if (finalName === extensionToUse) {
            finalName = `untitled${extensionToUse}`;
        }
    } else {
      finalName = cleanFolderName(finalName); 
    }
    
    if (finalName && !usedNames.has(finalName.toLowerCase()) && suggestions.length < 5) {
      suggestions.push({ 
        filename: finalName, 
        reasoning: reason, 
        confidence: Math.min(0.95, Math.max(0.1, conf)), 
        category: cat,
        suggestedLocation: location
      });
      usedNames.add(finalName.toLowerCase());
    }
  };

  // Enhanced suggestions based on folder analysis and user intent
  if (fileType === 'folder') {
    // Handle folder-specific suggestions based on contents and user intent
    if (analysis.isEmpty) {
      if (userIntent?.purposeHint) {
        const purposeWords = userIntent.purposeHint.toLowerCase().split(/\s+/);
        const meaningfulWords = purposeWords.filter((word: string) => 
          word.length > 2 && !commandLikeWords.has(word)
        );
        if (meaningfulWords.length > 0) {
          const purposeName = meaningfulWords.slice(0, 2).join('-');
          addSuggestion(purposeName, `Based on your intended purpose: ${userIntent.purposeHint}`, 0.85, 'contextual', analysis.recommendedParent);
        }
      }
      
      if (userIntent?.domainContext) {
        addSuggestion(userIntent.domainContext, `Domain-specific folder for ${userIntent.domainContext}`, 0.8, 'conventional', analysis.recommendedParent);
      }
      
      // Default suggestions for empty folders
      addSuggestion('new-modules', 'General purpose modules folder', 0.6, 'descriptive', 'src');
      addSuggestion('workspace', 'Development workspace folder', 0.5, 'contextual', '.');
    } else {
      // Folder has contents - suggest based on analysis
      if (analysis.folderPurpose && analysis.folderPurpose !== 'General Purpose') {
        // Enhanced suggestions based on specific folder purposes
        if (analysis.folderPurpose === 'Web Scraping Tools') {
          addSuggestion('WebScrapers', 'Dedicated folder for web scraping modules and tools', 0.95, 'functional', analysis.recommendedParent);
          addSuggestion('ScrapingTools', 'Collection of web scraping utilities', 0.9, 'functional', analysis.recommendedParent);
          addSuggestion('DataExtractors', 'Tools for extracting data from web sources', 0.85, 'functional', analysis.recommendedParent);
        } else if (analysis.folderPurpose === 'Data Processing') {
          addSuggestion('DataProcessing', 'Data analysis and processing modules', 0.95, 'functional', analysis.recommendedParent);
          addSuggestion('DataUtils', 'Data manipulation utilities', 0.9, 'functional', analysis.recommendedParent);
          addSuggestion('Analytics', 'Data analytics and processing tools', 0.85, 'functional', analysis.recommendedParent);
        } else if (analysis.folderPurpose === 'API Services') {
          addSuggestion('ApiServices', 'API service modules', 0.95, 'functional', analysis.recommendedParent);
          addSuggestion('Services', 'Service layer modules', 0.9, 'conventional', analysis.recommendedParent);
          addSuggestion('ApiClient', 'API client implementations', 0.85, 'functional', analysis.recommendedParent);
        } else if (analysis.folderPurpose === 'Automation Scripts') {
          addSuggestion('AutomationScripts', 'Automation and scripting tools', 0.95, 'functional', analysis.recommendedParent);
          addSuggestion('Scripts', 'Collection of utility scripts', 0.9, 'conventional', analysis.recommendedParent);
          addSuggestion('Automation', 'Automated task modules', 0.85, 'functional', analysis.recommendedParent);
        } else {
          // Generic purpose-based suggestions
          const purposeBasedName = analysis.folderPurpose.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          addSuggestion(purposeBasedName, `Based on folder contents: ${analysis.folderPurpose}`, 0.9, 'functional', analysis.recommendedParent);
        }
      }
      
      if (analysis.dominantLanguage && analysis.dominantLanguage !== 'Mixed') {
        const langName = analysis.dominantLanguage.toLowerCase().replace(/\s+/g, '-');
        // Create language-specific suggestions based on purpose
        if (analysis.folderPurpose === 'Web Scraping Tools') {
          addSuggestion(`${analysis.dominantLanguage}Scrapers`, `${analysis.dominantLanguage} web scraping modules`, 0.85, 'descriptive', analysis.recommendedParent);
        } else {
          addSuggestion(`${langName}-modules`, `${analysis.dominantLanguage} modules collection`, 0.75, 'descriptive', analysis.recommendedParent);
        }
      }
      
      if (folderContents && folderContents.length > 0) {
        const firstFile = folderContents[0];
        if (firstFile.name && !firstFile.name.startsWith('.')) {
          const baseName = firstFile.name.split('.')[0];
          // Create contextual suggestions based on main file
          if (analysis.folderPurpose === 'Web Scraping Tools') {
            addSuggestion(`${baseName}Tools`, `Tools related to ${firstFile.name}`, 0.8, 'contextual', analysis.recommendedParent);
          } else {
            addSuggestion(`${baseName}-group`, `Related to primary file: ${firstFile.name}`, 0.7, 'contextual', analysis.recommendedParent);
          }
        }
      }
    }
  } else {
    // File suggestions - enhanced with location awareness
    if (analysis.mainFunctions.length > 0) {
      const primaryFunc = analysis.mainFunctions[0];
      let suggestedLocation = '';
      
      if (analysis.isComponent) {
        suggestedLocation = 'src/components';
      } else if (analysis.codeType === 'utility') {
        suggestedLocation = 'src/utils';
      } else if (analysis.codeType === 'service') {
        suggestedLocation = 'src/services';
      } else if (analysis.codeType === 'types') {
        suggestedLocation = 'src/types';
      }
      
      addSuggestion(primaryFunc, `Based on the primary function: ${primaryFunc}`, 0.9, 'functional', suggestedLocation);
    }

    if (analysis.codeType !== 'general') {
      let conventionalBase = '';
      let suggestedLocation = '';
      
      if (analysis.codeType === 'component') {
        conventionalBase = analysis.mainFunctions[0] || 'NewComponent';
        suggestedLocation = 'src/components';
      } else if (analysis.codeType === 'hook') {
        conventionalBase = analysis.mainFunctions[0] || 'useNewHook';
        suggestedLocation = 'src/hooks';
      } else if (analysis.codeType === 'utility') {
        conventionalBase = 'utils';
        suggestedLocation = 'src/utils';
      } else if (analysis.codeType === 'service') {
        conventionalBase = analysis.mainFunctions[0] ? `${analysis.mainFunctions[0]}Service` : 'apiService';
        suggestedLocation = 'src/services';
      } else if (analysis.codeType === 'types') {
        conventionalBase = 'types';
        suggestedLocation = 'src/types';
      }

      if (conventionalBase) {
         addSuggestion(conventionalBase, `Conventional name for a ${analysis.codeType}`, 0.8, 'conventional', suggestedLocation);
      }
    }
  }

  // Context-based suggestions
  if (context) {
    const allWords = context.toLowerCase().split(/\s+/);
    const meaningfulContextWords = allWords
        .map(word => word.replace(/[^a-z0-9_-]/gi, ''))
        .filter(word => word.length >= 3 && !commandLikeWords.has(word.toLowerCase()));

    if (meaningfulContextWords.length > 0) {
        let contextBase = meaningfulContextWords.slice(0, 2).join('_');
        contextBase = contextBase.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 35);
        if (contextBase) {
             addSuggestion(contextBase, `From your instruction: "${context.length > 30 ? context.substring(0,27) + '...' : context}"`, 0.75, 'contextual');
        }
    }
  }

  // Fill with fallbacks if needed
  const fallbacks = fileType === 'folder' 
    ? [
        { name: 'shared-modules', reason: 'Shared components and utilities', conf: 0.5, cat: 'descriptive' as const, loc: 'src' },
        { name: 'common-utils', reason: 'Common utility functions', conf: 0.4, cat: 'descriptive' as const, loc: 'src' },
        { name: 'workspace', reason: 'General workspace folder', conf: 0.3, cat: 'contextual' as const, loc: '.' },
      ]
    : [
        { name: 'main', reason: 'Standard entry point file', conf: 0.5, cat: 'conventional' as const, loc: 'src' },
        { name: 'index', reason: 'Common index file name', conf: 0.4, cat: 'conventional' as const, loc: 'src' },
        { name: 'utils', reason: 'Utility functions file', conf: 0.3, cat: 'descriptive' as const, loc: 'src/utils' },
      ];
  
  for (const fallback of fallbacks) {
    if (suggestions.length >= 3) break;
    addSuggestion(fallback.name, fallback.reason, fallback.conf, fallback.cat, fallback.loc);
  }

  return suggestions.slice(0, 3).sort((a, b) => b.confidence - a.confidence);
}

// Generate location suggestions based on context and analysis
function generateLocationSuggestions(
  analysis: ReturnType<typeof analyzeContentWithContext>,
  fileType: 'file' | 'folder',
  context?: string,
  userIntent?: any,
  projectStructure?: string,
  targetLocation?: string
) {
  const suggestions: Array<{
    path: string,
    reasoning: string,
    confidence: number
  }> = [];

  // Priority: explicit target location from user
  if (targetLocation) {
    suggestions.push({
      path: targetLocation,
      reasoning: 'Explicitly specified target location',
      confidence: 0.95
    });
  }

  // User intent location hint
  if (userIntent?.locationHint && userIntent.locationHint !== targetLocation) {
    suggestions.push({
      path: userIntent.locationHint,
      reasoning: 'Based on your location preference',
      confidence: 0.9
    });
  }

  // Analysis-based recommendations
  if (analysis.recommendedParent) {
    suggestions.push({
      path: analysis.recommendedParent,
      reasoning: `Recommended for ${fileType} type: ${analysis.codeType}`,
      confidence: 0.8
    });
  }

  // Content-type based suggestions
  if (fileType === 'file') {
    if (analysis.isComponent) {
      suggestions.push({
        path: 'src/components',
        reasoning: 'Standard location for React components',
        confidence: 0.75
      });
    } else if (analysis.codeType === 'utility') {
      suggestions.push({
        path: 'src/utils',
        reasoning: 'Standard location for utility functions',
        confidence: 0.75
      });
    } else if (analysis.codeType === 'service') {
      suggestions.push({
        path: 'src/services',
        reasoning: 'Standard location for service modules',
        confidence: 0.75
      });
    }
  } else if (fileType === 'folder') {
    if (analysis.folderDomain === 'frontend') {
      suggestions.push({
        path: 'src',
        reasoning: 'Frontend modules belong in src directory',
        confidence: 0.7
      });
    } else if (analysis.folderDomain === 'shared') {
      suggestions.push({
        path: 'src/shared',
        reasoning: 'Shared utilities and components location',
        confidence: 0.7
      });
    }
  }

  // Remove duplicates and return top 3
  const uniqueSuggestions = suggestions.filter((item, index, self) =>
    index === self.findIndex(t => t.path === item.path)
  );

  return uniqueSuggestions.slice(0, 3).sort((a, b) => b.confidence - a.confidence);
}

function generateIntelligentSuggestions(
    analysis: ReturnType<typeof analyzeContentWithContext>, 
    fileType: 'file' | 'folder', 
    context?: string,
    currentFileName?: string
) {
  const suggestions: Array<{filename: string, reasoning: string, confidence: number, category: 'descriptive' | 'conventional' | 'functional' | 'contextual'}> = [];
  const usedNames = new Set<string>();

  // Check if this is an empty file that needs better suggestions
  const isEmpty = !context || context.trim() === '';
  const hasNoFunctions = !analysis.mainFunctions || analysis.mainFunctions.length === 0;

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

  // Handle empty files with better suggestions
  if (hasNoFunctions && isEmpty) {
    if (fileType === 'file') {
      if (analysis.detectedLanguage === 'Text' || analysis.detectedLanguage === 'Markdown') {
        addSuggestion('notes', 'Simple name for a text file that might contain notes or documentation', 0.7, 'descriptive');
        addSuggestion('untitled', 'Conventional placeholder name for new or undefined files', 0.6, 'conventional');
        addSuggestion('draft', 'Suggests this file is a work in progress', 0.5, 'contextual');
      } else if (analysis.detectedLanguage.includes('JavaScript') || analysis.detectedLanguage.includes('TypeScript')) {
        addSuggestion('index', 'Common entry point file name', 0.8, 'conventional');
        addSuggestion('main', 'Standard name for primary application file', 0.7, 'conventional');
        addSuggestion('app', 'Typical name for application files', 0.6, 'descriptive');
      } else if (analysis.detectedLanguage === 'Python') {
        addSuggestion('main', 'Standard name for Python entry point', 0.8, 'conventional');
        addSuggestion('app', 'Common name for Python application files', 0.7, 'descriptive');
        addSuggestion('script', 'Generic name for Python scripts', 0.6, 'descriptive');
      } else {
        addSuggestion('main', 'Standard name for main files', 0.7, 'conventional');
        addSuggestion('index', 'Common entry point name', 0.6, 'conventional');
        addSuggestion('untitled', 'Placeholder name for new files', 0.5, 'conventional');
      }
    } else {
      addSuggestion('new-folder', 'Descriptive name for a new folder', 0.7, 'descriptive');
      addSuggestion('untitled-folder', 'Conventional placeholder for folders', 0.6, 'conventional');
      addSuggestion('workspace', 'General purpose workspace folder', 0.5, 'contextual');
    }
  } else {
    // Original logic for files with content
    if (analysis.mainFunctions.length > 0) {
      addSuggestion(analysis.mainFunctions[0], `Based on the primary entity: ${analysis.mainFunctions[0]}`, 0.9, 'functional');
    }
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
  
  // Ensure we have at least 3 suggestions - add fallbacks if needed
  if (suggestions.length < 3) {
    const fallbackSuggestions = fileType === 'file' 
      ? [
          { name: 'untitled', reason: 'Standard placeholder name', conf: 0.4, cat: 'conventional' as const },
          { name: 'new_file', reason: 'Generic name for new files', conf: 0.3, cat: 'descriptive' as const },
          { name: 'document', reason: 'General purpose file name', conf: 0.2, cat: 'descriptive' as const },
        ]
      : [
          { name: 'new-folder', reason: 'Standard name for new folders', conf: 0.4, cat: 'conventional' as const },
          { name: 'workspace', reason: 'General workspace folder', conf: 0.3, cat: 'contextual' as const },
          { name: 'untitled-folder', reason: 'Placeholder folder name', conf: 0.2, cat: 'conventional' as const },
        ];
    
    for (const fallback of fallbackSuggestions) {
      if (suggestions.length >= 3) break;
      addSuggestion(fallback.name, fallback.reason, fallback.conf, fallback.cat);
    }
  }

  return suggestions.slice(0, 3).sort((a, b) => b.confidence - a.confidence);
}

