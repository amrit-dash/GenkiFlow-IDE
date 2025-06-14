
"use server";

import { 
  summarizeCodeSnippet, 
  type SummarizeCodeSnippetInput, 
  type SummarizeCodeSnippetOutput 
} from '@/ai/flows/summarize-code-snippet';
import { 
  generateCode, 
  // type GenerateCodeInput, // Not directly used by client if enhancedGenerateCode is primary
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
import type { AttachedFileUIData } from '@/components/ai-assistant/types'; // For context

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

function formatErrorForClient(baseMessage: string, error: any): string {
  logDetailedError("Client-facing error formatting", error); 
  if (error && error.message && typeof error.message === 'string' && error.message.length < 200) { 
    if (error.message.includes("Model") && error.message.includes("not found")) {
        return baseMessage; 
    }
    if (error.message.startsWith("Input validation failed") || error.message.startsWith("Output validation failed")) {
        return `${baseMessage} There was an issue with the data format.`;
    }
  }
  return baseMessage; 
}

// Define common context to be passed from client
interface ServerActionContext {
    currentFilePath?: string;
    currentFileContent?: string;
    attachedFilesDataForAI?: Array<{ path: string; content: string; }>; // Matches what useAIInteraction prepares
}

export async function summarizeCodeSnippetServer(
    input: Omit<SummarizeCodeSnippetInput, 'codeSnippet'> & ServerActionContext
): Promise<SummarizeCodeSnippetOutput> {
  try {
    let codeSnippet = "";
    if (input.attachedFilesDataForAI && input.attachedFilesDataForAI.length > 0) {
        codeSnippet = input.attachedFilesDataForAI[0].content;
    } else if (input.currentFileContent) {
        codeSnippet = input.currentFileContent;
    } else {
        throw new Error("No code content provided for summarization (either active file or attachment).");
    }
    return await summarizeCodeSnippet({ codeSnippet });
  } catch (error: any) {
    logDetailedError("summarizeCodeSnippetServer", error);
    throw new Error(formatErrorForClient("Failed to summarize. Please check console for details.", error));
  }
}

// generateCodeServer is kept for direct calls if needed, but enhancedGenerateCodeServer is primary for complex scenarios
export async function generateCodeServer(input: Parameters<typeof generateCode>[0]): Promise<GenerateCodeOutput> {
  try {
    return await generateCode(input);
  } catch (error: any) {
    logDetailedError("generateCodeServer", error);
    throw new Error(formatErrorForClient("Failed to generate code. Please check console for details.", error));
  }
}

export async function refactorCodeServer(
    input: Omit<CodeRefactoringSuggestionsInput, 'codeSnippet' | 'fileContext'> & ServerActionContext
): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    let codeSnippet = "";
    let fileContext = "No specific file context provided.";

    if (input.attachedFilesDataForAI && input.attachedFilesDataForAI.length > 0) {
        codeSnippet = input.attachedFilesDataForAI[0].content;
        fileContext = `File: ${input.attachedFilesDataForAI[0].path.split('/').pop() || input.attachedFilesDataForAI[0].path}`;
    } else if (input.currentFileContent && input.currentFilePath) {
        codeSnippet = input.currentFileContent;
        fileContext = `File: ${input.currentFilePath.split('/').pop() || input.currentFilePath}`;
    } else {
         throw new Error("No code content provided for refactoring (either active file or attachment).");
    }
    return await codeRefactoringSuggestions({ codeSnippet, fileContext });
  } catch (error: any) {
    logDetailedError("refactorCodeServer", error);
    throw new Error(formatErrorForClient("Failed to get refactoring suggestions. Please check console for details.", error));
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    // This flow uses the codebaseSearch tool, which implicitly searches the whole codebase.
    // No specific file/attachment context needed here unless the tool itself is modified.
    return await findCodebaseExamples(input);
  } catch (error: any) {
    logDetailedError("findExamplesServer", error);
    throw new Error(formatErrorForClient("Failed to find codebase examples. Please check console for details.", error));
  }
}

export async function enhancedGenerateCodeServer(input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> {
  try {
    return await enhancedGenerateCode(input);
  } catch (error: any) {
    logDetailedError("enhancedGenerateCodeServer", error);
    throw new Error(formatErrorForClient("Failed to generate enhanced code. Please check console for details.", error));
  }
}

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
    throw new Error(formatErrorForClient("Failed to validate code. Please check console for details.", error));
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
    throw new Error(formatErrorForClient("Failed to analyze code usage. Please check console for details.", error));
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
    throw new Error(formatErrorForClient("Failed to track operation progress. Please check console for details.", error));
  }
}

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
    // This tool is for *suggesting* operations, the actual execution is client-side via useIde
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
    throw new Error(formatErrorForClient("Failed to get file system operation suggestion. Please check console for details.", error));
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
    // This tool *simulates* execution and returns whether confirmation is needed.
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
    throw new Error(formatErrorForClient("Failed to simulate file system command. Please check console for details.", error));
  }
}

