# RAG System Implementation with Google Gemini

This document describes the Retrieval-Augmented Generation (RAG) system implemented in GenkiFlow IDE using Google Gemini AI.

## Overview

The RAG system enhances code generation by:
1. **Indexing** your codebase into semantic chunks
2. **Retrieving** relevant code examples during generation
3. **Augmenting** AI responses with contextual examples
4. **Improving** code consistency and quality

## Architecture

### Core Components

```
src/ai/tools/
├── advanced-rag-system.ts      # Main RAG implementation
├── codebase-dataset.ts         # Dataset management
├── file-context-analyzer.ts    # Code chunk extraction
└── types.ts                   # Type definitions
```

### Key Features

- **Google Gemini Integration**: Uses `googleai/text-embedding-004` for embeddings
- **Semantic Chunking**: Intelligent code analysis and segmentation
- **In-Memory Storage**: Fast development setup (extensible to persistent storage)
- **Auto-Indexing**: Automatic indexing when files are attached
- **Context-Aware Retrieval**: Finds relevant examples based on user queries

## Setup

### 1. Environment Configuration

Add your Google API key to `.env`:

```bash
GOOGLE_GENAI_API_KEY=your_google_api_key_here
```

### 2. Dependencies

All required dependencies are already included:
- `@genkit-ai/googleai` - Google AI integration
- `genkit` - Genkit framework

### 3. Verification

Test the system:

```bash
npx tsx test-rag-system.ts
```

## How It Works

### 1. Automatic Indexing

When you attach files or open them in the IDE, the system automatically:

```typescript
// Auto-triggered in useAIInteraction.ts
await triggerAutoIndexing(
  fileSystemTree,
  attachedFiles,
  {
    name: 'current-project',
    description: 'GenkiFlow IDE project',
    languages: ['TypeScript', 'JavaScript', 'React'],
  }
);
```

### 2. Code Chunking

Files are analyzed and split into semantic chunks:

```typescript
interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  language: string;
  chunkType: 'function' | 'class' | 'component' | 'interface' | ...;
  semanticSummary: string;
  keywords: string[];
  complexity: 'low' | 'medium' | 'high';
}
```

### 3. Embedding Generation

Each chunk gets embedded using Gemini:

```typescript
const embeddingResult = await embeddingGenerator({
  text: `${chunk.semanticSummary} ${chunk.content.slice(0, 500)}`,
});
```

### 4. Enhanced Code Generation

The AI flow automatically retrieves relevant examples:

```typescript
// In enhanced-code-generation.ts
// 1. Index current files
await codebaseDataset({ operation: 'create', ... });

// 2. Retrieve relevant examples
const examples = await codeRetriever({
  query: userPrompt,
  queryType: 'semantic',
  maxResults: 5,
});

// 3. Generate enhanced code using examples
```

## Usage Examples

### Example 1: Creating a React Component

**User**: "Create a button component with TypeScript"

**RAG Enhancement**:
1. System finds existing button components in codebase
2. Identifies TypeScript patterns and prop interfaces
3. Generates new component following existing conventions

### Example 2: Adding Utility Functions

**User**: "Add a debounce function"

**RAG Enhancement**:
1. Searches for existing utility functions
2. Matches coding style and patterns
3. Places function in appropriate utils file

### Example 3: State Management

**User**: "Create a custom hook for managing user data"

**RAG Enhancement**:
1. Finds existing custom hooks in codebase
2. Identifies state management patterns
3. Generates hook following project conventions

## API Reference

### Tools Available

#### `codebaseDataset`
Manages the RAG dataset:

```typescript
await codebaseDataset({
  operation: 'create' | 'update' | 'query' | 'refresh',
  fileSystemTree: string,
  openFiles: FileInfo[],
  projectContext: {
    name: string,
    description?: string,
    languages?: string[],
  },
  query?: string, // For query operations
});
```

#### `codeRetriever`
Retrieves relevant code chunks:

```typescript
await codeRetriever({
  query: string,
  queryType: 'semantic' | 'syntactic' | 'hybrid',
  maxResults: number,
  contextWindow: number,
  filters: {
    language?: string,
    chunkType?: string[],
    complexity?: 'low' | 'medium' | 'high',
  },
});
```

