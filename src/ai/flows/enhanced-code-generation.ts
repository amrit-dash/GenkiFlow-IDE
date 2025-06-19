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
    detectedLanguage: z.string(),
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
  })).optional().nullable(), // Added .nullable()
  codeQuality: z.object({
    followsBestPractices: z.boolean(),
    isTypeScriptCompatible: z.boolean(),
    hasProperErrorHandling: z.boolean(),
    isWellDocumented: z.boolean(),
    estimatedComplexity: z.enum(['low', 'medium', 'high']),
  }).optional().nullable(), // Added .nullable()
  filenameSuggestionData: FilenameSuggesterOutputSchema.optional().nullable(), // Added .nullable()
});
export type EnhancedGenerateCodeOutput = z.infer<typeof EnhancedGenerateCodeOutputSchema>;

// Prompt definition with RAG tool integration
const prompt = ai.definePrompt({
  name: 'enhancedGenerateCodePrompt',
  input: { schema: EnhancedGenerateCodeInputSchema },
  output: { schema: EnhancedGenerateCodeOutputSchema },
  tools: [
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
  prompt: `You are an expert AI coding assistant. Your primary task is to generate or modify code based on the user's prompt and provided context. You can also suggest file system operations if they are directly related to the code generation task (e.g., creating a new file for the generated code). If the user's prompt is explicitly about suggesting filenames or performing simple file operations (like rename, delete, move), you should leverage the appropriate tools and ensure your output primarily reflects that tool's result.

You have access to a Retrieval-Augmented Generation (RAG) system for retrieving relevant code context and examples from the codebase. Use the RAG tool whenever additional context or examples would improve your code generation, error fixing, or explanation.

User Prompt: {{{prompt}}}

CONTEXT ANALYSIS:
Current File Path (Editor): {{{currentFilePath}}}
Current File Name (Editor): {{{currentFileName}}}
Current File Content (Editor):
\`\`\`
{{{currentFileContent}}}
\`\`\`

File System Structure:
\`\`\`
{{{fileSystemTree}}}
\`\`\`

{{#if attachedFiles}}
{{#each attachedFiles}}
{{#if @first}}
ATTACHED ITEMS CONTEXT:
{{/if}}
Item Path: {{this.path}}
Item Content/Summary:
\`\`\`
{{{this.content}}}
\`\`\`
---
{{/each}}
{{/if}}

{{#if chatHistory}}
{{#each chatHistory}}
{{#if @first}}
Recent Chat History (for context):
{{/if}}
{{this.role}}: {{{this.content}}}
---
{{/each}}
{{/if}}

{{#if projectContext}}
Project Analysis:
- Package.json: {{projectContext.hasPackageJson}}
- README: {{projectContext.hasReadme}}
- Source folder: {{projectContext.hasSrcFolder}}
- Test folder: {{projectContext.hasTestFolder}}
- Total files: {{projectContext.totalFiles}}
- Total folders: {{projectContext.totalFolders}}
{{/if}}

TARGET PRIORITIZATION FOR OPERATIONS & CODE MODIFICATION:
1.  If 'attachedFiles' are provided AND the user's prompt clearly references an attached item (e.g., "this folder", "the attached file X", "rename myAttachment.ts", "generate code in the attached folder"), you MUST use the path from 'attachedFiles' as the 'targetPath' for the operation or code modification.
2.  If 'attachedFiles' are present but the prompt clearly references the 'currentFilePath' (e.g., "the current file in the editor", "add to this open file"), use 'currentFilePath'.
3.  If 'attachedFiles' are present and the prompt is ambiguous regarding the target (e.g., "rename it"), AND both current file and an attachment seem relevant, ASK FOR CLARIFICATION. You can do this by setting your 'explanation' to ask the user to clarify and not providing 'code' or 'fileOperationSuggestion'.
4.  If no 'attachedFiles' are relevant or present, use 'currentFilePath' if available and relevant for code modification.
5.  For new code generation, if the prompt doesn't specify a target, determine the best target based on all context. 'targetPath' in your output should be the directory where a new file would be created.

INSTRUCTIONS & TOOL USAGE:

A. IF THE USER PROMPT IS *PRIMARILY* ABOUT SUGGESTING FILENAMES (e.g., "suggest names for this file/folder", "what should I call this component?"):
   1. Identify the target item for which names are being suggested (prioritizing attachments as per TARGET PRIORITIZATION). Get its content (for files) or summary (for folders) and its current name.
   2. Use the \`filenameSuggester\` tool with this information.
   3. Your *primary response* should be the direct output from \`filenameSuggester\`. Populate the 'filenameSuggestionData' field in your output with the tool's result.
   4. Set 'code' to null or empty.
   5. Set 'explanation' to a very brief confirmation (e.g., "Here are some name suggestions for [target_name]:").
   6. Set 'isNewFile' to **false**.
   7. Ensure 'targetPath' in your root output reflects the path of the item for which names were suggested.

B. IF THE USER PROMPT IS *PRIMARILY* A DIRECT FILE SYSTEM COMMAND (e.g., "rename file X to Y", "delete folder Z", "move file A to folder B"):
   1. Identify the target(s) and parameters, prioritizing attached items as per TARGET PRIORITIZATION.
   2. Your *primary output* MUST be through the 'fileOperationSuggestion' field. Ensure all required sub-fields of 'fileOperationSuggestion' (type, reasoning, confidence) are provided.
   3. 'targetPath' in 'fileOperationSuggestion' must be the path of the item being operated on. For 'rename', include 'newName'. For 'move', include 'destinationPath'. For 'create', include 'fileType' and 'targetPath' (which would be the parent directory).
   4. Set 'code' to null or empty.
   5. Set 'explanation' to a concise confirmation of the understood operation (e.g., "Okay, I will rename file X to Y.").
   6. Set 'isNewFile' to **false**.
   7. Ensure 'targetPath' in your root output reflects the path of the item being operated on.

C. FOR ALL OTHER REQUESTS (Primarily Code Generation/Modification):
   1. Start with \`operationProgress\` (stage: 'starting').
   2. Analyze context, requirements, and TARGET PRIORITIZATION. Use \`fileContextAnalyzer\` for existing files.
   3. If generating new code for a new file:
      a. Set 'isNewFile' to true.
      b. Set 'suggestedFileName' (use \`filenameSuggester\` if the user's prompt gives clues for a name, otherwise derive a sensible default like "newComponent.tsx").
      c. 'targetPath' should be the directory for the new file.
      d. 'code' should be the full content of the new file.
   4. If modifying existing code:
      a. Set 'isNewFile' to false.
      b. 'targetPath' MUST be the path of the file being modified (respecting TARGET PRIORITIZATION).
      c. Use \`intelligentCodeMerger\` to integrate changes. 'code' field should contain the complete, merged content of the modified file.
   5. Provide a clear 'explanation' of the generated/modified code.
   6. Use \`errorValidation\` on generated/merged code. If high-confidence fixes are available, apply them to the 'code' output and mention in 'explanation'.
   7. Use other tools (\`codebaseSearch\`, \`codeUsageAnalysis\`, \`terminalOperations\`, \`fileSystemExecutor\`, \`codebaseDataset\`) as needed to fulfill the request. If suggesting a file operation as a *secondary step* to code generation (e.g. "Generated the code, and I suggest creating file X for it"), use the \`fileOperationSuggestion\` field.
   8. End with \`operationProgress\` (stage: 'completing').

GENERAL OUTPUT REQUIREMENTS:
- For scenarios A and B, prioritize 'filenameSuggestionData' or 'fileOperationSuggestion' respectively. 'code' should be null/empty, 'isNewFile' false, and 'explanation' concise.
- For scenario C, 'code', 'isNewFile', 'targetPath', and 'explanation' are key.
- Always ensure 'targetPath' in the root of your response correctly reflects the primary file/folder being acted upon or targeted.
- If 'isNewFile' is true, 'suggestedFileName' is expected. If 'isNewFile' is false, 'suggestedFileName' can be null.
- If no specific code generation is required or file operation is suggested (e.g., a general question or clarification), respond with a helpful 'explanation' and ensure 'code' and 'fileOperationSuggestion' are null or omitted. 'isNewFile' should be false.
- Ensure any optional objects like 'codeQuality' or 'alternativeOptions', if included, are fully populated according to their schemas or omitted entirely. Do not provide partially filled optional objects. If an optional field of type array or object is not applicable, omit the field entirely rather than setting it to null.

Respond with a comprehensive JSON object matching the EnhancedGenerateCodeOutputSchema.
`,
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
        return {
          explanation: 'Sorry, I encountered an internal error and could not process your request.',
          isNewFile: false,
          code: null,
        } as EnhancedGenerateCodeOutput;
      }
      // Omit optional fields if they are null or undefined
      const cleanedOutput: any = { ...output };
      if (cleanedOutput.fileOperationSuggestion == null) delete cleanedOutput.fileOperationSuggestion;
      if (cleanedOutput.alternativeOptions == null) delete cleanedOutput.alternativeOptions;
      if (cleanedOutput.codeQuality == null) delete cleanedOutput.codeQuality;
      if (cleanedOutput.filenameSuggestionData == null) delete cleanedOutput.filenameSuggestionData;
      return cleanedOutput;
    } catch (error) {
      console.error('Error in enhancedGenerateCodeFlow:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Attempt to parse Genkit-specific error details if they exist
      let genkitDetails = '';
      if (error && typeof error === 'object' && 'details' in error) {
        try {
          genkitDetails = ` Details: ${JSON.stringify((error as any).details)}`;
        } catch (e) { /* ignore stringify error */ }
      }


      return {
        explanation: `An error occurred during code generation: ${errorMessage}${genkitDetails}`,
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
