
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
  type: 'text' | 'generatedCode' | 'refactorSuggestions' | 'codeExamples' | 'error' | 'loading';
  content: string; // For text, error messages, or descriptions
  code?: string; // For generatedCode
  suggestions?: AiSuggestion[]; // For refactorSuggestions
  examples?: string[]; // For codeExamples
}

// Add other shared types here
