
import type { FileSystemNode, AiSuggestion, FileOperationSuggestion, AlternativeOption, CodeQuality, UsageAnalysisData, FileOperationExecutionData, TerminalCommandExecutionData, SmartCodePlacementData, FilenameSuggestionData, SmartFolderOperationData, ChatMessage as BaseChatMessage, ProgressData, ErrorValidationData } from '@/lib/types';
import type React from 'react'; // Added React import for RefObject

// Represents data passed from UI to useAIInteraction for attached items
export interface AttachedFileUIData {
  path: string;
  name: string;
  content: string; // For files: content. For folders: summary string.
  type: 'file' | 'folder';
  // Potentially other UI-specific data if needed
}

export interface UndoOperation {
  type: 'delete' | 'rename' | 'move' | 'create';
  data: any; // Store necessary data to reverse the operation
  timestamp: number;
  description: string; // User-facing description of what was done
}

export interface ConfirmationDialogData {
  isOpen: boolean;
  title: string;
  message: string;
  operation: () => void; // The function to call on confirm
  isDangerous?: boolean;
}

export type ChatMessage = BaseChatMessage; // Use the comprehensive type from lib/types


// Props for the main ChatMessageItem dispatcher component
export interface ChatMessageItemProps {
  msg: ChatMessage;
  isLoading: boolean;
  activeFilePath: string | null;
  currentCode: string | undefined; // Content of the active file
  openedFiles: Map<string, FileSystemNode>; // All currently opened files/tabs
  fileSystem: FileSystemNode[]; // The entire file system structure
  getFileSystemNode: (pathOrId: string) => FileSystemNode | FileSystemNode[] | undefined;
  handleCopyCode: (codeToCopy: string, messageIdPlusAction: string) => void;
  copiedStates: Record<string, boolean>;
  
  // Handlers from useOperationHandler (or similar)
  handleApplyToEditor: (codeToApply: string, buttonKey: string, targetPath?: string, insertionContext?: string, forceReplace?: boolean) => Promise<void>;
  handleCreateFileAndInsert: (suggestedFileName: string, code: string, buttonKey: string) => Promise<void>;
  handleFileOperationSuggestionAction: (
    operationType: 'create' | 'rename' | 'delete' | 'move',
    targetPath: string | undefined | null, // Made nullable to match FileOperationSuggestion
    newName: string | undefined | null,    // Made nullable
    fileType: 'file' | 'folder' | undefined,
    buttonKey: string,
    destinationPath?: string | undefined | null // Made nullable
  ) => Promise<void>;
  
  actionAppliedStates: Record<string, boolean>;
  loadingStates: Record<string, boolean>;
  
  undoStack: UndoOperation[];
  executeUndo: (operation: UndoOperation) => Promise<void>;
  setUndoStack: React.Dispatch<React.SetStateAction<UndoOperation[]>>;
  
  // Direct file operation execution (e.g., for rename/delete from filename suggestions)
  handleFileOperation: (
    operation: 'create' | 'delete' | 'rename' | 'move' | 'list',
    operationData: any // e.g., { targetPath, newName } for rename
  ) => Promise<{ success: boolean; message: string; } | undefined>;
  
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  
  // UI State handlers from useChatManager (or similar)
  toggleCodePreview: (msgId: string) => void;
  expandedCodePreviews: Record<string, boolean>;
  forceReplaceState: Record<string, boolean>;
  setForceReplaceState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

// Base props for individual message display components, inheriting ChatMessageItemProps
export interface BaseMessageDisplayProps extends ChatMessageItemProps {
  // msg is already in ChatMessageItemProps
}


// Specific props for ChatHistoryDisplay
export interface ChatHistoryDisplayProps extends ChatMessageItemProps {
  chatHistory: ChatMessage[];
  // isLoading: boolean; // Already in ChatMessageItemProps
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  // Empty state props
  setPromptForEmptyState: (value: string) => void;
  textareaRefForEmptyState: React.RefObject<HTMLTextAreaElement>;
  attachedFilesForEmptyState: AttachedFileUIData[]; // Use specific UI data type
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

export interface FileOperationDisplayProps extends BaseMessageDisplayProps { // For displaying results of client-executed operations
  msg: Extract<ChatMessage, { type: 'fileOperationExecution' }>;
}

export interface TerminalCommandDisplayProps extends BaseMessageDisplayProps { // For displaying results of client-executed commands
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
  buttonKey: string; // Key for managing unique state of this button
}

// Props for AIInteraction hook
export interface UseAIInteractionProps {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  attachedFiles: AttachedFileUIData[]; // Uses UI-specific attachment type
  // setAttachedFiles is not directly passed as attachments persist until user removes them
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  ideContext: IdeState;
  performFileOperation: (
    operation: 'create' | 'delete' | 'rename' | 'move' | 'list',
    operationData: any
  ) => Promise<{ success: boolean; message: string; } | undefined>;
  showConfirmationDialog: (
    title: string,
    message: string,
    operation: () => void,
    isDangerous?: boolean
  ) => void;
  setLoadingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setActionAppliedStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  addToUndoStack: (operation: UndoOperation) => void;
  setForceReplaceState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}
