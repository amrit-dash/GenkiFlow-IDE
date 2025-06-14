
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

// This represents the data AI tools or flows might need about attached items
export interface AttachedFileContextForAI {
  path: string;
  content: string; // For files, this is file content. For folders, this is a summary string.
  // type: 'file' | 'folder'; // Type info is inherent in how content is structured/used
}

export interface GenerateCodeInput { // Main input for generateCode flow in generate-code-from-prompt.ts
  prompt: string;
  currentFilePath?: string;
  currentFileContent?: string;
  attachedFiles?: AttachedFileContextForAI[];
}

// Output from the simple generateCode flow
export interface GenerateCodeOutput {
  code: string;
  isNewFile: boolean;
  suggestedFileName?: string;
  targetPath?: string;
}


export interface FileOperationSuggestion {
  type: 'create' | 'rename' | 'delete' | 'none' | 'move';
  reasoning: string;
  targetPath?: string | null; // Nullable for consistency with EnhancedGenerateCodeOutputSchema
  newName?: string | null;    // Nullable
  confidence: number;
  fileType?: 'file' | 'folder';
  destinationPath?: string | null; // Nullable
}

export interface AlternativeOption {
  description: string;
  isNewFile: boolean;
  suggestedFileName?: string | null; // Nullable
  targetPath?: string | null;       // Nullable
}

export interface CodeQuality {
  followsBestPractices: boolean;
  isTypeScriptCompatible: boolean;
  hasProperErrorHandling: boolean;
  isWellDocumented: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
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

export interface FileOperationExecutionData { // Data for client-side execution result display
  operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
  success: boolean;
  targetPath?: string;
  newPath?: string;
  newName?: string;
  destinationPath?: string;
  content?: string;
  filesFound?: string[];
  message: string;
  requiresConfirmation: boolean; // This comes from fileSystemExecutor tool
  confirmationMessage?: string; // This comes from fileSystemExecutor tool
  executionTime?: number;
  fileType?: 'file' | 'folder';
}

export interface TerminalCommandExecutionData { // Data for client-side execution result display
  command: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'unsupported';
  output?: string;
  error?: string;
  context: string;
  requiresConfirmation?: boolean; // Default true from tool, can be overridden
  isBackground?: boolean;
  executionTime?: number;
  exitCode?: number;
  availableCommands?: string[];
  // Fields from executeActualTerminalCommandServer response
  canExecute?: boolean;
  readyForExecution?: boolean;
  supportedCommands?: string[];
  executionInstructions?: {
    command: string;
    context: string;
    isBackground?: boolean;
  };
}

export interface SmartCodePlacementData { // From codebaseIndexer tool
  suggestedFiles: Array<{
    filePath: string;
    fileName: string;
    reason: string;
    confidence: number;
    location: 'top' | 'bottom' | 'after-imports' | 'before-exports' | 'best-fit';
    contextMatch: {
      languageMatch: boolean;
      typeMatch: boolean;
      namePatternMatch: boolean;
      dependencyMatch: boolean;
      structureMatch: boolean;
    };
  }>;
  currentActiveFile?: string; // Path of the file active in editor when suggestion was made
  codeToAdd: string; // The code snippet that AI suggests placing
  codeType: 'function' | 'component' | 'class' | 'interface' | 'utility' | 'service' | 'hook' | 'general';
  analysis: {
    totalRelevantFiles?: number; // Made optional as tool might not always return it
    topSuggestion?: {
      filePath: string;
      fileName: string;
      confidence: number;
    };
  };
  suggestedFileName?: string; // For when the best placement is a new file
}

export interface SmartFolderOperationData { // From smartFolderOperations tool
  operation: 'move' | 'rename' | 'delete' | 'analyze';
  targetPath: string; // Path of the folder being operated on, or item to move
  canExecuteDirectly: boolean;
  suggestions: Array<{
    folderPath: string; // For move (destination), delete (target)
    folderName: string; // For rename (new name), move (destination name)
    confidence: number;
    reasoning: string;
    relevanceScore: number; // For move suggestions
  }>;
  topSuggestion?: { // Best suggestion
    folderPath: string;
    folderName: string;
    confidence: number;
    reasoning: string;
    relevanceScore: number;
  };
  needsUserConfirmation: boolean;
  confirmationPrompt?: string;
  suggestedNewName?: string; // For rename operations
  folderAnalysis?: { // For analyze operations or context for rename/delete
    totalFiles: number;
    languages: string[];
    primaryPurpose: string;
    suggestedNames: string[];
    isWellOrganized: boolean;
  };
  reasoning: string; // Overall reasoning from AI
  confidence: number; // Overall confidence
}

// This is the base ChatMessage type
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'generatedCode' | 'refactorSuggestion' | 'codeExamples' | 'error' | 'loading' | 'newFileSuggestion' | 'enhancedCodeGeneration' | 'fileOperationSuggestion' | 'progressUpdate' | 'errorValidation' | 'usageAnalysis' | 'fileOperationExecution' | 'terminalCommandExecution' | 'smartCodePlacement' | 'filenameSuggestion' | 'smartFolderOperation';
  content: string; // For text, error messages, or descriptions accompanying complex types
  code?: string | null; // For generatedCode, newFileSuggestion, enhancedCodeGeneration
  suggestion?: AiSuggestion | null; // For refactorSuggestion (singular)
  examples?: string[]; // For codeExamples
  suggestedFileName?: string | null; // For newFileSuggestion, enhancedCodeGeneration
  targetPath?: string | null; // For refactorSuggestion and generatedCode, to know which file it applies to
  explanation?: string | null; // For enhancedCodeGeneration and other complex types
  fileOperationSuggestion?: FileOperationSuggestion | null; // For file operation suggestions from enhancedCodeGeneration
  alternativeOptions?: AlternativeOption[] | null; // For alternative placement options
  codeQuality?: CodeQuality | null; // For code quality assessment
  progressData?: ProgressData | null; // For progress updates
  errorValidationData?: ErrorValidationData | null; // For error validation results
  usageAnalysisData?: UsageAnalysisData | null; // For usage analysis results
  fileOperationData?: FileOperationExecutionData | null; // For actual file operations (client-side execution results)
  terminalCommandData?: TerminalCommandExecutionData | null; // For terminal command execution (client-side execution results or tool response)
  smartPlacementData?: SmartCodePlacementData | null; // For smart code placement suggestions
  filenameSuggestionData?: FilenameSuggestionData | null; // For AI-powered filename suggestions
  smartFolderOperationData?: SmartFolderOperationData | null; // For smart folder operations
  isNewFile?: boolean | null; // From enhancedCodeGeneration specifically
}

