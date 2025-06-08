
export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileSystemNode[];
  path: string;
}

export interface AiSuggestion {
  description: string;
  proposedCode: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'generatedCode' | 'refactorSuggestion' | 'codeExamples' | 'error' | 'loading' | 'newFileSuggestion';
  content: string; // For text, error messages, or descriptions
  code?: string; // For generatedCode, newFileSuggestion
  suggestion?: AiSuggestion; // For refactorSuggestion (singular)
  examples?: string[]; // For codeExamples
  suggestedFileName?: string; // For newFileSuggestion
}

export interface IdeState {
  fileSystem: FileSystemNode[];
  openedFiles: Map<string, FileSystemNode>; // path -> FileSystemNode
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  openFile: (filePath: string, nodeToOpen?: FileSystemNode) => void;
  closeFile: (filePath: string) => void;
  updateFileContent: (filePath: string, newContent: string) => void;
  getFileSystemNode: (pathOrId: string) => FileSystemNode | FileSystemNode[] | undefined;
  addNode: (parentId: string | null, name: string, type: 'file' | 'folder', currentDirectoryPath?: string) => FileSystemNode | null;
  deleteNode: (nodeIdOrPath: string) => boolean;
  renameNode: (nodeId: string, newName: string) => boolean;
  moveNode: (draggedNodeId: string, targetParentFolderId: string | null) => void; // Added for drag & drop
  isBusy: boolean;
  nodeToAutoRenameId: string | null;
  setNodeToAutoRenameId: (id: string | null) => void;
}

// Add other shared types here
