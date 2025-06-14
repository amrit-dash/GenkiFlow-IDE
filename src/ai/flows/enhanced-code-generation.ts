
'use server';
/**
 * @fileOverview Enhanced AI flow for code generation with contextual enrichment.
 * This flow is now primarily focused on generating or modifying code when explicitly invoked
 * for such tasks. It assumes intent classification might happen client-side for simpler
 * operations like direct filename suggestions or basic file system commands.
 *
 * - enhancedGenerateCode: Advanced code generation with file system context and history.
 * - EnhancedGenerateCodeInput: Input schema including file system tree and chat history.
 * - EnhancedGenerateCodeOutput: Enhanced output with file operation suggestions for *code-related* actions.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';
import {fileSystemOperations}from '../tools/file-system-operations';
import {codebaseSearch}from '../tools/codebase-search';
import {errorValidation}from '../tools/error-validation';
import {codeUsageAnalysis}from '../tools/code-usage-analysis';
import {operationProgress}from '../tools/operation-progress';
import {terminalOperations}from '../tools/terminal-operations';
import {fileSystemExecutor}from '../tools/file-system-executor';
import {codebaseDataset}from '../tools/codebase-dataset';
import {intelligentCodeMerger}from '../tools/intelligent-code-merger';
import {fileContextAnalyzer}from '../tools/file-context-analyzer';
import { filenameSuggester }from '../tools/filename-suggester';

// Define FilenameSuggesterOutputSchema to match the tool's output
const FilenameSuggesterOutputSchema = z.object({
  suggestions: z.array(z.object({
    filename: z.string().describe('Suggested filename (with extension for files, without for folders)'),
    reasoning: z.string().describe('Explanation for why this name was suggested'),
    confidence: z.number().min(0).max(1).describe('Confidence score (0-1)'),
    category: z.enum(['descriptive', 'conventional', 'functional', 'contextual']).describe('Type of naming strategy'),
  })).describe('List of filename suggestions ordered by confidence'),
  analysis: z.object({
    detectedLanguage: z.string().describe('Programming language detected'),
    codeType: z.string().describe('Type of code (component, utility, service, etc.)'),
    mainFunctions: z.array(z.string()).describe('Main functions or exports found'),
    hasExports: z.boolean().describe('Whether file exports functions/classes'),
    isComponent: z.boolean().describe('Whether this appears to be a UI component'),
    suggestedExtension: z.string().describe('Recommended file extension (relevant for fileType="file")'),
    currentFileNameForFiltering: z.string().optional().describe('The current filename, passed through for filtering.'),
  }).describe('Analysis of the file content'),
});


const ChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().optional(),
});

const AttachedFileSchema = z.object({
  path: z.string().describe('Path of the attached file or folder.'),
  content: z.string().describe('Content of the attached file, or a summary string (name, path, direct children) for folders.')
});

const EnhancedGenerateCodeInputSchema = z.object({
  prompt: z.string().describe("The user's primary request or question for code generation or modification."),
  currentFilePath: z.string().optional().describe('Path of the currently active file.'),
  currentFileContent: z.string().optional().describe('Content of the currently active file.'),
  currentFileName: z.string().optional().describe('Name of the currently active file.'),
  attachedFiles: z.array(AttachedFileSchema).optional().describe('Attached files or folders for context. For folders, content is a summary string.'),
  fileSystemTree: z.string().describe('String representation of the current file system structure.'),
  chatHistory: z.array(ChatHistoryItemSchema).optional().describe('Previous chat messages for context.'),
  projectContext: z.object({
    hasPackageJson: z.boolean(),
    hasReadme: z.boolean(),
    hasSrcFolder: z.boolean(),
    hasTestFolder: z.boolean(),
    totalFiles: z.number(),
    totalFolders: z.number(),
  }).optional().describe('Project structure analysis.'),
});

export type EnhancedGenerateCodeInput = z.infer<typeof EnhancedGenerateCodeInputSchema>;

const FileOperationSuggestionSchema = z.object({
  type: z.enum(['create', 'rename', 'delete', 'move', 'none']),
  reasoning: z.string(),
  targetPath: z.string().optional().nullable(),
  newName: z.string().optional().nullable(),
  fileType: z.enum(['file', 'folder']).optional().describe('Type for create operations or to clarify target type for rename/delete.'),
  destinationPath: z.string().optional().nullable().describe('Destination path for move operations.'),
  confidence: z.number().min(0).max(1),
});

const EnhancedGenerateCodeOutputSchema = z.object({
  code: z.string().nullable().optional(),
  isNewFile: z.boolean().optional(), // Made optional to align with prompt adjustments
  suggestedFileName: z.string().optional().nullable(),
  targetPath: z.string().optional().nullable(),
  explanation: z.string().nullable().optional(),
  fileOperationSuggestion: FileOperationSuggestionSchema.optional(),
  alternativeOptions: z.array(z.object({
    description: z.string(),
    isNewFile: z.boolean(),
    suggestedFileName: z.string().optional().nullable(),
    targetPath: z.string().optional().nullable(),
  })).optional().describe('Alternative placement options for the code.'),
  codeQuality: z.object({
    followsBestPractices: z.boolean(),
    isTypeScriptCompatible: z.boolean(),
    hasProperErrorHandling: z.boolean(),
    isWellDocumented: z.boolean(),
    estimatedComplexity: z.enum(['low', 'medium', 'high']),
  }).optional().describe('Quality assessment of the generated code.'),
  filenameSuggestionData: FilenameSuggesterOutputSchema.optional().describe('If the user specifically asked for filename suggestions and this flow decided to use the filenameSuggester tool, this field will contain the direct output from the filenameSuggester tool. This indicates the primary action was filename suggestion.'),
});

export type EnhancedGenerateCodeOutput = z.infer<typeof EnhancedGenerateCodeOutputSchema>;

export async function enhancedGenerateCode(input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> {
  return enhancedGenerateCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhancedGenerateCodePrompt',
  input: {schema: EnhancedGenerateCodeInputSchema},
  output: {schema: EnhancedGenerateCodeOutputSchema},
  tools: [fileSystemOperations, codebaseSearch, errorValidation, codeUsageAnalysis, operationProgress, terminalOperations, fileSystemExecutor, codebaseDataset, intelligentCodeMerger, fileContextAnalyzer, filenameSuggester],
  prompt: `You are an expert AI coding assistant. Your primary task is to generate or modify code based on the user's prompt and provided context. You can also suggest file system operations if they are directly related to the code generation task (e.g., creating a new file for the generated code). If the user's prompt is explicitly about suggesting filenames or performing simple file operations (like rename, delete, move), you should leverage the appropriate tools and ensure your output primarily reflects that tool's result.

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
   5. Set 'explanation' to a very brief confirmation (e.g., "Here are some name suggestions for [target\_name]:").
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
- Ensure any optional objects like 'codeQuality' or 'alternativeOptions', if included, are fully populated according to their schemas or omitted entirely. Do not provide partially filled optional objects.

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

const enhancedGenerateCodeFlow = ai.defineFlow(
  {
    name: 'enhancedGenerateCodeFlow',
    inputSchema: EnhancedGenerateCodeInputSchema,
    outputSchema: EnhancedGenerateCodeOutputSchema,
  },
  async (input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> => {
    console.log('DEBUG: enhancedGenerateCodeFlow - Input to prompt:', JSON.stringify(input, null, 2));
    const { output } = await prompt(input);
    console.log('DEBUG: enhancedGenerateCodeFlow - Raw output from LLM:', JSON.stringify(output, null, 2));


    if (!output) {
      console.error("EnhancedGenerateCodeFlow: Prompt output was null or undefined.");
      // Return a minimal, valid error-like response conforming to the schema
      return {
        explanation: "Sorry, I encountered an internal error and couldn't process your request. Please try rephrasing or try again later.",
        isNewFile: false,
        code: null,
        // All other fields are optional or nullable and can be omitted here
      };
    }

    // If filenameSuggestionData or a significant fileOperationSuggestion is present, it's not a new file being created *by this flow*.
    if (output.filenameSuggestionData || (output.fileOperationSuggestion && output.fileOperationSuggestion.type !== 'none')) {
        output.isNewFile = false;
    } else if (output.code && output.isNewFile === undefined && output.suggestedFileName) {
        // If there's code and a suggested filename, and isNewFile wasn't set, assume it's a new file.
        output.isNewFile = true;
    } else if (output.isNewFile === undefined) {
        // Default to false if not otherwise determined.
        output.isNewFile = false;
    }
    return output;
  }
);


    