export interface ProgressData { // From operationProgress tool
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

export interface ErrorValidationData { // From errorValidation tool
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

// Matches the output of the filenameSuggester tool / suggestFilenameServer action
export interface FilenameSuggestion {
  filename: string;
  reasoning: string;
  confidence: number;
  category: 'descriptive' | 'conventional' | 'functional' | 'contextual';
}

export interface FilenameAnalysis {
  detectedLanguage: string;
  codeType: string; // e.g., 'component', 'utility', 'service'
  mainFunctions: string[];
  hasExports: boolean;
  isComponent: boolean;
  suggestedExtension: string;
  currentFileNameForFiltering?: string; // Optional, from tool's analysis
}

export interface FilenameSuggestionData { // For ChatMessage.filenameSuggestionData
  suggestions: FilenameSuggestion[];
  analysis: FilenameAnalysis;
  topSuggestion: FilenameSuggestion | null;
  currentFileName?: string; // The name of the item being targeted
  targetPath?: string;      // The path of the item being targeted
  itemType?: 'file' | 'folder'; // Type of item being named
}


interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  variant?: "default" | "destructive";
  [key: string]: any;
}

export interface IdeState {
  fileSystem: FileSystemNode[];
  openedFiles: Map<string, FileSystemNode>;
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  openFile: (filePath: string, nodeToOpen?: FileSystemNode) => void;
  closeFile: (filePath: string) => void;
  updateFileContent: (filePath: string, newContent: string) => void;
  saveFile: (filePath: string, contentToSave: string) => void;
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
  accentColor: string;
  setAccentColor: (color: string) => void;
  toast: (options: ToastOptions) => { id: string; dismiss: () => void; update: (props: ToastOptions) => void; };
  analyzeFileSystemStructure: (nodes: FileSystemNode[]) => {
    totalFiles: number;
    totalFolders: number;
    fileTypes: Record<string, number>;
    hasPackageJson: boolean;
    hasReadme: boolean;
    hasGitIgnore: boolean;
    hasSrcFolder: boolean;
    hasTestFolder: boolean;
    maxDepth: number;
  };
}
