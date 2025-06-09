/**
 * @fileOverview Utility functions for generating file system tree representations.
 *
 * - generateFileSystemTree: Converts FileSystemNode[] to a tree string representation.
 */

import type { FileSystemNode } from '@/lib/types';

/**
 * Generates a tree string representation of the file system structure
 */
export function generateFileSystemTree(nodes: FileSystemNode[], prefix: string = '', isLast: boolean = true): string {
  let result = '';
  
  nodes.forEach((node, index) => {
    const isLastNode = index === nodes.length - 1;
    const connector = isLastNode ? '└── ' : '├── ';
    const nodePrefix = prefix + connector;
    
    // Add the current node
    result += nodePrefix + node.name;
    if (node.type === 'file' && node.content !== undefined) {
      // Include file size info for context
      const contentLength = node.content.length;
      const sizeInfo = contentLength > 0 ? ` (${contentLength} chars)` : ' (empty)';
      result += sizeInfo;
    }
    result += '\n';
    
    // Add children if it's a folder
    if (node.type === 'folder' && node.children && node.children.length > 0) {
      const childPrefix = prefix + (isLastNode ? '    ' : '│   ');
      result += generateFileSystemTree(node.children, childPrefix, isLastNode);
    }
  });
  
  return result;
}

/**
 * Generates a simplified tree structure focused on folders and key files
 */
export function generateSimplifiedFileSystemTree(nodes: FileSystemNode[], maxDepth: number = 3, currentDepth: number = 0): string {
  if (currentDepth >= maxDepth) return '';
  
  let result = '';
  const prefix = '  '.repeat(currentDepth);
  
  nodes.forEach(node => {
    if (node.type === 'folder') {
      result += `${prefix}📁 ${node.name}/\n`;
      if (node.children && node.children.length > 0) {
        result += generateSimplifiedFileSystemTree(node.children, maxDepth, currentDepth + 1);
      }
    } else {
      // Only include certain file types for simplicity
      const extension = node.name.split('.').pop()?.toLowerCase();
      const importantExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'md', 'json', 'yaml', 'yml', 'toml'];
      
      if (!extension || importantExtensions.includes(extension) || node.name.startsWith('.')) {
        const emoji = getFileEmoji(extension);
        result += `${prefix}${emoji} ${node.name}\n`;
      }
    }
  });
  
  return result;
}

/**
 * Get appropriate emoji for file type
 */
function getFileEmoji(extension?: string): string {
  if (!extension) return '📄';
  
  switch (extension.toLowerCase()) {
    case 'ts':
    case 'tsx':
      return '🔷';
    case 'js':
    case 'jsx':
      return '🟨';
    case 'py':
      return '🐍';
    case 'java':
      return '☕';
    case 'cpp':
    case 'c':
      return '⚙️';
    case 'go':
      return '🐹';
    case 'rs':
      return '🦀';
    case 'md':
      return '📝';
    case 'json':
      return '📋';
    case 'yaml':
    case 'yml':
      return '⚙️';
    case 'toml':
      return '🔧';
    case 'css':
      return '🎨';
    case 'html':
      return '🌐';
    case 'svg':
      return '🖼️';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return '🖼️';
    default:
      return '📄';
  }
}

/**
 * Analyzes file system structure and returns insights
 */
export function analyzeFileSystemStructure(nodes: FileSystemNode[]): {
  totalFiles: number;
  totalFolders: number;
  fileTypes: Record<string, number>;
  hasPackageJson: boolean;
  hasReadme: boolean;
  hasGitIgnore: boolean;
  hasSrcFolder: boolean;
  hasTestFolder: boolean;
  maxDepth: number;
} {
  let totalFiles = 0;
  let totalFolders = 0;
  const fileTypes: Record<string, number> = {};
  let hasPackageJson = false;
  let hasReadme = false;
  let hasGitIgnore = false;
  let hasSrcFolder = false;
  let hasTestFolder = false;
  let maxDepth = 0;
  
  function analyze(nodes: FileSystemNode[], depth: number = 0) {
    maxDepth = Math.max(maxDepth, depth);
    
    nodes.forEach(node => {
      if (node.type === 'file') {
        totalFiles++;
        const extension = node.name.split('.').pop()?.toLowerCase() || 'no-extension';
        fileTypes[extension] = (fileTypes[extension] || 0) + 1;
        
        // Check for specific files
        if (node.name === 'package.json') hasPackageJson = true;
        if (node.name.toLowerCase().includes('readme')) hasReadme = true;
        if (node.name === '.gitignore') hasGitIgnore = true;
      } else {
        totalFolders++;
        
        // Check for specific folders
        if (node.name === 'src') hasSrcFolder = true;
        if (node.name === 'test' || node.name === 'tests' || node.name === '__tests__') hasTestFolder = true;
        
        if (node.children) {
          analyze(node.children, depth + 1);
        }
      }
    });
  }
  
  analyze(nodes);
  
  return {
    totalFiles,
    totalFolders,
    fileTypes,
    hasPackageJson,
    hasReadme,
    hasGitIgnore,
    hasSrcFolder,
    hasTestFolder,
    maxDepth,
  };
} 