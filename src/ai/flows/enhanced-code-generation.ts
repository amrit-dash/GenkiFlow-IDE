'use server';
/**
 * Enhanced AI flow for code generation with contextual enrichment and RAG integration.
 * This version restores the prompt-based structure, integrates the new RAG system/tool,
 * and ensures robust error handling and output schema validation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { fileSystemOperations } from '../tools/file-system-operations';
import { codebaseSearch } from '../tools/codebase-search';
import { errorValidation } from '../tools/error-validation';
import { codeUsageAnalysis } from '../tools/code-usage-analysis';
import { operationProgress } from '../tools/operation-progress';
import { terminalOperations } from '../tools/terminal-operations';
import { fileSystemExecutor } from '../tools/file-system-executor';
import { codebaseDataset } from '../tools/codebase-dataset';
import { intelligentCodeMerger } from '../tools/intelligent-code-merger';
import { fileContextAnalyzer } from '../tools/file-context-analyzer';
import { filenameSuggester } from '../tools/filename-suggester';
import { codeRetriever } from '../tools/advanced-rag-system';
import { intentClassifier } from '../tools/intent-classifier';
// import path from 'path'; // No longer needed as fileSystemExecutor is removed from this flow

// Types for RAG configuration
interface RetrieverConfig {
  query: string;
  queryType: 'semantic' | 'syntactic' | 'hybrid';
  maxResults: number;
  contextWindow: number;
  includeMetadata: boolean;
  filters?: {
    language?: string;
    fileType?: string[];
    complexity?: 'low' | 'medium' | 'high';
    chunkType?: ('function' | 'class' | 'interface' | 'component' | 'import' | 'config' | 'documentation' | 'test')[];
    excludeFiles?: string[];
  };
}

// Define input/output schemas
const FilenameSuggesterOutputSchema = z.object({
  suggestions: z.array(z.object({
    filename: z.string(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
    category: z.enum(['descriptive', 'conventional', 'functional', 'contextual']),
  })),
  analysis: z.object({
    detectedLanguage: z.string().nullable(), // Allow null for empty files
    codeType: z.string(),
    mainFunctions: z.array(z.string()),
    hasExports: z.boolean(),
    isComponent: z.boolean(),
    suggestedExtension: z.string(),
    currentFileNameForFiltering: z.string().optional(),
  }),
});

const ChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().optional(),
});

const AttachedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

const EnhancedGenerateCodeInputSchema = z.object({
  prompt: z.string(),
  currentFilePath: z.string().optional(),
  currentFileContent: z.string().optional(),
  currentFileName: z.string().optional(),
  attachedFiles: z.array(AttachedFileSchema).optional(),
  fileSystemTree: z.string(),
  chatHistory: z.array(ChatHistoryItemSchema).optional(),
  projectContext: z.object({
    hasPackageJson: z.boolean(),
    hasReadme: z.boolean(),
    hasSrcFolder: z.boolean(),
    hasTestFolder: z.boolean(),
    totalFiles: z.number(),
    totalFolders: z.number(),
  }).optional(),
});
export type EnhancedGenerateCodeInput = z.infer<typeof EnhancedGenerateCodeInputSchema>;

const FileOperationSuggestionSchema = z.object({
  type: z.enum(['create', 'rename', 'delete', 'move', 'none']),
  reasoning: z.string(),
  targetPath: z.string().optional().nullable(),
  newName: z.string().optional().nullable(),
  fileType: z.enum(['file', 'folder']).optional(),
  destinationPath: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1),
});

const EnhancedGenerateCodeOutputSchema = z.object({
  code: z.string().nullable().optional(),
  isNewFile: z.boolean().optional(),
  suggestedFileName: z.string().optional().nullable(),
  targetPath: z.string().optional().nullable(),
  explanation: z.string().nullable().optional(),
  fileOperationSuggestion: FileOperationSuggestionSchema.optional().nullable(),
  alternativeOptions: z.array(z.object({
    description: z.string(),
    isNewFile: z.boolean(),
    suggestedFileName: z.string().optional().nullable(),
    targetPath: z.string().optional().nullable(),
  })).optional().nullable(),
  codeQuality: z.object({
    followsBestPractices: z.boolean(),
    isTypeScriptCompatible: z.boolean(),
    hasProperErrorHandling: z.boolean(),
    isWellDocumented: z.boolean(),
    estimatedComplexity: z.enum(['low', 'medium', 'high']),
  }).optional().nullable(),
  filenameSuggestionData: FilenameSuggesterOutputSchema.optional().nullable(),
});
export type EnhancedGenerateCodeOutput = z.infer<typeof EnhancedGenerateCodeOutputSchema>;

// Prompt definition with RAG tool integration
const prompt = ai.definePrompt({
  name: 'enhancedGenerateCodePrompt',
  input: { schema: EnhancedGenerateCodeInputSchema },
  output: { schema: EnhancedGenerateCodeOutputSchema },
  tools: [
    intentClassifier,
    fileSystemOperations,
    codebaseSearch,
    errorValidation,
    codeUsageAnalysis,
    operationProgress,
    terminalOperations,
    fileSystemExecutor,
    codebaseDataset,
    intelligentCodeMerger,
    fileContextAnalyzer,
    filenameSuggester,
    codeRetriever
  ],
  prompt: `You are an expert AI coding assistant specialized in generating complete, working code.

**🚨 CRITICAL CODE GENERATION RULE 🚨**
When users ask to "generate", "create", "write", "build", or "make" any code/script/component:
- **ALWAYS provide complete, working code in the 'code' field**
- **NEVER leave 'code' field empty, null, or undefined**  
- **Set 'isNewFile' to true when creating new files**
- **Set 'suggestedFileName' with appropriate name**

User Prompt: {{{prompt}}}

CONTEXT:
Current File: {{{currentFilePath}}} ({{{currentFileName}}})
Current Content:
\`\`\`
{{{currentFileContent}}}
\`\`\`

File System:
\`\`\`
{{{fileSystemTree}}}
\`\`\`

{{#if attachedFiles}}
ATTACHED FILES:
{{#each attachedFiles}}
📎 {{this.path}}:
\`\`\`
{{{this.content}}}
\`\`\`
{{/each}}
{{/if}}

**INSTRUCTIONS:**

1. **For CODE GENERATION requests** (generate/create/write/build code):
   - Start with \`operationProgress\` (stage: 'starting')
   - **MANDATORY**: Fill 'code' field with complete, functional code
   - Set 'isNewFile' to true for new files
   - Set 'suggestedFileName' (use \`filenameSuggester\` if needed)
   - Set 'targetPath' to target directory
   - Provide clear 'explanation'
   - End with \`operationProgress\` (stage: 'completing')

2. **For filename suggestions**:
   - Use \`filenameSuggester\` tool
   - Set 'code' to null
   - Set 'isNewFile' to false
   - Fill 'filenameSuggestionData'

3. **For file operations**:
   - Set 'code' to null initially
   - Set 'isNewFile' to false  
   - Fill 'fileOperationSuggestion'

**CRITICAL**: For any request involving code generation, the 'code' field is MANDATORY and must contain complete, working code.

Examples that MUST include code:
- "Generate a Python script" → Full Python code with imports, functions, main execution
- "Create a web scraper" → Complete scraper with all necessary imports and logic
- "Write a function" → Complete function implementation
- "Build a component" → Full component code ready to use

Respond with a JSON object matching the EnhancedGenerateCodeOutputSchema.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

// Flow definition
export const enhancedGenerateCodeFlow = ai.defineFlow(
  {
    name: 'enhancedGenerateCodeFlow',
    inputSchema: EnhancedGenerateCodeInputSchema,
    outputSchema: EnhancedGenerateCodeOutputSchema,
  },
  async (input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        console.error("enhancedGenerateCodeFlow: AI prompt returned no output.");
        return {
          explanation: 'Sorry, I encountered an internal error and could not process your request (no output from AI).',
          isNewFile: false,
          code: null,
        } as EnhancedGenerateCodeOutput;
      }

      // Omit optional fields if they are null or undefined
      const cleanedOutput: any = { ...output };
      if (cleanedOutput.fileOperationSuggestion === null || cleanedOutput.fileOperationSuggestion === undefined) delete cleanedOutput.fileOperationSuggestion;
      if (cleanedOutput.alternativeOptions === null || cleanedOutput.alternativeOptions === undefined) delete cleanedOutput.alternativeOptions;
      if (cleanedOutput.codeQuality === null || cleanedOutput.codeQuality === undefined) delete cleanedOutput.codeQuality;
      if (cleanedOutput.filenameSuggestionData === null || cleanedOutput.filenameSuggestionData === undefined) delete cleanedOutput.filenameSuggestionData;
      
      // Explicitly check if code is missing when it's expected for a new file
      if (cleanedOutput.isNewFile && (cleanedOutput.code === null || cleanedOutput.code === undefined || cleanedOutput.code.trim() === "")) {
        console.warn("enhancedGenerateCodeFlow: AI suggested a new file but did not provide code content. Input prompt:", input.prompt);
        
        // Generate a simple fallback code based on the prompt
        let fallbackCode = '';
        const promptLower = input.prompt.toLowerCase();
        
        if (promptLower.includes('python') || promptLower.includes('web scraper')) {
          fallbackCode = `# ${input.prompt}
import requests
from bs4 import BeautifulSoup

def main():
    # Add your web scraping logic here
    url = "https://example.com"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Extract titles or other content
    titles = soup.find_all('h1')
    for title in titles:
        print(title.get_text())

if __name__ == "__main__":
    main()
`;
        } else if (promptLower.includes('javascript') || promptLower.includes('function')) {
          fallbackCode = `// ${input.prompt}
function addTwoNumbers(a, b) {
    return a + b;
}

// Example usage
const result = addTwoNumbers(5, 3);
console.log('Result:', result);
`;
        } else if (promptLower.includes('react') || promptLower.includes('component')) {
          fallbackCode = `// ${input.prompt}
import React from 'react';

interface Props {
  title?: string;
}

const MyComponent: React.FC<Props> = ({ title = 'Hello World' }) => {
  return (
    <div>
      <h1>{title}</h1>
      <p>This is a simple React component.</p>
    </div>
  );
};

export default MyComponent;
`;
        } else {
          fallbackCode = `// ${input.prompt}
// Generated code placeholder
// Please modify this code according to your requirements

console.log("Hello World");
`;
        }
        
        // Update the output with fallback code
        cleanedOutput.code = fallbackCode;
        cleanedOutput.explanation = (cleanedOutput.explanation || '') + 
          '\n\n⚠️ Note: Generated fallback code. Please review and modify as needed.';
      }

      // Ensure we have proper file operation suggestions for code with content
      if (cleanedOutput.code && cleanedOutput.code.trim() !== "") {
        if (cleanedOutput.isNewFile) {
          // Ensure filename is set
          if (!cleanedOutput.suggestedFileName) {
            const promptLower = input.prompt.toLowerCase();
            if (promptLower.includes('python') || promptLower.includes('scraper')) {
              cleanedOutput.suggestedFileName = 'script.py';
            } else if (promptLower.includes('javascript')) {
              cleanedOutput.suggestedFileName = 'script.js';
            } else if (promptLower.includes('typescript')) {
              cleanedOutput.suggestedFileName = 'script.ts';
            } else if (promptLower.includes('react') || promptLower.includes('component')) {
              cleanedOutput.suggestedFileName = 'Component.tsx';
            } else {
              cleanedOutput.suggestedFileName = 'generated_code.txt';
            }
          }
          
          // Ensure target path is set
          if (!cleanedOutput.targetPath) {
            cleanedOutput.targetPath = '/';
          }
          
          // Ensure file operation suggestion for creation
          cleanedOutput.fileOperationSuggestion = {
            type: 'create',
            reasoning: `Create new file ${cleanedOutput.suggestedFileName} with the generated code`,
            targetPath: cleanedOutput.targetPath,
            newName: cleanedOutput.suggestedFileName,
            fileType: 'file',
            content: cleanedOutput.code,
            confidence: 0.9,
          };
          
          cleanedOutput.explanation = (cleanedOutput.explanation || '') + 
            `\n\n📄 Ready to create: ${cleanedOutput.suggestedFileName}`;
        }
      }

      return cleanedOutput;
    } catch (error) {
      console.error("enhancedGenerateCodeFlow: Error during flow execution:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if it's a schema validation error from Genkit itself
      if (errorMessage.includes("Schema validation failed") || errorMessage.includes("Parse Errors")) {
         console.error("enhancedGenerateCodeFlow: Schema validation error details:", JSON.stringify(error, null, 2));
         return {
          explanation: `An error occurred during code generation: Schema validation failed. Details: ${errorMessage}`,
          isNewFile: false,
          code: null,
        } as EnhancedGenerateCodeOutput;
      }
      return {
        explanation: 'An error occurred during code generation: ' + errorMessage,
        isNewFile: false,
        code: null,
      } as EnhancedGenerateCodeOutput;
    }
  }
);

// Main export
export async function enhancedGenerateCode(input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> {
  return enhancedGenerateCodeFlow(input);
}

    