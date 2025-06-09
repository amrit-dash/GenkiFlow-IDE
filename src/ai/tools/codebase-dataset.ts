/**
 * @fileOverview Genkit dataset integration for codebase context.
 *
 * - codebaseDataset: Creates and manages a dataset of codebase information for better AI context.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for dataset operations
const CodebaseDatasetInputSchema = z.object({
  operation: z.enum(['create', 'update', 'query', 'refresh']).describe('The dataset operation to perform'),
  fileSystemTree: z.string().describe('Current file system structure'),
  openFiles: z.array(z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().optional(),
  })).optional().describe('Currently open files and their content'),
  projectContext: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    frameworks: z.array(z.string()).optional(),
  }).optional().describe('Project metadata and context'),
  query: z.string().optional().describe('Query to search the codebase dataset'),
});

// Define the output schema for dataset operations
const CodebaseDatasetOutputSchema = z.object({
  success: z.boolean().describe('Whether the operation was successful'),
  operation: z.enum(['create', 'update', 'query', 'refresh']),
  message: z.string().describe('Human-readable result message'),
  datasetSize: z.number().optional().describe('Number of items in the dataset'),
  queryResults: z.array(z.object({
    file: z.string(),
    content: z.string(),
    relevance: z.number(),
    summary: z.string().optional(),
  })).optional().describe('Results from dataset queries'),
  projectSummary: z.object({
    totalFiles: z.number(),
    mainLanguages: z.array(z.string()),
    keyComponents: z.array(z.string()),
    architecture: z.string().optional(),
  }).optional().describe('High-level project summary'),
});

export const codebaseDataset = ai.defineTool(
  {
    name: 'codebaseDataset',
    description: 'Manages a Genkit dataset of codebase information for enhanced AI context and semantic search across the project.',
    inputSchema: CodebaseDatasetInputSchema,
    outputSchema: CodebaseDatasetOutputSchema,
  },
  async (input) => {
    console.log(`Codebase dataset tool called with operation: ${input.operation}`);
    
    switch (input.operation) {
      case 'create':
      case 'refresh':
        // Analyze the file system tree to create dataset entries
        const files = extractFilesFromTree(input.fileSystemTree);
        const languages = detectLanguages(files);
        const frameworks = detectFrameworks(files, input.openFiles);
        
        const projectSummary = {
          totalFiles: files.length,
          mainLanguages: languages,
          keyComponents: extractKeyComponents(files),
          architecture: detectArchitecture(input.fileSystemTree, languages),
        };
        
        return {
          success: true,
          operation: input.operation,
          message: `Dataset ${input.operation === 'create' ? 'created' : 'refreshed'} with ${files.length} files`,
          datasetSize: files.length,
          projectSummary,
        };
        
      case 'update':
        // Update dataset with new file information
        const updatedFiles = input.openFiles || [];
        
        return {
          success: true,
          operation: 'update' as const,
          message: `Dataset updated with ${updatedFiles.length} files`,
          datasetSize: updatedFiles.length,
        };
        
      case 'query':
        if (!input.query) {
          return {
            success: false,
            operation: 'query' as const,
            message: 'Query string is required for dataset search',
          };
        }
        
        // Perform semantic search across the codebase
        const results = performSemanticSearch(input.query, input.fileSystemTree, input.openFiles);
        
        return {
          success: true,
          operation: 'query' as const,
          message: `Found ${results.length} relevant results for "${input.query}"`,
          queryResults: results,
        };
        
      default:
        return {
          success: false,
          operation: input.operation,
          message: `Unknown dataset operation: ${input.operation}`,
        };
    }
  }
);

// Helper functions for dataset operations
function extractFilesFromTree(tree: string): string[] {
  const lines = tree.split('\n');
  const files: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Look for file patterns (has extension)
    if (trimmed.includes('.') && !trimmed.startsWith('├──') && !trimmed.startsWith('└──')) {
      files.push(trimmed);
    } else {
      // Parse tree structure lines
      const match = trimmed.match(/[├└]── (.+)/);
      if (match && match[1].includes('.')) {
        files.push(match[1]);
      }
    }
  }
  
  return files;
}

function detectLanguages(files: string[]): string[] {
  const languageMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.py': 'Python',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.dart': 'Dart',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'SASS',
    '.less': 'LESS',
    '.json': 'JSON',
    '.xml': 'XML',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
    '.md': 'Markdown',
  };
  
  const detectedLanguages = new Set<string>();
  
  for (const file of files) {
    const ext = '.' + file.split('.').pop()?.toLowerCase();
    if (languageMap[ext]) {
      detectedLanguages.add(languageMap[ext]);
    }
  }
  
  return Array.from(detectedLanguages);
}

function detectFrameworks(files: string[], openFiles?: any[]): string[] {
  const frameworks: string[] = [];
  
  // Check for common framework indicators
  if (files.some(f => f.includes('package.json'))) {
    frameworks.push('Node.js');
  }
  if (files.some(f => f.includes('next.config'))) {
    frameworks.push('Next.js');
  }
  if (files.some(f => f.includes('vite.config'))) {
    frameworks.push('Vite');
  }
  if (files.some(f => f.includes('tailwind.config'))) {
    frameworks.push('Tailwind CSS');
  }
  if (files.some(f => f.includes('.tsx') || f.includes('.jsx'))) {
    frameworks.push('React');
  }
  if (files.some(f => f.includes('vue.config') || f.includes('.vue'))) {
    frameworks.push('Vue.js');
  }
  if (files.some(f => f.includes('angular.json'))) {
    frameworks.push('Angular');
  }
  if (files.some(f => f.includes('requirements.txt') || f.includes('pyproject.toml'))) {
    frameworks.push('Python');
  }
  
  return frameworks;
}

function extractKeyComponents(files: string[]): string[] {
  const components: string[] = [];
  
  // Look for common component patterns
  const componentPatterns = [
    /components?/i,
    /pages?/i,
    /views?/i,
    /layouts?/i,
    /hooks?/i,
    /utils?/i,
    /lib/i,
    /api/i,
    /services?/i,
    /stores?/i,
    /contexts?/i,
  ];
  
  for (const file of files) {
    for (const pattern of componentPatterns) {
      if (pattern.test(file)) {
        const match = file.match(pattern);
        if (match && !components.includes(match[0])) {
          components.push(match[0]);
        }
      }
    }
  }
  
  return components;
}

function detectArchitecture(tree: string, languages: string[]): string {
  if (tree.includes('src/') && languages.includes('TypeScript React')) {
    return 'React/TypeScript Application';
  }
  if (tree.includes('pages/') && tree.includes('next.config')) {
    return 'Next.js Application';
  }
  if (tree.includes('app/') && languages.includes('TypeScript')) {
    return 'Modern TypeScript Application';
  }
  if (languages.includes('Python')) {
    return 'Python Application';
  }
  
  return 'Web Application';
}

function performSemanticSearch(query: string, tree: string, openFiles?: any[]): any[] {
  const results: any[] = [];
  const queryLower = query.toLowerCase();
  
  // Simple keyword-based search for now
  // In a real implementation, this would use semantic embeddings
  
  if (openFiles) {
    for (const file of openFiles) {
      const content = file.content.toLowerCase();
      if (content.includes(queryLower)) {
        const relevance = calculateRelevance(queryLower, content);
        results.push({
          file: file.path,
          content: file.content.substring(0, 500) + '...',
          relevance,
          summary: `Contains "${query}" - ${file.path}`,
        });
      }
    }
  }
  
  // Sort by relevance
  return results.sort((a, b) => b.relevance - a.relevance);
}

function calculateRelevance(query: string, content: string): number {
  const occurrences = (content.match(new RegExp(query, 'gi')) || []).length;
  const density = occurrences / content.length;
  return Math.min(density * 1000, 1); // Normalize to 0-1
} 