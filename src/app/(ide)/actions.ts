"use server";

import { 
  summarizeCodeSnippet, 
  type SummarizeCodeSnippetInput, 
  type SummarizeCodeSnippetOutput 
} from '@/ai/flows/summarize-code-snippet';
import { 
  generateCode, 
  type GenerateCodeInput, 
  type GenerateCodeOutput 
} from '@/ai/flows/generate-code-from-prompt';
import { 
  codeRefactoringSuggestions, 
  type CodeRefactoringSuggestionsInput, 
  type CodeRefactoringSuggestionsOutput 
} from '@/ai/flows/code-refactoring-suggestions';
import { 
  findCodebaseExamples, 
  type FindCodebaseExamplesInput, 
  type FindCodebaseExamplesOutput 
} from '@/ai/flows/find-codebase-examples';
import { 
  enhancedGenerateCode, 
  type EnhancedGenerateCodeInput, 
  type EnhancedGenerateCodeOutput 
} from '@/ai/flows/enhanced-code-generation';

function logDetailedError(actionName: string, error: any) {
  const timestamp = new Date().toISOString();
  console.error(`--- DETAILED SERVER ERROR in ${actionName} at ${timestamp} ---`);
  console.error("Raw Error Object:", error); 

  if (error instanceof Error) {
    console.error("Error Message:", error.message);
    if (error.stack) {
      console.error("Error Stack:", error.stack);
    }
    if ((error as any).rootCause) {
        console.error("Error Root Cause (Genkit?):", JSON.stringify((error as any).rootCause, null, 2));
    } else if (error.cause) {
      const cause = typeof (error as any).cause === 'function' ? (error as any).cause() : (error as any).cause;
      try {
        console.error("Error Cause:", JSON.stringify(cause, Object.getOwnPropertyNames(cause), 2));
      } catch (e) {
        console.error("Error Cause (could not stringify):", cause);
      }
    }
    if ((error as any).details) { 
        console.error("Error Details (Genkit?):", JSON.stringify((error as any).details, null, 2));
    }
  } else if (typeof error === 'object' && error !== null) {
    try {
        console.error("Error (object form):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
        console.error("Error (object form, could not stringify):", error);
    }
  } else {
    console.error("Error (primitive form):", error);
  }
  console.error(`--- END OF DETAILED SERVER ERROR in ${actionName} at ${timestamp} ---`);
}

// Updated to return only the base message for the client, detailed logging on server
function formatErrorForClient(baseMessage: string, error: any): string {
  logDetailedError("Client-facing error formatting", error); // Log detailed error on server
  // Check if the error has a message property that might be more specific (e.g., from Genkit validation)
  if (error && error.message && typeof error.message === 'string' && error.message.length < 200) { // Avoid overly long messages
    // Check if error message already contains known patterns we don't want to expose directly.
    if (error.message.includes("Model") && error.message.includes("not found")) {
        return baseMessage; // Keep it generic
    }
    // If it's a Zod validation error from Genkit, it might start with "Input validation failed"
    if (error.message.startsWith("Input validation failed") || error.message.startsWith("Output validation failed")) {
        // Could attempt to parse error.cause for Zod issues if client, but simple message is safer
        return `${baseMessage} There was an issue with the data format.`;
    }
    // For other relatively short messages, it might be safe to append.
    // return `${baseMessage} Details: ${error.message}`; // Potentially exposing too much
  }
  return baseMessage; // Default to simple base message
}

export async function summarizeCodeSnippetServer(input: SummarizeCodeSnippetInput): Promise<SummarizeCodeSnippetOutput> {
  try {
    return await summarizeCodeSnippet(input);
  } catch (error: any) {
    logDetailedError("summarizeCodeSnippetServer", error);
    throw new Error(formatErrorForClient("Failed to summarize. Check console.", error));
  }
}

export async function generateCodeServer(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  try {
    return await generateCode(input);
  } catch (error: any) {
    logDetailedError("generateCodeServer", error);
    throw new Error(formatErrorForClient("Failed to generate code. Check console.", error));
  }
}

export async function refactorCodeServer(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    return await codeRefactoringSuggestions(input);
  } catch (error: any) {
    logDetailedError("refactorCodeServer", error);
    throw new Error(formatErrorForClient("Failed to get refactoring suggestions. Check console.", error));
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    return await findCodebaseExamples(input);
  } catch (error: any) {
    logDetailedError("findExamplesServer", error);
    throw new Error(formatErrorForClient("Failed to find codebase examples. Check console.", error));
  }
}

