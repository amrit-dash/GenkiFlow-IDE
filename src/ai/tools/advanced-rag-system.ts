/**
 * @fileOverview Advanced RAG System - Genkit-powered indexers, retrievers, and evaluators
 * 
 * This system provides:
 * - Semantic code indexing with embeddings
 * - Intelligent code retrieval
 * - Context evaluation and ranking
 * - Project structure understanding
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChromaClient, Collection, QueryResult } from 'chromadb';
import { Document } from '@langchain/core/documents';
import { BaseRetriever } from '@langchain/core/retrievers';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatOpenAI } from '@langchain/openai';
import path from 'path';

type ChunkType = 'function' | 'class' | 'interface' | 'component' | 'import' | 'config' | 'documentation' | 'test';
type Complexity = 'low' | 'medium' | 'high';

// Initialize embeddings and ChromaDB client
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-ada-002',
  batchSize: 512,
});

const client = new ChromaClient();
let collection: Collection | null = null;

// Text splitter for chunking code
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Function to initialize the collection
async function initCollection(projectId: string) {
  if (!collection) {
    try {
      collection = await client.getOrCreateCollection({
        name: `genki-code-${projectId}`,
        metadata: { 
          'description': 'Code chunks for Genki IDE',
          'project': projectId,
        }
      });
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      throw error;
    }
  }
  return collection;
}

// Process and index code chunks
async function processCodeChunks(chunks: z.infer<typeof CodeChunkSchema>[]): Promise<Document[]> {
  const documents: Document[] = [];

  for (const chunk of chunks) {
    const doc = new Document({
      pageContent: chunk.content,
      metadata: {
        id: chunk.id,
        filePath: chunk.filePath,
        fileName: chunk.fileName,
        language: chunk.language,
        chunkType: chunk.chunkType,
        functionName: chunk.functionName,
        complexity: chunk.complexity,
        lineRange: `${chunk.lineRange.start}-${chunk.lineRange.end}`,
      },
    });
    documents.push(doc);
  }

  // Split documents into smaller chunks
  const splitDocs = await textSplitter.splitDocuments(documents);
  return splitDocs;
}

// Create custom retriever class
class ChromaDBRetriever extends BaseRetriever {
  private collection: Collection;
  private embeddings: OpenAIEmbeddings;
  
  constructor(collection: Collection, embeddings: OpenAIEmbeddings) {
    super();
    this.collection = collection;
    this.embeddings = embeddings;
  }

  get lc_namespace(): string[] {
    return ['genki', 'retrievers', 'chromadb'];
  }
  
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    // Get query embedding
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // Search the collection
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 10,
    });
    
    // Convert results to Documents, handling potential nulls
    return results.documents[0].map((content, i) => {
      if (!content) return null;
      return new Document({
        pageContent: content,
        metadata: results.metadatas?.[0]?.[i] || {},
      });
    }).filter((doc): doc is Document => doc !== null);
  }
}

// ===== INDEXER SCHEMAS =====

export const CodeChunkSchema = z.object({
  id: z.string().describe('Unique identifier for this code chunk'),
  filePath: z.string().describe('Path to the source file'),
  fileName: z.string().describe('Name of the source file'),
  content: z.string().describe('Raw code content'),
  language: z.string().describe('Programming language'),
  chunkType: z.enum(['function', 'class', 'interface', 'component', 'import', 'config', 'documentation', 'test']),
  functionName: z.string().optional().describe('Function or class name if applicable'),
  dependencies: z.array(z.string()).describe('Dependencies and imports'),
  semanticSummary: z.string().describe('Human-readable summary of what this code does'),
  keywords: z.array(z.string()).describe('Relevant keywords for searching'),
  complexity: z.enum(['low', 'medium', 'high']).describe('Code complexity level'),
  lastModified: z.string().describe('Last modification timestamp'),
  lineRange: z.object({
    start: z.number(),
    end: z.number(),
  }).describe('Line range in the source file'),
});

const ProjectIndexSchema = z.object({
  projectId: z.string().describe('Unique project identifier'),
  chunks: z.array(CodeChunkSchema).describe('All indexed code chunks'),
  fileStructure: z.record(z.string(), z.object({
    type: z.enum(['file', 'folder']),
    children: z.array(z.string()).optional(),
    language: z.string().optional(),
    purpose: z.string().optional(),
  })).describe('Project file structure mapping'),
  dependencies: z.record(z.string(), z.array(z.string())).describe('File dependency graph'),
  semanticClusters: z.array(z.object({
    clusterId: z.string(),
    theme: z.string(),
    chunks: z.array(z.string()),
    keywords: z.array(z.string()),
  })).describe('Semantic clusters of related code'),
  createdAt: z.string().describe('Index creation timestamp'),
  version: z.string().describe('Index version'),
});

// ===== RETRIEVER SCHEMAS =====

const RetrievalQuerySchema = z.object({
  query: z.string().describe('Natural language query or code snippet to search for'),
  queryType: z.enum(['semantic', 'syntactic', 'hybrid']).describe('Type of search to perform'),
  filters: z.object({
    language: z.string().optional(),
    fileType: z.array(z.string()).optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional(),
    chunkType: z.array(z.string()).optional(),
    excludeFiles: z.array(z.string()).optional(),
  }).optional().describe('Filters to apply to search results'),
  maxResults: z.number().default(10).describe('Maximum number of results to return'),
  contextWindow: z.number().default(5).describe('Number of surrounding chunks to include'),
  includeMetadata: z.boolean().default(true).describe('Whether to include metadata in results'),
});

const RetrievalResultSchema = z.object({
  chunks: z.array(z.object({
    chunk: CodeChunkSchema,
    relevanceScore: z.number().min(0).max(1),
    matchReason: z.string(),
    contextChunks: z.array(CodeChunkSchema).optional(),
  })).describe('Retrieved code chunks with relevance scores'),
  totalResults: z.number().describe('Total number of matching results'),
  searchMetadata: z.object({
    queryProcessingTime: z.number(),
    indexVersion: z.string(),
    appliedFilters: z.array(z.string()),
    semanticClusters: z.array(z.string()),
  }).describe('Search metadata and statistics'),
  suggestions: z.array(z.string()).describe('Related search suggestions'),
});

// ===== EVALUATOR SCHEMAS =====

const EvaluationCriteriaSchema = z.object({
  relevance: z.number().min(0).max(1).describe('How relevant is the result to the query'),
  accuracy: z.number().min(0).max(1).describe('How accurate is the code for the intended purpose'),
  completeness: z.number().min(0).max(1).describe('How complete is the code solution'),
  quality: z.number().min(0).max(1).describe('Code quality and best practices adherence'),
  usability: z.number().min(0).max(1).describe('How easy is it to use/integrate this code'),
});

const CodeEvaluationSchema = z.object({
  codeId: z.string().describe('Identifier for the evaluated code'),
  query: z.string().describe('Original query or requirement'),
  criteria: EvaluationCriteriaSchema,
  overallScore: z.number().min(0).max(1).describe('Overall evaluation score'),
  feedback: z.string().describe('Detailed feedback and recommendations'),
  improvements: z.array(z.string()).describe('Suggested improvements'),
  relatedCode: z.array(z.string()).describe('Related code chunks that might be helpful'),
});

// ===== TOOL DEFINITIONS =====

export type CodeChunk = z.infer<typeof CodeChunkSchema>;
export type ProjectIndex = z.infer<typeof ProjectIndexSchema>;
export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
export type CodeEvaluation = z.infer<typeof CodeEvaluationSchema>;

// ===== CODE INDEXER =====

const codeIndexerPrompt = ai.definePrompt({
  name: 'codeIndexerPrompt',
  input: {schema: z.object({
    fileContent: z.string(),
    filePath: z.string(),
    fileName: z.string(),
    projectContext: z.string().optional(),
  })},
  output: {schema: z.object({
    chunks: z.array(CodeChunkSchema),
    semanticSummary: z.string(),
    extractedKeywords: z.array(z.string()),
  })},
  prompt: `You are an expert code indexer that analyzes source code to create semantic chunks for efficient retrieval.

FILE TO INDEX:
Path: {{{filePath}}}
Name: {{{fileName}}}

CONTENT:
\`\`\`
{{{fileContent}}}
\`\`\`

{{#if projectContext}}
PROJECT CONTEXT:
{{{projectContext}}}
{{/if}}

INDEXING INSTRUCTIONS:

1. **Chunk Identification**: Break the code into logical chunks:
   - Functions/methods (with their complete implementation)
   - Classes (with all methods and properties)
   - Interfaces/types (complete definitions)
   - React components (complete component definition)
   - Import/export statements (grouped)
   - Configuration blocks
   - Documentation blocks
   - Test cases

2. **Semantic Analysis**: For each chunk:
   - Generate a clear, human-readable summary
   - Extract relevant keywords and concepts
   - Identify dependencies and relationships
   - Assess complexity level
   - Determine chunk type and purpose

3. **Context Extraction**: 
   - Identify what problem this code solves
   - Extract business logic and domain concepts
   - Note patterns and architectural decisions
   - Identify reusable components

4. **Keyword Generation**: Create searchable keywords including:
   - Function/class names
   - Domain concepts
   - Technical patterns
   - Use cases
   - Problem categories

QUALITY GUIDELINES:
- Each chunk should be self-contained and meaningful
- Summaries should be clear and descriptive
- Keywords should cover both technical and semantic aspects
- Avoid overly granular chunks (single statements)
- Include enough context for understanding

Output detailed chunks that enable efficient semantic search and code understanding.`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }
});

export const codeIndexer = ai.defineTool(
  {
    name: 'codeIndexer',
    description: 'Indexes source code files into semantic chunks for efficient retrieval and understanding.',
    inputSchema: z.object({
      fileContent: z.string(),
      filePath: z.string(),
      fileName: z.string(),
      projectContext: z.string().optional(),
    }),
    outputSchema: z.object({
      chunks: z.array(CodeChunkSchema),
      semanticSummary: z.string(),
      extractedKeywords: z.array(z.string()),
    }),
  },
  async (input) => {
    const result = await codeIndexerPrompt(input);
    return result.output!;
  }
);

// ===== CODE RETRIEVER =====

const codeRetrieverPrompt = ai.definePrompt({
  name: 'codeRetrieverPrompt',
  input: {schema: z.object({
    query: z.string(),
    availableChunks: z.array(CodeChunkSchema),
    queryType: z.enum(['semantic', 'syntactic', 'hybrid']),
    maxResults: z.number(),
  })},
  output: {schema: RetrievalResultSchema},
  prompt: `You are an expert code retriever that finds the most relevant code chunks for a given query.

QUERY: "{{{query}}}"
QUERY TYPE: {{{queryType}}}
MAX RESULTS: {{{maxResults}}}

AVAILABLE CODE CHUNKS:
{{#each availableChunks}}
---
ID: {{this.id}}
File: {{this.filePath}}
Type: {{this.chunkType}}
Function: {{this.functionName}}
Summary: {{this.semanticSummary}}
Keywords: {{this.keywords}}
Language: {{this.language}}
Complexity: {{this.complexity}}
Content Preview: {{this.content}}
---
{{/each}}

RETRIEVAL INSTRUCTIONS:

1. **Query Understanding**: Analyze the query to understand:
   - What the user is looking for
   - Technical requirements
   - Functional requirements
   - Context and use case

2. **Relevance Scoring**: For each chunk, consider:
   - **Semantic relevance** (0.4 weight): How well does the chunk's purpose match the query?
   - **Keyword matching** (0.3 weight): How many relevant keywords match?
   - **Code functionality** (0.2 weight): Does the code actually do what's requested?
   - **Quality and usability** (0.1 weight): Is this good, usable code?

3. **Search Strategy by Type**:
   - **Semantic**: Focus on meaning, purpose, and problem-solving approach
   - **Syntactic**: Focus on exact code patterns, function names, and structure
   - **Hybrid**: Combine both semantic understanding and syntactic matching

4. **Context Analysis**: Consider:
   - How chunks relate to each other
   - Dependencies between chunks
   - Complete solutions vs. partial implementations

5. **Result Ranking**: Order results by:
   - Relevance score (primary)
   - Code quality and completeness
   - Recency and maintenance status

MATCHING GUIDELINES:
- Prioritize exact functional matches over similar-looking code
- Consider the user's skill level and use case
- Include both direct matches and related/supporting code
- Provide clear reasons why each chunk was selected

Generate high-quality, relevant results that truly help the user accomplish their goal.`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }
});

export const codeRetriever = ai.defineTool(
  {
    name: 'codeRetriever',
    description: 'Retrieves the most relevant code chunks based on semantic or syntactic queries.',
    inputSchema: RetrievalQuerySchema,
    outputSchema: RetrievalResultSchema,
  },
  async (input) => {
    // This would typically interface with a vector database or search index
    // For now, we'll use the AI to perform intelligent matching
    const result = await codeRetrieverPrompt({
      query: input.query,
      availableChunks: [], // This would be populated from the project index
      queryType: input.queryType,
      maxResults: input.maxResults,
    });
    return result.output!;
  }
);

// ===== CODE EVALUATOR =====

const codeEvaluatorPrompt = ai.definePrompt({
  name: 'codeEvaluatorPrompt',
  input: {schema: z.object({
    query: z.string(),
    codeChunk: CodeChunkSchema,
    context: z.array(CodeChunkSchema).optional(),
  })},
  output: {schema: CodeEvaluationSchema},
  prompt: `You are an expert code evaluator that assesses how well code chunks meet specific requirements.

QUERY/REQUIREMENT: "{{{query}}}"

CODE TO EVALUATE:
File: {{codeChunk.filePath}}
Type: {{codeChunk.chunkType}}
Function: {{codeChunk.functionName}}
Language: {{codeChunk.language}}
Summary: {{codeChunk.semanticSummary}}

CODE CONTENT:
\`\`\`{{codeChunk.language}}
{{codeChunk.content}}
\`\`\`

{{#if context}}
RELATED CONTEXT:
{{#each context}}
- {{this.fileName}}: {{this.semanticSummary}}
{{/each}}
{{/if}}

EVALUATION CRITERIA:

1. **Relevance (0-1)**: How well does this code address the query?
   - Direct solution: 0.9-1.0
   - Partial solution: 0.6-0.8
   - Related but not direct: 0.3-0.5
   - Minimally related: 0.1-0.2
   - Not relevant: 0.0

2. **Accuracy (0-1)**: Is the code correct and functional?
   - No apparent bugs, follows best practices: 0.9-1.0
   - Minor issues or improvements needed: 0.7-0.8
   - Some bugs or logic errors: 0.5-0.6
   - Major issues: 0.2-0.4
   - Significantly flawed: 0.0-0.1

3. **Completeness (0-1)**: How complete is the solution?
   - Complete, ready-to-use solution: 0.9-1.0
   - Mostly complete, minor additions needed: 0.7-0.8
   - Partial implementation: 0.5-0.6
   - Basic structure only: 0.2-0.4
   - Incomplete fragment: 0.0-0.1

4. **Quality (0-1)**: Code quality assessment
   - Excellent: Clean, well-documented, follows conventions: 0.9-1.0
   - Good: Well-structured, readable: 0.7-0.8
   - Average: Functional but could be improved: 0.5-0.6
   - Poor: Hard to read or maintain: 0.2-0.4
   - Very poor: Major quality issues: 0.0-0.1

5. **Usability (0-1)**: How easy is it to use this code?
   - Drop-in ready, well-documented: 0.9-1.0
   - Easy to integrate with minor modifications: 0.7-0.8
   - Requires some work to integrate: 0.5-0.6
   - Significant modifications needed: 0.2-0.4
   - Difficult to use: 0.0-0.1

EVALUATION REQUIREMENTS:
- Provide honest, objective assessments
- Consider the specific query context
- Give actionable feedback and improvement suggestions
- Identify related code that might be helpful
- Calculate overall score as weighted average: relevance(40%) + accuracy(25%) + completeness(20%) + quality(10%) + usability(5%)

Focus on helping the user understand if this code meets their needs and how to improve it.`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }
});

export const codeEvaluator = ai.defineTool(
  {
    name: 'codeEvaluator',
    description: 'Evaluates code chunks against specific requirements and queries for relevance and quality.',
    inputSchema: z.object({
      query: z.string(),
      codeChunk: CodeChunkSchema,
      context: z.array(CodeChunkSchema).optional(),
    }),
    outputSchema: CodeEvaluationSchema,
  },
  async (input) => {
    const result = await codeEvaluatorPrompt(input);
    return result.output!;
  }
);

// ===== PROJECT ANALYZER =====

export const projectAnalyzer = ai.defineTool(
  {
    name: 'projectAnalyzer',
    description: 'Analyzes entire project structure to create comprehensive semantic understanding.',
    inputSchema: z.object({
      fileStructure: z.record(z.string(), z.any()),
      projectName: z.string(),
    }),
    outputSchema: ProjectIndexSchema,
  },
  async (input) => {
    // This would orchestrate the indexing of the entire project
    // For now, return a basic structure
    return {
      projectId: input.projectName,
      chunks: [],
      fileStructure: {},
      dependencies: {},
      semanticClusters: [],
      createdAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }
);

// Main indexing function
export async function indexCodebase(
  projectId: string,
  chunks: z.infer<typeof CodeChunkSchema>[]
): Promise<z.infer<typeof ProjectIndexSchema>> {
  const coll = await initCollection(projectId);
  const documents = await processCodeChunks(chunks);
  
  // Prepare data for ChromaDB
  const ids = documents.map((_, i) => `doc_${i}`);
  const embeddings_array = await Promise.all(
    documents.map(doc => embeddings.embedQuery(doc.pageContent))
  );
  const metadatas = documents.map(doc => doc.metadata);
  const documents_content = documents.map(doc => doc.pageContent);
  
  // Add documents to ChromaDB
  await coll.add({
    ids,
    embeddings: embeddings_array,
    metadatas,
    documents: documents_content,
  });

  // Create semantic clusters
  const clusters = await createSemanticClusters(coll, chunks);

  return {
    projectId,
    chunks,
    fileStructure: buildFileStructure(chunks),
    dependencies: extractDependencies(chunks),
    semanticClusters: clusters,
    createdAt: new Date().toISOString(),
    version: '1.0.0',
  };
}

// Main retrieval function
export async function retrieveCode(
  projectId: string,
  query: z.infer<typeof RetrievalQuerySchema>
): Promise<z.infer<typeof RetrievalResultSchema>> {
  const coll = await initCollection(projectId);
  const retriever = new ChromaDBRetriever(coll, embeddings);
  
  const startTime = Date.now();
  const retrievedDocs = await retriever.getRelevantDocuments(query.query);
  
  // Transform retrieved documents into required format
  const chunks = retrievedDocs.map(doc => ({
    chunk: {
      id: doc.metadata.id as string,
      filePath: doc.metadata.filePath as string,
      fileName: doc.metadata.fileName as string,
      content: doc.pageContent,
      language: doc.metadata.language as string,
      chunkType: doc.metadata.chunkType as ChunkType,
      functionName: doc.metadata.functionName as string | undefined,
      complexity: doc.metadata.complexity as Complexity,
      lineRange: { 
        start: parseInt((doc.metadata.lineRange as string).split('-')[0]),
        end: parseInt((doc.metadata.lineRange as string).split('-')[1]),
      },
      dependencies: doc.metadata.dependencies as string[] || [],
      semanticSummary: '', // Generate summary if needed
      keywords: doc.metadata.keywords as string[] || [],
      lastModified: doc.metadata.lastModified as string || new Date().toISOString(),
    },
    relevanceScore: 0.8, // Default score
    matchReason: `Relevant to query: ${query.query}`,
  }));

  const validChunks = chunks.filter(
    chunk => isValidChunk(chunk.chunk)
  );

  return {
    chunks: validChunks.slice(0, query.maxResults),
    totalResults: validChunks.length,
    searchMetadata: {
      queryProcessingTime: Date.now() - startTime,
      indexVersion: '1.0.0',
      appliedFilters: Object.entries(query.filters || {})
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}:${value}`),
      semanticClusters: [], // Fill from semantic cluster analysis
    },
    suggestions: [], // Generate related queries
  };
}

function isValidChunk(chunk: any): chunk is z.infer<typeof CodeChunkSchema> {
  return (
    typeof chunk.id === 'string' &&
    typeof chunk.filePath === 'string' &&
    typeof chunk.fileName === 'string' &&
    typeof chunk.content === 'string' &&
    typeof chunk.language === 'string' &&
    ['function', 'class', 'interface', 'component', 'import', 'config', 'documentation', 'test'].includes(chunk.chunkType) &&
    (chunk.functionName === undefined || typeof chunk.functionName === 'string') &&
    ['low', 'medium', 'high'].includes(chunk.complexity) &&
    Array.isArray(chunk.dependencies) &&
    typeof chunk.semanticSummary === 'string' &&
    Array.isArray(chunk.keywords) &&
    typeof chunk.lastModified === 'string'
  );
}

// Helper function to create semantic clusters
async function createSemanticClusters(
  collection: Collection,
  chunks: z.infer<typeof CodeChunkSchema>[]
) {
  // TODO: Implement k-means clustering using embeddings
  return [{
    clusterId: 'core-logic',
    theme: 'Core Business Logic',
    chunks: chunks.filter(c => c.chunkType === 'function').map(c => c.id),
    keywords: ['business', 'logic', 'core'],
  }];
}

// Helper function to build file structure
function buildFileStructure(chunks: z.infer<typeof CodeChunkSchema>[]) {
  const structure: Record<string, any> = {};
  for (const chunk of chunks) {
    const parts = chunk.filePath.split('/');
    let current = structure;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = {
          type: 'file',
          language: chunk.language,
        };
      } else {
        if (!current[part]) {
          current[part] = {
            type: 'folder',
            children: [],
          };
        }
        current = current[part].children;
      }
    }
  }
  return structure;
}

// Helper function to extract dependencies
function extractDependencies(chunks: z.infer<typeof CodeChunkSchema>[]) {
  const deps: Record<string, string[]> = {};
  for (const chunk of chunks) {
    deps[chunk.filePath] = chunk.dependencies;
  }
  return deps;
}