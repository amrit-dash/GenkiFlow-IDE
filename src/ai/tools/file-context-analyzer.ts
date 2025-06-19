/**
 * @fileOverview File Context Analyzer - Analyzes files to understand their purpose and context
 * 
 * This tool creates descriptions of files based on their content, helping the AI understand
 * what each file does and determine the best placement for new code.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { CodeChunkSchema } from './advanced-rag-system';
import path from 'path';
import type { FileInfo } from './types';

const FileContextAnalyzerInputSchema = z.object({
  filePath: z.string().describe('Path of the file to analyze'),
  fileContent: z.string().describe('Content of the file'),
  fileName: z.string().describe('Name of the file'),
  fileExtension: z.string().describe('File extension (e.g., .ts, .py, .md)'),
  projectContext: z.string().optional().describe('Overall project context'),
});

const FileContextAnalysisSchema = z.object({
  language: z.string().describe('Programming language or file type'),
  purpose: z.string().describe('Main purpose of this file'),
  description: z.string().describe('Detailed description of what this file contains'),
  mainFunctions: z.array(z.string()).describe('List of main functions/methods'),
  dependencies: z.array(z.string()).describe('Key dependencies or imports'),
  codeType: z.enum(['component', 'utility', 'service', 'config', 'test', 'documentation', 'data', 'style', 'other']).describe('Type of code this file contains'),
  complexity: z.enum(['low', 'medium', 'high']).describe('Code complexity level'),
  isEntryPoint: z.boolean().describe('Whether this is a main entry point file'),
  relatedConcepts: z.array(z.string()).describe('Related programming concepts or domains'),
});

const FileContextAnalyzerOutputSchema = z.object({
  analysis: FileContextAnalysisSchema,
  contextScore: z.number().min(0).max(1).describe('How well-defined the file context is'),
  tags: z.array(z.string()).describe('Searchable tags for this file'),
  recommendedForNewCode: z.boolean().describe('Whether this file is suitable for adding new code'),
  reasoning: z.string().describe('Explanation of the analysis'),
});

export type FileContextAnalyzerInput = z.infer<typeof FileContextAnalyzerInputSchema>;
export type FileContextAnalyzerOutput = z.infer<typeof FileContextAnalyzerOutputSchema>;

const fileContextAnalyzerPrompt = ai.definePrompt({
  name: 'fileContextAnalyzerPrompt',
  input: {schema: FileContextAnalyzerInputSchema},
  output: {schema: FileContextAnalyzerOutputSchema},
  prompt: `You are an expert code analyst that understands file purposes and contexts within software projects.

FILE TO ANALYZE:
Path: {{{filePath}}}
Name: {{{fileName}}}
Extension: {{{fileExtension}}}

CONTENT:
\`\`\`{{{fileExtension}}}
{{{fileContent}}}
\`\`\`

{{#if projectContext}}
PROJECT CONTEXT:
{{{projectContext}}}
{{/if}}

ANALYSIS INSTRUCTIONS:

1. **Language Detection**: Identify the programming language or file type (TypeScript, Python, JavaScript, Markdown, JSON, etc.)

2. **Purpose Analysis**: Determine the main purpose of this file:
   - What is this file trying to accomplish?
   - What role does it play in the project?
   - Is it a core component, utility, configuration, documentation, etc.?

3. **Content Analysis**: 
   - Extract main functions, classes, components, or sections
   - Identify key dependencies and imports
   - Understand the code patterns and architecture used
   - Assess complexity based on logic, nesting, and responsibilities

4. **Categorization**:
   - **Component**: React/Vue components, UI elements
   - **Utility**: Helper functions, shared utilities
   - **Service**: API calls, data services, business logic
   - **Config**: Configuration files, settings
   - **Test**: Test files, specs
   - **Documentation**: README, docs, comments
   - **Data**: JSON, CSV, data files
   - **Style**: CSS, SCSS, styling files
   - **Other**: Everything else

5. **Context Scoring**: Rate how well-defined and focused the file is:
   - 1.0: Very focused, single responsibility, clear purpose
   - 0.7-0.9: Mostly focused with some secondary responsibilities
   - 0.4-0.6: Mixed purposes but still coherent
   - 0.1-0.3: Unclear or overly broad responsibilities
   - 0.0: Cannot determine purpose

6. **New Code Suitability**: Determine if this file would be good for adding new code:
   - Consider file focus and single responsibility principle
   - Check if adding code would maintain file coherence
   - Consider file size and complexity

7. **Tagging**: Create searchable tags based on:
   - Functionality (auth, ui, api, math, validation, etc.)
   - Technology (react, express, pandas, etc.)
   - Domain (user-management, payments, analytics, etc.)

QUALITY INDICATORS:
- For **Python**: Look for PEP8 compliance, docstrings, type hints
- For **TypeScript/JavaScript**: Look for type safety, modern patterns, proper exports
- For **React**: Look for component patterns, hooks usage, prop types
- For **Documentation**: Look for completeness, structure, examples

OUTPUT REQUIREMENTS:
- Provide a clear, actionable analysis
- Make recommendations based on file purpose and structure
- Include specific reasoning for your assessments
- Create useful tags for search and matching

Focus on understanding the file's role in the broader codebase and its suitability for different types of code additions.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

export const fileContextAnalyzer = ai.defineTool(
  {
    name: 'fileContextAnalyzer',
    description: 'Analyzes file content to understand its purpose, context, and suitability for code placement. Creates searchable descriptions and metadata.',
    inputSchema: FileContextAnalyzerInputSchema,
    outputSchema: FileContextAnalyzerOutputSchema,
  },
  async (input) => {
    const result = await fileContextAnalyzerPrompt(input);
    return result.output!;
  }
);

/**
 * Extracts code chunks from files for analysis.
 */
