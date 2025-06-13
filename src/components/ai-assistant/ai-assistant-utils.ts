
import type { FileSystemNode, CodeQuality } from '@/lib/types';

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

export const calculateCodeSimilarity = (text1: string, text2: string): number => {
  if (!text1 && !text2) return 1;
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (norm1 === norm2) return 1;

  const jaroSimilarity = (s1: string, s2: string): number => {
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    
    if (matchWindow < 0) return 0;
    
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0;
    
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
    
    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2, 4); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }
    
    return jaro + (0.1 * prefix * (1 - jaro));
  };

  const jaroSim = jaroSimilarity(norm1, norm2);
  const lengthSim = 1 - Math.abs(norm1.length - norm2.length) / Math.max(norm1.length, norm2.length);
  
  return Math.max(jaroSim * 0.8 + lengthSim * 0.2, jaroSim);
};

export const detectFileLanguage = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'TypeScript', 'tsx': 'TypeScript', 'js': 'JavaScript', 'jsx': 'JavaScript',
    'py': 'Python', 'cpp': 'C++', 'java': 'Java', 'html': 'HTML', 'css': 'CSS', 'md': 'Markdown', 'json': 'JSON'
  };
  return languageMap[ext || ''] || 'Unknown';
};

export const detectCodeType = (code: string, promptText: string): 'function' | 'component' | 'class' | 'interface' | 'utility' | 'service' | 'hook' | 'general' => {
  const lowerCode = code.toLowerCase();
  const lowerPrompt = promptText.toLowerCase();
  if (lowerPrompt.includes('component') || lowerCode.includes('react') || /<\w+.*?>/.test(code) && (lowerCode.includes('jsx') || lowerCode.includes('tsx'))) return 'component';
  if (lowerPrompt.includes('hook') || lowerCode.includes('use') && (lowerCode.includes('function') || lowerCode.includes('=>'))) return 'hook';
  if (lowerPrompt.includes('interface') || lowerCode.includes('interface ')) return 'interface';
  if (lowerPrompt.includes('class') || lowerCode.includes('class ')) return 'class';
  if (lowerPrompt.includes('util') || lowerPrompt.includes('helper')) return 'utility';
  if (lowerPrompt.includes('service') || lowerPrompt.includes('api')) return 'service';
  if (lowerCode.includes('function') || lowerCode.includes('=>') || lowerCode.includes('def ')) return 'function';
  return 'general';
};

export const extractCodeName = (code: string, codeType: string): string | undefined => {
  const functionMatch = code.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|let\s+(\w+)\s*=|var\s+(\w+)\s*=|def\s+(\w+)|class\s+(\w+))/);
  if (functionMatch) return functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4] || functionMatch[5] || functionMatch[6];
  if (codeType === 'component') {
    const componentNameMatch = code.match(/<(?:[A-Z]\w*)/); 
    if (componentNameMatch) return componentNameMatch[0].substring(1);
  }
  return undefined;
};

export const extractDependencies = (code: string): string[] => {
  const dependencies: string[] = [];
  const importMatches = code.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) dependencies.push(match[1]);
  if (code.includes('useState') || code.includes('useEffect')) dependencies.push('react');
  if (code.includes('axios')) dependencies.push('axios');
  return Array.from(new Set(dependencies)); 
};

export const detectMainLanguage = (code: string): string => {
  if (code.includes('import React') || code.includes('.tsx') || code.includes('.jsx')) return 'TypeScript'; 
  if (code.includes('def ') && code.includes(':') || code.includes('import ') && !code.includes('from')) return 'Python';
  if (code.includes('#include') || code.includes('std::')) return 'C++';
  if (code.includes('public class') || code.includes('System.out.println')) return 'Java';
  return 'JavaScript'; 
};

export const getDynamicCodeQuality = (codeQuality: CodeQuality, code: string) => {
  const language = detectMainLanguage(code);
  const functionCount = (code.match(/def |function |const .* = |class /g) || []).length;
  const getLanguageSpecific = () => {
    switch (language) {
      case 'Python': return { languageLabel: 'Pythonic', languageCheck: codeQuality.followsBestPractices && codeQuality.isWellDocumented, languageIcon: '🐍' };
      case 'TypeScript': return { languageLabel: 'TypeScript', languageCheck: codeQuality.isTypeScriptCompatible, languageIcon: '📘' };
      case 'JavaScript': return { languageLabel: 'Modern JS', languageCheck: codeQuality.followsBestPractices, languageIcon: '⚡' };
      default: return { languageLabel: 'Standards', languageCheck: codeQuality.followsBestPractices, languageIcon: '✨' };
    }
  };
  const languageSpecific = getLanguageSpecific();
  return {
    language, functionCount, languageSpecific,
    codeStandards: codeQuality.followsBestPractices && codeQuality.hasProperErrorHandling,
    complexity: codeQuality.estimatedComplexity,
    isWellRefactored: codeQuality.followsBestPractices && codeQuality.isWellDocumented,
  };
};

export const getDisplayName = (label: string): string => {
  const parts = label.split('/');
  return parts[parts.length - 1];
};

export const cleanFolderName = (name: string): string => {
  if (!name) return "NewFolder";
  let base = name.split('.')[0]; 
  base = base.replace(/[-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  if (!base) return "NewFolder"; 
  const cleaned = base.charAt(0).toUpperCase() + base.slice(1);
  return cleaned.replace(/\/$/, '');
};

export const generateFolderContext = (folderNode: FileSystemNode): string => {
  if (!folderNode.children) return `Folder: ${folderNode.name}\nPath: ${folderNode.path}\n(Empty folder)`;

  let context = `Folder: ${folderNode.name}\n`;
  context += `Path: ${folderNode.path}\n`;
  context += `Total direct items: ${folderNode.children.length}\n\n`;
  
  context += "Direct Children:\n";
  folderNode.children.slice(0, 10).forEach(child => { 
      context += `- ${child.name} (${child.type})\n`;
  });
  if (folderNode.children.length > 10) {
      context += `- ... and ${folderNode.children.length - 10} more items.\n`
  }
  
  return context;
};

export const isFullFileReplacement = (code: string): boolean => {
  const trimmed = code.trim();
  // A heuristic: if code starts with common top-level keywords, assume full replacement.
  // This could be refined further.
  return (
    trimmed.startsWith('#') || // Python comment / Shebang
    trimmed.startsWith('"""') || // Python docstring
    trimmed.startsWith("'''") || // Python docstring
    /^def |^class |^import |^from /m.test(trimmed) || // Python keywords at start of a line
    /^(async\s+)?function\s|^const\s|^let\s|^var\s|^import\s|^export\s|^class\s|^\/\//m.test(trimmed) || // JS/TS keywords
    trimmed.startsWith('<') // HTML/JSX like content
  );
};
