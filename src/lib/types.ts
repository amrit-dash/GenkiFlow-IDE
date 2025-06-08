
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

// Add other shared types here
