
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
  fileSystemTree?: string; // Added for contextual enrichment
  chatHistory?: Array<{role: 'user' | 'assistant', content: string}>; // Added for chat history
}

export interface GenerateCodeOutput {
  code: string;
  isNewFile: boolean;
  suggestedFileName?: string;
  targetPath?: string;
  explanation?: string; // Added for better explanations
  fileOperation?: { // Added for AI to suggest file operations
    type: 'create' | 'delete' | 'rename' | 'none';
    targetPath?: string; // e.g., parent directory for create, or file to delete/rename
    newName?: string; // For rename or suggested name for create
    fileType?: 'file' | 'folder'; // Added to specify type for creation
    reasoning?: string; // Why this operation is suggested
  };
}


export interface FileOperationSuggestion {
  type: 'create' | 'rename' | 'delete' | 'none' | 'move';
  reasoning: string;
  targetPath?: string;
  newName?: string;
  confidence: number;
  fileType?: 'file' | 'folder';
  destinationPath?: string;
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

export interface FileOperationExecutionData {
  operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
  success: boolean;
  targetPath?: string;
  newPath?: string;
  newName?: string;
  destinationPath?: string;
  content?: string;
  filesFound?: string[];
  message: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  executionTime?: number;
  fileType?: 'file' | 'folder';
}

export interface TerminalCommandExecutionData {
  command: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'unsupported';
  output?: string;
  error?: string;
  context: string;
  requiresConfirmation: boolean;
  isBackground: boolean;
  executionTime?: number;
  exitCode?: number;
  availableCommands?: string[];
}

export interface SmartCodePlacementData {
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
  currentActiveFile?: string;
  codeToAdd: string;
  codeType: 'function' | 'component' | 'class' | 'interface' | 'utility' | 'service' | 'hook' | 'general';
  analysis: {
    totalRelevantFiles: number;
    topSuggestion?: {
      filePath: string;
      fileName: string;
      confidence: number;
    };
  };
}

export interface SmartFolderOperationData {
  operation: 'move' | 'rename' | 'delete' | 'analyze';
  targetPath: string;
  canExecuteDirectly: boolean;
  suggestions: Array<{
    folderPath: string;
    folderName: string;
    confidence: number;
    reasoning: string;
    relevanceScore: number;
  }>;
  topSuggestion?: {
    folderPath: string;
    folderName: string;
    confidence: number;
    reasoning: string;
    relevanceScore: number;
  };
  needsUserConfirmation: boolean;
  confirmationPrompt?: string;
  suggestedNewName?: string;
  folderAnalysis?: {
    totalFiles: number;
    languages: string[];
    primaryPurpose: string;
    suggestedNames: string[];
    isWellOrganized: boolean;
  };
  reasoning: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'generatedCode' | 'refactorSuggestion' | 'codeExamples' | 'error' | 'loading' | 'newFileSuggestion' | 'enhancedCodeGeneration' | 'fileOperationSuggestion' | 'progressUpdate' | 'errorValidation' | 'usageAnalysis' | 'fileOperationExecution' | 'terminalCommandExecution' | 'smartCodePlacement' | 'filenameSuggestion' | 'smartFolderOperation';
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
  fileOperationData?: FileOperationExecutionData; // For actual file operations
  terminalCommandData?: TerminalCommandExecutionData; // For terminal command execution
  smartPlacementData?: SmartCodePlacementData; // For smart code placement suggestions
  filenameSuggestionData?: FilenameSuggestionData; // For AI-powered filename suggestions
  smartFolderOperationData?: SmartFolderOperationData; // For smart folder operations
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

export interface FilenameSuggestion {
  filename: string;
  reasoning: string;
  confidence: number;
  category: 'descriptive' | 'conventional' | 'functional' | 'contextual';
}

export interface FilenameAnalysis {
  detectedLanguage: string;
  codeType: string;
  mainFunctions: string[];
  hasExports: boolean;
  isComponent: boolean;
  suggestedExtension: string;
}

export interface FilenameSuggestionData {
  suggestions: FilenameSuggestion[];
  analysis: FilenameAnalysis;
  topSuggestion: FilenameSuggestion | null;
  currentFileName?: string;
  targetPath?: string;
  itemType?: 'file' | 'folder'; // Added to distinguish target item type
}

// Define the shape of the toast options based on useToast hook
interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement; // ToastActionElement
  variant?: "default" | "destructive";
  [key: string]: any; // Allow other props like duration, etc.
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
  accentColor: string; // HSL string, e.g., "270 70% 55%"
  setAccentColor: (color: string) => void;
  toast: (options: ToastOptions) => { id: string; dismiss: () => void; update: (props: ToastOptions) => void; }; // Added toast function
}

// Add other shared types here
