/**
 * @fileOverview Genkit dataset integration for codebase context using Google Gemini.
 *
 * - codebaseDataset: Creates and manages a dataset of codebase information for better AI context.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  indexCodebase,
  retrieveCode,
  codeIndexer,
} from './advanced-rag-system';

import { parseFileSystemTree } from './file-system-tree-generator';
import { extractCodeChunks } from './file-context-analyzer';
import type { FileInfo } from './types';

// Define the input schema for dataset operations
const CodebaseDatasetInputSchema = z.object({
  operation: z.enum(['create', 'update', 'query', 'refresh']).describe('The dataset operation to perform'),
  fileSystemTree: z.string().describe('Current file system structure'),
  openFiles: z.array(z.object({
    path: z.string(),
    content: z.string(),
    // Remove language property to match FileInfo
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

class DatasetError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'DatasetError';
  }
}

// Handle an error and return a standardized error response
function handleError(
  operation: z.infer<typeof CodebaseDatasetInputSchema>['operation'],
  error: unknown
): z.infer<typeof CodebaseDatasetOutputSchema> {
  console.error(`Error in ${operation} operation:`, error);
  
  const message = error instanceof Error ? error.message : 'Unknown error';
  
  return {
    success: false,
    operation,
    message: `Failed to ${operation} dataset: ${message}`,
  };
}

// Handle errors in async operations
async function handleAsync<T>(
  operation: z.infer<typeof CodebaseDatasetInputSchema>['operation'],
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new DatasetError(`Failed to ${operation} dataset`, err);
  }
}

async function handleCreate(
  input: z.infer<typeof CodebaseDatasetInputSchema>
): Promise<z.infer<typeof CodebaseDatasetOutputSchema>> {
  try {
    return await handleAsync('create', async () => {
      console.log('Creating codebase dataset with Gemini RAG...');
      
      // Parse file system tree
      const fileTree = parseFileSystemTree(input.fileSystemTree);
      
      // Process open files for indexing
      const openFiles = (input.openFiles || []) as FileInfo[];
      console.log(`Processing ${openFiles.length} open files for indexing`);
      
      // Extract code chunks using the enhanced analyzer
      const chunks = await extractCodeChunks(openFiles);
      console.log(`Extracted ${chunks.length} code chunks`);
      
      // Add additional chunks by analyzing each file individually with Gemini
      const additionalChunks = [];
      for (const file of openFiles) {
        try {
          const indexResult = await codeIndexer({
            fileContent: file.content,
            filePath: file.path,
            fileName: file.path.split('/').pop() || file.path,
            projectContext: input.projectContext?.description,
          });
          
          additionalChunks.push(...indexResult.chunks);
        } catch (error) {
          console.error(`Error indexing file ${file.path}:`, error);
        }
      }
      
      console.log(`Generated ${additionalChunks.length} additional chunks with Gemini`);
      
      // Combine all chunks
      const allChunks = [...chunks, ...additionalChunks];
      
      // Index the codebase using the Gemini RAG system
      const projectId = input.projectContext?.name || 'default-project';
      const indexResult = await indexCodebase(projectId, allChunks);
      
      console.log(`Successfully indexed project ${projectId} with ${allChunks.length} total chunks`);
      
      return {
        success: true,
        operation: 'create',
        message: `Created dataset with ${allChunks.length} code chunks using Gemini RAG`,
        datasetSize: allChunks.length,
        projectSummary: {
          totalFiles: fileTree.files.length,
          mainLanguages: input.projectContext?.languages || detectLanguages(fileTree.files),
          keyComponents: allChunks
            .filter(c => c.chunkType === 'component' || c.chunkType === 'class')
            .map(c => c.functionName || c.fileName)
            .filter((name): name is string => Boolean(name))
            .slice(0, 10), // Limit to top 10
          architecture: detectArchitecture(input.fileSystemTree, input.projectContext?.languages || []),
        },
      };
    });
  } catch (err) {
    return handleError('create', err);
  }
}

async function handleQuery(
  input: z.infer<typeof CodebaseDatasetInputSchema>
): Promise<z.infer<typeof CodebaseDatasetOutputSchema>> {
  if (!input.query) {
    return {
      success: false,
      operation: 'query',
      message: 'Query string is required',
    };
  }

  try {
    return await handleAsync('query', async () => {
      console.log(`Querying codebase with: "${input.query}"`);
      
      // Query the Gemini RAG system
      const projectId = input.projectContext?.name || 'default-project';
      const results = await retrieveCode(projectId, {
        query: input.query!, // We've already checked it's not undefined above
        queryType: 'semantic',
        maxResults: 10,
        contextWindow: 5,
        includeMetadata: true,
        filters: {},
      });

      console.log(`Found ${results.totalResults} relevant code chunks`);

      return {
        success: true,
        operation: 'query',
        message: `Found ${results.totalResults} relevant code chunks using Gemini semantic search`,
        queryResults: results.chunks.map(result => ({
          file: result.chunk.filePath,
          content: result.chunk.content.slice(0, 1000) + (result.chunk.content.length > 1000 ? '...' : ''),
          relevance: result.relevanceScore,
          summary: result.chunk.semanticSummary,
        })),
        datasetSize: results.totalResults,
      };
    });
  } catch (err) {
    return handleError('query', err);
  }
}

async function handleRefresh(
  input: z.infer<typeof CodebaseDatasetInputSchema>
): Promise<z.infer<typeof CodebaseDatasetOutputSchema>> {
  try {
    console.log('Refreshing codebase dataset...');
    return await handleCreate(input);
  } catch (err) {
    return handleError('refresh', err);
  }
}

async function handleUpdate(
  input: z.infer<typeof CodebaseDatasetInputSchema>
): Promise<z.infer<typeof CodebaseDatasetOutputSchema>> {
  if (!input.openFiles?.length) {
    return {
      success: false,
      operation: 'update',
      message: 'No files provided for update',
    };
  }

  try {
    return await handleAsync('update', async () => {
      console.log(`Updating dataset with ${input.openFiles?.length} files`);
      
      // Extract chunks from updated files
      const files = (input.openFiles || []) as FileInfo[];
      const chunks = await extractCodeChunks(files);
      
      // Also use Gemini to generate additional semantic chunks
      const additionalChunks = [];
      for (const file of files) {
        try {
          const indexResult = await codeIndexer({
            fileContent: file.content,
            filePath: file.path,
            fileName: file.path.split('/').pop() || file.path,
            projectContext: input.projectContext?.description,
          });
          
          additionalChunks.push(...indexResult.chunks);
        } catch (error) {
          console.error(`Error indexing file ${file.path}:`, error);
        }
      }
      
      const allChunks = [...chunks, ...additionalChunks];
      
      // Update the Gemini RAG index
      const projectId = input.projectContext?.name || 'default-project';
      await indexCodebase(projectId, allChunks);

      console.log(`Updated dataset with ${allChunks.length} total code chunks`);

      return {
        success: true,
        operation: 'update',
        message: `Updated dataset with ${allChunks.length} code chunks using Gemini RAG`,
        datasetSize: allChunks.length,
      };
    });
  } catch (err) {
    return handleError('update', err);
  }
}

// Main tool definition
export const codebaseDataset = ai.defineTool(
  {
    name: 'codebaseDataset',
    description: 'Manages a Genkit dataset of codebase information using Google Gemini for enhanced AI context and semantic search across the project.',
    inputSchema: CodebaseDatasetInputSchema,
    outputSchema: CodebaseDatasetOutputSchema,
  },
  async (input) => {
    console.log(`Codebase dataset tool called with operation: ${input.operation}`);
    
    try {
      switch (input.operation) {
        case 'create':
          return await handleCreate(input);
        case 'update':
          return await handleUpdate(input);
        case 'query':
          return await handleQuery(input);
        case 'refresh':
          return await handleRefresh(input);
        default:
          return {
            success: false,
            operation: input.operation,
            message: `Unsupported operation: ${input.operation}`,
          };
      }
    } catch (err) {
      return handleError(input.operation, err);
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

// Auto-indexing function for when files are opened
export async function autoIndexOpenFiles(
  fileSystemTree: string,
  openFiles: FileInfo[],
  projectContext?: {
    name?: string;
    description?: string;
    languages?: string[];
    frameworks?: string[];
  }
): Promise<{ success: boolean; message: string; chunksIndexed: number }> {
  try {
    console.log('Auto-indexing open files...');
    
    const result = await codebaseDataset({
      operation: 'create',
      fileSystemTree,
      openFiles: openFiles.map(f => ({ path: f.path, content: f.content })),
      projectContext,
    });
    
    return {
      success: result.success,
      message: result.message,
      chunksIndexed: result.datasetSize || 0,
    };
  } catch (error) {
    console.error('Auto-indexing failed:', error);
    return {
      success: false,
      message: `Auto-indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      chunksIndexed: 0,
    };
  }
}

// Export the auto-indexing function for use in other components
export { autoIndexOpenFiles as triggerAutoIndexing };