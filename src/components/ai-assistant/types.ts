
import type { FileSystemNode, AiSuggestion, FileOperationSuggestion, AlternativeOption, CodeQuality, UsageAnalysisData, FileOperationExecutionData, TerminalCommandExecutionData, SmartCodePlacementData, FilenameSuggestionData, SmartFolderOperationData } from '@/lib/types';

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

// This type is specific to how filename suggestions are handled in the panel,
// potentially augmenting the one from lib/types if needed.
export interface FilenameSuggestionDataForPanel extends FilenameSuggestionData {
  // Add any panel-specific properties if needed
}

// Re-exporting ChatMessage from lib/types for convenience within this module if other types here depend on it.
// Or, if ChatMessage itself becomes more UI-specific, it could be defined here.
// For now, assuming it's mostly data structure from lib/types.
export type { ChatMessage } from '@/lib/types';

// Props for the ChatMessageItem component
export interface ChatMessageItemProps {
  msg: import('@/lib/types').ChatMessage; // Use full import path if ChatMessage remains in lib/types
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
  setChatHistory: React.Dispatch<React.SetStateAction<import('@/lib/types').ChatMessage[]>>;
  toggleCodePreview: (msgId: string) => void;
  expandedCodePreviews: Record<string, boolean>;
  forceReplaceState: Record<string, boolean>;
  setForceReplaceState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}
