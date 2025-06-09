
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


export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'generatedCode' | 'refactorSuggestion' | 'codeExamples' | 'error' | 'loading' | 'newFileSuggestion';
  content: string; // For text, error messages, or descriptions
  code?: string; // For generatedCode, newFileSuggestion
  suggestion?: AiSuggestion; // For refactorSuggestion (singular)
  examples?: string[]; // For codeExamples
  suggestedFileName?: string; // For newFileSuggestion
  targetPath?: string; // For refactorSuggestion and generatedCode, to know which file it applies to
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
