
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

// Add other shared types here