export async function extractCodeChunks(files: FileInfo[]): Promise<z.infer<typeof CodeChunkSchema>[]> {
  const chunks: z.infer<typeof CodeChunkSchema>[] = [];
  let chunkId = 0;

  for (const file of files) {
    const language = inferLanguage(file.path);
    const fileChunks = await analyzeFile(file.content, {
      filePath: file.path,
      fileName: path.basename(file.path),
      language,
    });

    chunks.push(...fileChunks.map(chunk => ({
      ...chunk,
      id: `chunk_${chunkId++}`,
    })));
  }

  return chunks;
}

interface FileAnalysisOptions {
  filePath: string;
  fileName: string;
  language: string;
}

/**
 * Analyzes file content and splits it into logical chunks.
 */
async function analyzeFile(
  content: string,
  options: FileAnalysisOptions
): Promise<Omit<z.infer<typeof CodeChunkSchema>, 'id'>[]> {
  const chunks: Omit<z.infer<typeof CodeChunkSchema>, 'id'>[] = [];
  let currentChunk: {
    content: string[];
    start: number;
    type: z.infer<typeof CodeChunkSchema>['chunkType'];
    name?: string;
  } | null = null;

  // Split content into lines
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect chunk boundaries
    if (isChunkStart(line, options.language)) {
      if (currentChunk) {
        chunks.push(createChunk(currentChunk, options));
      }
      currentChunk = {
        content: [line],
        start: i + 1,
        type: detectChunkType(line, options.language),
        name: extractName(line, options.language),
      };
    } else if (currentChunk) {
      currentChunk.content.push(line);
    }
  }

  // Add the last chunk
  if (currentChunk) {
    chunks.push(createChunk(currentChunk, options));
  }

  return chunks;
}

function inferLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.go': 'go',
    '.cpp': 'cpp',
    '.c': 'c',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.php': 'php',
    '.cs': 'csharp',
  };
  return langMap[ext] || 'plain';
}

