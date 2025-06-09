export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string; // For files: last saved content for fileSystem, live buffer for openedFiles
  children?: FileSystemNode[]; // For folders
  path: string;
  contentHistory?: string[]; // For file undo/redo (live buffer in openedFiles, saved state in fileSystem)
  historyIndex?: number;    // For file undo/redo (live buffer in openedFiles, saved state in fileSystem)
}

export interface AiSuggestion {
  description: string;
  proposedCode: string;
}

interface AttachedFileContext {
  path: string;
  content: string;
}

export interface GenerateCodeInput {
  prompt: string;
  currentFilePath?: string;
  currentFileContent?: string;
  attachedFiles?: AttachedFileContext[]; // Updated to array
}

export interface GenerateCodeOutput {
  code: string;
  isNewFile: boolean;
  suggestedFileName?: string;
  targetPath?: string; 
}


export interface FileOperationSuggestion {
  type: 'create' | 'rename' | 'delete' | 'none';
  reasoning: string;
  targetPath?: string;
  newName?: string;
  confidence: number;
}

export interface AlternativeOption {
  description: string;
  isNewFile: boolean;
  suggestedFileName?: string;
  targetPath?: string;
}

export interface CodeQuality {
  followsBestPractices: boolean;
  isTypeScriptCompatible: boolean;
  hasProperErrorHandling: boolean;
  isWellDocumented: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'generatedCode' | 'refactorSuggestion' | 'codeExamples' | 'error' | 'loading' | 'newFileSuggestion' | 'enhancedCodeGeneration' | 'fileOperationSuggestion' | 'progressUpdate' | 'errorValidation' | 'usageAnalysis';
  content: string; // For text, error messages, or descriptions
  code?: string; // For generatedCode, newFileSuggestion, enhancedCodeGeneration
  suggestion?: AiSuggestion; // For refactorSuggestion (singular)
  examples?: string[]; // For codeExamples
  suggestedFileName?: string; // For newFileSuggestion, enhancedCodeGeneration
  targetPath?: string; // For refactorSuggestion and generatedCode, to know which file it applies to
  explanation?: string; // For enhancedCodeGeneration
  fileOperationSuggestion?: FileOperationSuggestion; // For file operation suggestions
  alternativeOptions?: AlternativeOption[]; // For alternative placement options
  codeQuality?: CodeQuality; // For code quality assessment
  progressData?: ProgressData; // For progress updates
  errorValidationData?: ErrorValidationData; // For error validation results
  usageAnalysisData?: UsageAnalysisData; // For usage analysis results
}

export interface ProgressData {
  operation: string;
  stage: 'starting' | 'analyzing' | 'processing' | 'validating' | 'completing' | 'error';
  progress: number; // 0-100
  explanation: string;
  technicalDetails?: string;
  nextSteps?: string[];
  canCancel: boolean;
  requiresInput: boolean;
  suggestedActions?: string[];
  statusMessage: string;
  icon: 'loading' | 'success' | 'error' | 'warning' | 'info';
  estimatedCompletion?: string;
}

export interface ErrorValidationData {
  hasErrors: boolean;
  errors: {
    line?: number;
    column?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
  }[];
  suggestions?: {
    description: string;
    fixedCode: string;
    confidence: number;
  }[];
  codeQuality?: {
    score: number;
    issues: string[];
    improvements: string[];
  };
}

export interface UsageAnalysisData {
  symbolInfo: {
    name: string;
    type: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
    definition?: {
      filePath: string;
      line: number;
      code: string;
    };
  };
  usages: {
    filePath: string;
    line: number;
    context: string;
    usageType: 'call' | 'import' | 'instantiation' | 'reference' | 'assignment';
  }[];
  relatedSymbols?: {
    name: string;
    relationship: 'extends' | 'implements' | 'imports' | 'exports' | 'calls' | 'overrides';
    filePath: string;
  }[];
  summary: {
    totalUsages: number;
    filesWithUsages: number;
    mostUsedIn?: string;
    unusedFiles?: string[];
  };
}

export interface IdeState {
  fileSystem: FileSystemNode[];
  openedFiles: Map<string, FileSystemNode>; // path -> FileSystemNode (live editing buffer)
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  openFile: (filePath: string, nodeToOpen?: FileSystemNode) => void;
  closeFile: (filePath: string) => void;
  updateFileContent: (filePath: string, newContent: string) => void; // Updates live buffer in openedFiles
  saveFile: (filePath: string, contentToSave: string) => void;      // Saves content to fileSystem
  getFileSystemNode: (pathOrId: string) => FileSystemNode | FileSystemNode[] | undefined;
  addNode: (parentId: string | null, name: string, type: 'file' | 'folder', currentDirectoryPath?: string) => FileSystemNode | null;
  deleteNode: (nodeIdOrPath: string) => boolean;
  renameNode: (nodeId: string, newName: string) => boolean;
  moveNode: (draggedNodeId: string, targetParentFolderId: string | null) => void;
  replaceWorkspace: (newNodes: FileSystemNode[], newActiveFilePath?: string | null) => void;
  isBusy: boolean;
  nodeToAutoRenameId: string | null;
  setNodeToAutoRenameId: (id: string | null) => void;
  undoContentChange: (filePath: string) => void;
  redoContentChange: (filePath: string) => void;
}

// Add other shared types here