#### `codeIndexer`
Indexes individual files:

```typescript
await codeIndexer({
  fileContent: string,
  filePath: string,
  fileName: string,
  projectContext?: string,
});
```

### Integration Points

#### Auto-Indexing Hook

In `useAIInteraction.ts`, files are automatically indexed when attached:

```typescript
// Auto-index the codebase for RAG if there are files to index
if (attachedFilesDataForAI.length > 0) {
  await triggerAutoIndexing(fileSystemTree, attachedFiles, projectContext);
}
```

#### Enhanced Code Generation

In `enhanced-code-generation.ts`, RAG is integrated into the workflow:

```typescript
C. FOR ALL OTHER REQUESTS (Code Generation):
   1. Start with operationProgress
   2. **ACTIVATE RAG SYSTEM**: Index and retrieve examples
   3. Generate enhanced code using retrieved patterns
   4. Apply consistency with existing codebase
```

## Performance Considerations

### Memory Usage
- In-memory storage for development
- Configurable chunk limits (default: 20 chunks per query)
- Embedding caching for performance

### Optimization
- Lazy loading of embeddings
- Efficient similarity calculations
- Contextual filtering to reduce search space

## Extending the System

### Adding New Chunk Types

```typescript
// In advanced-rag-system.ts
type ChunkType = 'function' | 'class' | 'interface' | 'component' | 
                 'import' | 'config' | 'documentation' | 'test' |
                 'your-new-type'; // Add here
```

### Custom Embedding Models

```typescript
// In embeddingGenerator flow
const result = await ai.generate({
  model: 'googleai/your-custom-model', // Change model
  prompt: `Generate embedding for: ${input.text}`,
});
```

### Persistent Storage

Replace in-memory storage with database:

```typescript
// Replace these lines in advanced-rag-system.ts
const projectIndexes = new Map<string, ProjectIndex>();
const chunkEmbeddings = new Map<string, number[]>();

// With your preferred database implementation
```

## Troubleshooting

### Common Issues

1. **No API Key**
   ```bash
   Error: GOOGLE_GENAI_API_KEY not found
   ```
   Solution: Add `GOOGLE_GENAI_API_KEY=your_key` to `.env`

2. **No Results Found**
   ```
   No project index found, returning empty results
   ```
   Solution: Ensure files are attached or indexed first

3. **Indexing Failures**
   ```
   RAG auto-indexing failed
   ```
   Solution: Check file content and API connectivity

### Debug Mode

Enable detailed logging:

```typescript
// In advanced-rag-system.ts
console.log(`Indexing codebase for project: ${projectId}`);
console.log(`CodeRetriever called with query: ${input.query}`);
```

## Benefits

### For Developers
- **Consistent Code**: Follows existing patterns automatically
- **Faster Development**: Relevant examples provided instantly
- **Better Quality**: Learns from your best code practices
- **Context Awareness**: Understands your project structure

### For Teams
- **Standardization**: Enforces team coding conventions
- **Knowledge Sharing**: Spreads best practices across codebase
- **Onboarding**: New team members learn patterns quickly
- **Documentation**: Code examples serve as living documentation

## Roadmap

### Planned Features
- [ ] Persistent vector database integration
- [ ] Advanced similarity search algorithms
- [ ] Multi-language code translation
- [ ] Automated refactoring suggestions
- [ ] Code quality scoring
- [ ] Pattern detection and recommendations

### Performance Improvements
- [ ] Incremental indexing
- [ ] Background embedding generation
- [ ] Compression for large codebases
- [ ] Distributed processing

## Contributing

When contributing to the RAG system:

1. **Test Changes**: Run `npx tsx test-rag-system.ts`
2. **Update Documentation**: Reflect changes in this document
3. **Follow Patterns**: Use existing code structure and conventions
4. **Consider Performance**: Optimize for speed and memory usage

## Support

For issues with the RAG system:

1. Check this documentation
2. Review console logs for errors
3. Verify Google API key configuration
4. Test with the provided test script
5. Check Genkit configuration in `src/ai/genkit.ts` 