export async function enhancedGenerateCodeServer(input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> {
  try {
    return await enhancedGenerateCode(input);
  } catch (error: any) {
    logDetailedError("enhancedGenerateCodeServer", error);
    throw new Error(formatErrorForClient("Failed to generate enhanced code. Check console.", error));
  }
}

// New server actions for enhanced AI tools
export async function validateCodeServer(input: { code: string; filePath: string; language?: string; projectContext?: string }) {
  try {
    const { errorValidation } = await import('@/ai/tools/error-validation');
    return await errorValidation({
      code: input.code,
      filePath: input.filePath,
      language: input.language,
      projectContext: input.projectContext,
    });
  } catch (error: any) {
    logDetailedError("validateCodeServer", error);
    throw new Error(formatErrorForClient("Failed to validate code. Check console.", error));
  }
}

export async function analyzeCodeUsageServer(input: { 
  symbolName: string; 
  searchScope?: 'workspace' | 'current-file' | 'directory';
  currentFilePath?: string;
  includeDefinitions?: boolean;
  includeReferences?: boolean;
  fileSystemTree?: string;
}) {
  try {
    const { codeUsageAnalysis } = await import('@/ai/tools/code-usage-analysis');
    return await codeUsageAnalysis({
      symbolName: input.symbolName,
      searchScope: input.searchScope,
      currentFilePath: input.currentFilePath,
      includeDefinitions: input.includeDefinitions,
      includeReferences: input.includeReferences,
      fileSystemTree: input.fileSystemTree,
    });
  } catch (error: any) {
    logDetailedError("analyzeCodeUsageServer", error);
    throw new Error(formatErrorForClient("Failed to analyze code usage. Check console.", error));
  }
}

export async function trackOperationProgressServer(input: {
  operation: string;
  stage: 'starting' | 'analyzing' | 'processing' | 'validating' | 'completing' | 'error';
  progress: number;
  details?: string;
  estimatedTimeRemaining?: number;
  context?: any;
}) {
  try {
    const { operationProgress } = await import('@/ai/tools/operation-progress');
    return await operationProgress({
      operation: input.operation,
      stage: input.stage,
      progress: input.progress,
      details: input.details,
      estimatedTimeRemaining: input.estimatedTimeRemaining,
      context: input.context,
    });
  } catch (error: any) {
    logDetailedError("trackOperationProgressServer", error);
    throw new Error(formatErrorForClient("Failed to track operation progress. Check console.", error));
  }
}

// File System Operations Server Actions
export async function executeFileSystemOperationServer(input: {
  operation: 'create' | 'delete' | 'rename' | 'move';
  targetPath?: string;
  newName?: string;
  destinationPath?: string;
  content?: string;
  fileType?: 'file' | 'folder';
  fileSystemTree: string;
}) {
  try {
    const { fileSystemOperations } = await import('@/ai/tools/file-system-operations');
    return await fileSystemOperations({
      operation: input.operation,
      currentFileSystemTree: input.fileSystemTree,
      targetPath: input.targetPath,
      newName: input.newName,
      destinationPath: input.destinationPath,
      content: input.content,
      fileType: input.fileType,
    });
  } catch (error: any) {
    logDetailedError("executeFileSystemOperationServer", error);
    throw new Error(formatErrorForClient("Failed to execute file system operation. Check console.", error));
  }
}

export async function executeFileSystemCommandServer(input: {
  operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
  targetPath?: string;
  newName?: string;
  destinationPath?: string;
  content?: string;
  fileType?: 'file' | 'folder';
  fileSystemTree: string;
}) {
  try {
    const { fileSystemExecutor } = await import('@/ai/tools/file-system-executor');
    return await fileSystemExecutor({
      operation: input.operation,
      targetPath: input.targetPath,
      newName: input.newName,
      destinationPath: input.destinationPath,
      content: input.content,
      fileType: input.fileType,
      currentFileSystemTree: input.fileSystemTree,
    });
  } catch (error: any) {
    logDetailedError("executeFileSystemCommandServer", error);
    throw new Error(formatErrorForClient("Failed to execute file system command. Check console.", error));
  }
}

export async function executeTerminalCommandServer(input: {
  command: string;
  context: string;
  requiresConfirmation?: boolean;
  isBackground?: boolean;
}) {
  try {
    const { terminalOperations } = await import('@/ai/tools/terminal-operations');
    return await terminalOperations({
      command: input.command,
      context: input.context,
      requiresConfirmation: input.requiresConfirmation ?? true,
      isBackground: input.isBackground ?? false,
    });
  } catch (error: any) {
    logDetailedError("executeTerminalCommandServer", error);
    throw new Error(formatErrorForClient("Failed to execute terminal command. Check console.", error));
  }
}

export async function manageCodebaseDatasetServer(input: {
  operation: 'create' | 'update' | 'query' | 'refresh';
  fileSystemTree: string;
  openFiles?: Array<{
    path: string;
    content: string;
    language?: string;
  }>;
  projectContext?: {
    name?: string;
    description?: string;
    dependencies?: string[];
    languages?: string[];
    frameworks?: string[];
  };
  query?: string;
}) {
  try {
    const { codebaseDataset } = await import('@/ai/tools/codebase-dataset');
    return await codebaseDataset({
      operation: input.operation,
      fileSystemTree: input.fileSystemTree,
      openFiles: input.openFiles,
      projectContext: input.projectContext,
      query: input.query,
    });
  } catch (error: any) {
    logDetailedError("manageCodebaseDatasetServer", error);
    throw new Error(formatErrorForClient("Failed to manage codebase dataset. Check console.", error));
  }
}

// Advanced Codebase Indexer with Smart Code Placement
export async function smartCodePlacementServer(input: {
  operation: 'index' | 'retrieve' | 'evaluate' | 'analyze';
  fileSystemTree: string;
  openFiles?: Array<{
    path: string;
    content: string;
    language?: string;
  }>;
  query?: {
    type: 'function' | 'component' | 'class' | 'interface' | 'utility' | 'service' | 'hook' | 'general';
    name?: string;
    description: string;
    language?: string;
    dependencies?: string[];
  };
  currentFilePath?: string;
  codeToAdd?: string;
}) {
  try {
    const { codebaseIndexer } = await import('@/ai/tools/codebase-indexer');
    return await codebaseIndexer({
      operation: input.operation,
      fileSystemTree: input.fileSystemTree,
      openFiles: input.openFiles,
      query: input.query,
      currentFilePath: input.currentFilePath,
      codeToAdd: input.codeToAdd,
    });
  } catch (error: any) {
    logDetailedError("smartCodePlacementServer", error);
    throw new Error(formatErrorForClient("Failed smart code placement. Check console.", error));
  }
}

// Enhanced File Operations that can actually execute operations
export async function executeActualFileOperationServer(input: {
  operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
  targetPath?: string;
  newName?: string;
  destinationPath?: string;
  content?: string;
  fileType?: 'file' | 'folder';
  fileSystemTree: string;
  confirmed?: boolean;
}) {
  try {
    // First get the suggestion/validation from our executor
    const { fileSystemExecutor } = await import('@/ai/tools/file-system-executor');
    const result = await fileSystemExecutor({
      operation: input.operation,
      targetPath: input.targetPath,
      newName: input.newName,
      destinationPath: input.destinationPath,
      content: input.content,
      fileType: input.fileType,
      currentFileSystemTree: input.fileSystemTree,
    });

    // Return the result with execution capability
    return {
      ...result,
      canExecute: result.success,
      readyForExecution: input.confirmed === true,
      executionInstructions: result.success ? {
        operation: input.operation,
        targetPath: input.targetPath,
        newName: input.newName,
        destinationPath: input.destinationPath,
        content: input.content,
        fileType: input.fileType,
      } : undefined,
    };
  } catch (error: any) {
    logDetailedError("executeActualFileOperationServer", error);
    throw new Error(formatErrorForClient("Failed to execute file operation. Check console.", error));
  }
}

// Enhanced Terminal Operations
export async function executeActualTerminalCommandServer(input: {
  command: string;
  context: string;
  requiresConfirmation?: boolean;
  isBackground?: boolean;
  confirmed?: boolean;
}) {
  try {
    const { terminalOperations } = await import('@/ai/tools/terminal-operations');
    const result = await terminalOperations({
      command: input.command,
      context: input.context,
      requiresConfirmation: input.requiresConfirmation ?? true,
      isBackground: input.isBackground ?? false,
    });

    // Return enhanced result with execution capability
    return {
      ...result,
      canExecute: true,
      readyForExecution: input.confirmed === true,
      supportedCommands: [
        'echo', 'clear', 'help', 'date', 'ls', 'cd', 'pwd', 'mkdir', 'touch', 'rm'
      ],
      executionInstructions: {
        command: input.command,
        context: input.context,
        isBackground: input.isBackground,
      }
    };
  } catch (error: any) {
    logDetailedError("executeActualTerminalCommandServer", error);
    throw new Error(formatErrorForClient("Failed to execute terminal command. Check console.", error));
  }
}

// AI-Powered Filename Suggestion
export async function suggestFilenameServer(input: {
  fileContent: string;
  currentFileName?: string;
  fileType: 'file' | 'folder'; // Added fileType here
  context?: string;
  projectStructure?: string;
}) {
  try {
    const { filenameSuggester } = await import('@/ai/tools/filename-suggester');
    const result = await filenameSuggester({
      fileContent: input.fileContent,
      currentFileName: input.currentFileName,
      fileType: input.fileType, // Pass fileType to the tool
      context: input.context,
      projectStructure: input.projectStructure,
    });
    
    let suggestions = result.suggestions;
    if (input.fileType === 'file') {
        // Ensure all suggestions use the original extension for files if provided
        let originalExt = '';
        if (input.currentFileName && input.currentFileName.includes('.')) {
          originalExt = '.' + input.currentFileName.split('.');
        } else if (result.analysis.suggestedExtension) { // Fallback to AI suggested extension
          originalExt = result.analysis.suggestedExtension;
        }

        if (originalExt) {
            suggestions = result.suggestions.map(s => {
                if (!s.filename.endsWith(originalExt)) {
                    const base = s.filename.replace(/\.[^.]+$/, '');
                    return { ...s, filename: base + originalExt };
                }
                return s;
            });
        }
    } else { // For folders, ensure no extensions and proper capitalization
        suggestions = result.suggestions.map(s => {
            let base = s.filename.split('.')[0];
            base = base.replace(/[-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
            return { ...s, filename: base.charAt(0).toUpperCase() + base.slice(1) };
        });
    }


    return {
      success: true,
      suggestions,
      analysis: result.analysis,
      topSuggestion: suggestions[0] || null,
      itemType: input.fileType, // Pass back the itemType for UI to handle
    };
  } catch (error: any) {
    logDetailedError("suggestFilenameServer", error);
    throw new Error(formatErrorForClient("Failed to generate filename suggestions. Check console.", error));
  }
}

// Smart Content Insertion
export async function smartContentInsertionServer(input: {
  existingContent: string;
  newContent: string;
  filePath: string;
  insertionContext: string;
}) {
  try {
    const { smartContentInsertion } = await import('@/ai/tools/smart-content-insertion');
    const result = await smartContentInsertion({
      existingContent: input.existingContent,
      newContent: input.newContent,
      filePath: input.filePath,
      insertionContext: input.insertionContext,
      preserveExisting: true,
    });

    return {
      success: result.success,
      mergedContent: result.mergedContent,
      insertionPoint: result.insertionPoint,
      insertionType: result.insertionType,
      reasoning: result.reasoning,
    };
  } catch (error: any) {
    logDetailedError("smartContentInsertionServer", error);
    throw new Error(formatErrorForClient("Failed smart content insertion. Check console.", error));
  }
}

// Intelligent Code Merger - Advanced content merging with AI analysis
export async function intelligentCodeMergerServer(input: {
  existingContent: string;
  generatedContent: string;
  fileName: string;
  fileExtension: string;
  userInstruction?: string;
  insertionContext?: string;
}) {
  try {
    const { intelligentCodeMerger } = await import('@/ai/tools/intelligent-code-merger');
    const result = await intelligentCodeMerger({
      existingContent: input.existingContent,
      generatedContent: input.generatedContent,
      fileName: input.fileName,
      fileExtension: input.fileExtension,
      userInstruction: input.userInstruction,
      insertionContext: input.insertionContext,
    });

    return {
      success: true,
      mergedContent: result.mergedContent,
      operations: result.operations,
      summary: result.summary,
      confidence: result.confidence,
      warnings: result.warnings || [],
      preservedSections: result.preservedSections || [],
    };
  } catch (error: any) {
    logDetailedError("intelligentCodeMergerServer", error);
    throw new Error(formatErrorForClient("Failed intelligent code merging. Check console.", error));
  }
}

// File Context Analyzer - Analyzes file content to understand purpose and suitability
export async function fileContextAnalyzerServer(input: {
  filePath: string;
  fileContent: string;
  fileName: string;
  fileExtension: string;
  projectContext?: string;
}) {
  try {
    const { fileContextAnalyzer } = await import('@/ai/tools/file-context-analyzer');
    const result = await fileContextAnalyzer({
      filePath: input.filePath,
      fileContent: input.fileContent,
      fileName: input.fileName,
      fileExtension: input.fileExtension,
      projectContext: input.projectContext,
    });

    return {
      success: true,
      analysis: result.analysis,
      contextScore: result.contextScore,
      tags: result.tags,
      recommendedForNewCode: result.recommendedForNewCode,
      reasoning: result.reasoning,
    };
  } catch (error: any) {
    logDetailedError("fileContextAnalyzerServer", error);
    throw new Error(formatErrorForClient("Failed to analyze file context. Check console.", error));
  }
}

// Smart Folder Operations - Intelligent folder operations with context awareness
export async function smartFolderOperationsServer(input: {
  operation: 'move' | 'rename' | 'delete' | 'analyze';
  targetPath: string;
  userInstruction: string;
  destinationHint?: string;
  fileSystemTree: string;
  folderContents?: Array<{
    path: string;
    name: string;
    type: 'file' | 'folder';
    language?: string;
    purpose?: string;
  }>;
}) {
  try {
    const { smartFolderOperations } = await import('@/ai/tools/smart-folder-operations');
    const result = await smartFolderOperations({
      operation: input.operation,
      targetPath: input.targetPath,
      userInstruction: input.userInstruction,
      destinationHint: input.destinationHint,
      fileSystemTree: input.fileSystemTree,
      folderContents: input.folderContents,
    });

    return {
      success: true,
      operation: result.operation,
      canExecuteDirectly: result.canExecuteDirectly,
      suggestions: result.suggestions,
      topSuggestion: result.topSuggestion,
      needsUserConfirmation: result.needsUserConfirmation,
      confirmationPrompt: result.confirmationPrompt,
      suggestedNewName: result.suggestedNewName,
      folderAnalysis: result.folderAnalysis,
      reasoning: result.reasoning,
      confidence: result.confidence,
    };
  } catch (error: any) {
    logDetailedError("smartFolderOperationsServer", error);
    throw new Error(formatErrorForClient("Failed smart folder operations. Check console.", error));
  }
}