export async function executeActualTerminalCommandServer(input: {
  command: string;
  context: string;
  requiresConfirmation?: boolean;
  isBackground?: boolean;
  confirmed?: boolean; // Added for consistency, though tool itself handles confirmation state
}) {
  try {
    const { terminalOperations } = await import('@/ai/tools/terminal-operations');
    const result = await terminalOperations({
      command: input.command,
      context: input.context,
      requiresConfirmation: input.requiresConfirmation ?? true,
      isBackground: input.isBackground ?? false,
    });

    return {
      ...result,
      // Client side will handle actual execution based on 'pending' status and user confirmation
      canExecute: result.status !== 'unsupported', // If not unsupported, client can proceed with confirmation
      readyForExecution: input.confirmed === true && result.status === 'pending',
      supportedCommands: [ // This list is from the tool itself
        'echo', 'clear', 'help', 'date', 'ls', 'cd', 'pwd', 'mkdir', 'touch', 'rm', 'cat'
      ],
      executionInstructions: result.status === 'pending' ? { // Only provide if pending confirmation
        command: input.command,
        context: input.context,
        isBackground: input.isBackground,
      } : undefined
    };
  } catch (error: any) {
    logDetailedError("executeActualTerminalCommandServer", error);
    throw new Error(formatErrorForClient("Failed to process terminal command. Please check console for details.", error));
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
    throw new Error(formatErrorForClient("Failed to manage codebase dataset. Please check console for details.", error));
  }
}

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
    throw new Error(formatErrorForClient("Failed smart code placement. Please check console for details.", error));
  }
}

// This action is kept for potential direct use if AI determines a confirmed operation
export async function executeActualFileOperationServer(input: {
  operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
  targetPath?: string;
  newName?: string;
  destinationPath?: string;
  content?: string;
  fileType?: 'file' | 'folder';
  fileSystemTree: string;
  confirmed?: boolean; // If true, implies AI has already confirmed or it's a direct command
}) {
  try {
    const { fileSystemExecutor } = await import('@/ai/tools/file-system-executor');
    // This tool simulates execution and checks if confirmation is needed.
    // The actual file operation is done client-side by performFileOperation in useOperationHandler.
    const result = await fileSystemExecutor({
      operation: input.operation,
      targetPath: input.targetPath,
      newName: input.newName,
      destinationPath: input.destinationPath,
      content: input.content,
      fileType: input.fileType,
      currentFileSystemTree: input.fileSystemTree,
    });

    // This action now returns the *simulated* result. The client decides if/how to proceed.
    return {
      ...result,
      canExecute: result.success, // Indicates if the operation *can* be executed
      readyForExecution: input.confirmed === true && result.success && !result.requiresUserConfirmation,
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
    throw new Error(formatErrorForClient("Failed to process file operation request. Please check console for details.", error));
  }
}


export async function suggestFilenameServer(input: {
  fileContent: string;
  currentFileName?: string;
  fileType: 'file' | 'folder'; 
  context?: string;
  projectStructure?: string;
  // No ServerActionContext needed as this function's input is already specific
}) {
  try {
    const { filenameSuggester } = await import('@/ai/tools/filename-suggester');
    const result = await filenameSuggester({
      fileContent: input.fileContent,
      currentFileName: input.currentFileName,
      fileType: input.fileType, 
      context: input.context,
      projectStructure: input.projectStructure,
    });
        
    return {
      success: true,
      suggestions: result.suggestions,
      analysis: result.analysis,
      topSuggestion: result.suggestions[0] || null,
      // currentFileName: input.currentFileName, // Pass through for client
      // targetPath: input.currentFilePath, // This is tricky; the file content might be from anywhere
      itemType: input.fileType, 
    };
  } catch (error: any) {
    logDetailedError("suggestFilenameServer", error);
    throw new Error(formatErrorForClient("Failed to generate filename suggestions. Please check console for details.", error));
  }
}

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
    throw new Error(formatErrorForClient("Failed smart content insertion. Please check console for details.", error));
  }
}

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
    throw new Error(formatErrorForClient("Failed intelligent code merging. Please check console for details.", error));
  }
}

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
    throw new Error(formatErrorForClient("Failed to analyze file context. Please check console for details.", error));
  }
}

export async function smartFolderOperationsServer(input: {
  operation: 'move' | 'rename' | 'delete' | 'analyze';
  targetPath: string; // Path of the folder being operated on, or item to move
  userInstruction: string;
  destinationHint?: string; // For move operations
  fileSystemTree: string;
  folderContents?: Array<{ // Context for the target folder (if renaming/analyzing) or item being moved
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
      success: true, // Assuming tool itself doesn't throw for operational errors, but reports them
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
    throw new Error(formatErrorForClient("Failed smart folder operations. Please check console for details.", error));
  }
}