function isChunkStart(line: string, language: string): boolean {
  const patterns: Record<string, RegExp[]> = {
    javascript: [/^(export\s+)?(async\s+)?function\s+\w+/, /^(export\s+)?class\s+\w+/, /^interface\s+\w+/],
    typescript: [/^(export\s+)?(async\s+)?function\s+\w+/, /^(export\s+)?class\s+\w+/, /^(export\s+)?interface\s+\w+/],
    python: [/^def\s+\w+/, /^class\s+\w+/],
    java: [/^(public|private|protected)\s+(static\s+)?(class|interface)\s+\w+/, /^(public|private|protected)\s+(static\s+)?\w+\s+\w+\s*\(/],
  };

  const defaultPatterns = [/^function\s+\w+/, /^class\s+\w+/];
  const languagePatterns = patterns[language] || defaultPatterns;

  return languagePatterns.some(pattern => pattern.test(line.trim()));
}

function detectChunkType(
  line: string,
  language: string
): z.infer<typeof CodeChunkSchema>['chunkType'] {
  const trimmedLine = line.trim();

  if (trimmedLine.includes('class')) return 'class';
  if (trimmedLine.includes('interface')) return 'interface';
  if (trimmedLine.includes('function') || trimmedLine.includes('def ')) return 'function';
  if (trimmedLine.includes('test') || trimmedLine.includes('describe') || trimmedLine.includes('it(')) return 'test';
  if (trimmedLine.includes('import') || trimmedLine.includes('require')) return 'import';
  if (trimmedLine.startsWith('/*') || trimmedLine.startsWith('/**')) return 'documentation';
  
  return 'function';
}

function extractName(line: string, language: string): string | undefined {
  const patterns: Record<string, RegExp> = {
    javascript: /(?:function|class|interface)\s+(\w+)/,
    typescript: /(?:function|class|interface)\s+(\w+)/,
    python: /(?:def|class)\s+(\w+)/,
    java: /(?:class|interface)\s+(\w+)|\s+(\w+)\s*\(/,
  };

  const pattern = patterns[language] || /(?:function|class)\s+(\w+)/;
  const match = line.trim().match(pattern);
  return match ? match[1] || match[2] : undefined;
}

function createChunk(
  chunk: {
    content: string[];
    start: number;
    type: z.infer<typeof CodeChunkSchema>['chunkType'];
    name?: string;
  },
  options: FileAnalysisOptions
): Omit<z.infer<typeof CodeChunkSchema>, 'id'> {
  const content = chunk.content.join('\n');
  
  return {
    filePath: options.filePath,
    fileName: options.fileName,
    content,
    language: options.language,
    chunkType: chunk.type,
    functionName: chunk.name,
    dependencies: extractDependencies(content, options.language),
    semanticSummary: generateSummary(content, chunk.type),
    keywords: extractKeywords(content),
    complexity: calculateComplexity(content),
    lastModified: new Date().toISOString(),
    lineRange: {
      start: chunk.start,
      end: chunk.start + chunk.content.length,
    },
  };
}

function extractDependencies(content: string, language: string): string[] {
  const deps = new Set<string>();
  const lines = content.split('\n');

  const importPatterns: Record<string, RegExp[]> = {
    javascript: [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    ],
    typescript: [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    ],
    python: [
      /(?:from|import)\s+([^\s]+)/,
    ],
  };

  const patterns = importPatterns[language] || importPatterns.javascript;

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        deps.add(match[1]);
      }
    }
  }

  return Array.from(deps);
}

function generateSummary(content: string, type: string): string {
  // Basic summary generation
  const lines = content.trim().split('\n');
  const firstLine = lines[0].trim();
  return `${type}: ${firstLine.slice(0, 100)}...`;
}

function extractKeywords(content: string): string[] {
  const words = content
    .split(/[\s{}()[\]<>.,;=+\-*/&|!?:]+/)
    .filter(word => word.length > 2)
    .filter(word => !word.match(/^\d+$/));
  
  return Array.from(new Set(words)).slice(0, 10);
}

function calculateComplexity(
  content: string
): z.infer<typeof CodeChunkSchema>['complexity'] {
  // Basic complexity calculation
  const lines = content.split('\n').length;
  const branches = (content.match(/if|else|for|while|switch|catch/g) || []).length;
  const nested = (content.match(/{\s*{/g) || []).length;

  const score = lines + branches * 2 + nested * 3;

  if (score > 50) return 'high';
  if (score > 20) return 'medium';
  return 'low';
}