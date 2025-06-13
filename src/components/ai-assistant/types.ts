
import type { FileSystemNode, AiSuggestion, FileOperationSuggestion, AlternativeOption, CodeQuality, UsageAnalysisData, FileOperationExecutionData, TerminalCommandExecutionData, SmartCodePlacementData, FilenameSuggestionData, SmartFolderOperationData, ChatMessage as BaseChatMessage, ProgressData, ErrorValidationData } from '@/lib/types';

export interface AttachedFileUIData {
  path: string;
  name: string;
  content: string;
  type: 'file' | 'folder';
}

export interface UndoOperation {
  type: 'delete' | 'rename' | 'move' | 'create';
  data: any;
  timestamp: number;
  description: string;
}

export interface ConfirmationDialogData {
  isOpen: boolean;
  title: string;
  message: string;
  operation: () => void;
  isDangerous?: boolean;
}

// Re-exporting ChatMessage from lib/types for convenience within this module if other types here depend on it.
// Or, if ChatMessage itself becomes more UI-specific, it could be defined here.
// For now, assuming it's mostly data structure from lib/types.
export type ChatMessage = BaseChatMessage;


// Props for the main ChatMessageItem dispatcher component
export interface ChatMessageItemProps {
  msg: ChatMessage;
  isLoading: boolean;
  activeFilePath: string | null;
  currentCode: string | undefined;
  openedFiles: Map<string, FileSystemNode>;
  fileSystem: FileSystemNode[];
  getFileSystemNode: (pathOrId: string) => FileSystemNode | FileSystemNode[] | undefined;
  handleCopyCode: (codeToCopy: string, messageIdPlusAction: string) => void;
  copiedStates: Record<string, boolean>;
  handleApplyToEditor: (codeToApply: string, messageId: string, buttonKey: string, targetPath?: string, insertionContext?: string, forceReplace?: boolean) => Promise<void>;
  actionAppliedStates: Record<string, boolean>;
  loadingStates: Record<string, boolean>;
  handleCreateFileAndInsert: (suggestedFileName: string, code: string, messageId: string, buttonKey: string) => Promise<void>;
  handleFileOperationSuggestionAction: (
    operationType: 'create' | 'rename' | 'delete' | 'move',
    targetPath: string | undefined,
    newName: string | undefined,
    fileType: 'file' | 'folder' | undefined,
    buttonKey: string,
    destinationPath?: string
  ) => Promise<void>;
  undoStack: UndoOperation[];
  executeUndo: (operation: UndoOperation) => Promise<void>;
  setUndoStack: React.Dispatch<React.SetStateAction<UndoOperation[]>>;
  handleFileOperation: (operation: 'create' | 'delete' | 'rename' | 'move' | 'list', operationData: any) => Promise<{ success: boolean; message: string; } | undefined>;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  toggleCodePreview: (msgId: string) => void;
  expandedCodePreviews: Record<string, boolean>;
  forceReplaceState: Record<string, boolean>;
  setForceReplaceState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

// Base props for individual message display components
export interface BaseMessageDisplayProps extends Pick<ChatMessageItemProps,
  | 'isLoading'
  | 'activeFilePath'
  | 'getFileSystemNode'
  | 'handleCopyCode'
  | 'copiedStates'
  | 'handleApplyToEditor'
  | 'actionAppliedStates'
  | 'loadingStates'
  | 'handleCreateFileAndInsert'
  | 'handleFileOperationSuggestionAction'
  | 'undoStack'
  | 'executeUndo'
  | 'setUndoStack'
  | 'handleFileOperation'
  | 'setChatHistory'
  | 'toggleCodePreview'
  | 'expandedCodePreviews'
  | 'forceReplaceState'
  | 'setForceReplaceState'
> {
  msg: ChatMessage; // The specific message object
}

// Props for specific message types
export interface TextMessageDisplayProps extends Pick<BaseMessageDisplayProps, 'msg'> {}
export interface ErrorMessageDisplayProps extends Pick<BaseMessageDisplayProps, 'msg'> {}
export interface LoadingMessageDisplayProps extends Pick<BaseMessageDisplayProps, 'msg'> {}

export interface GeneratedCodeDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'generatedCode' | 'newFileSuggestion' | 'enhancedCodeGeneration' }>;
}

export interface RefactorSuggestionDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'refactorSuggestion' }>;
}

export interface CodeExamplesDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'codeExamples' }>;
}

export interface FileOperationDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'fileOperationExecution' }>;
}

export interface TerminalCommandDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'terminalCommandExecution' }>;
}

export interface SmartCodePlacementDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'smartCodePlacement' }>;
}

export interface FilenameSuggestionDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'filenameSuggestion' }>;
}

export interface SmartFolderOperationDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'smartFolderOperation' }>;
}

export interface ErrorValidationDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'errorValidation' }>;
}

export interface UsageAnalysisDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'usageAnalysis' }>;
}
export interface ProgressUpdateDisplayProps extends BaseMessageDisplayProps {
  msg: Extract<ChatMessage, { type: 'progressUpdate' }>;
}

export interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isApplied?: boolean;
  appliedText?: string;
  loadingText?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  title?: string;
  className?: string;
  buttonKey: string; // Unique key for this button instance for state management
}
