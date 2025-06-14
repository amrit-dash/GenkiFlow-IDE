
'use server';
/**
 * @fileOverview Enhanced AI flow for code generation with contextual enrichment.
 *
 * - enhancedGenerateCode: Advanced code generation with file system context and history.
 * - EnhancedGenerateCodeInput: Input schema including file system tree and chat history.
 * - EnhancedGenerateCodeOutput: Enhanced output with file operation suggestions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {fileSystemOperations} from '../tools/file-system-operations';
import {codebaseSearch} from '../tools/codebase-search';
import {errorValidation} from '../tools/error-validation';
import {codeUsageAnalysis} from '../tools/code-usage-analysis';
import {operationProgress} from '../tools/operation-progress';
import {terminalOperations} from '../tools/terminal-operations';
import {fileSystemExecutor} from '../tools/file-system-executor';
import {codebaseDataset} from '../tools/codebase-dataset';
import {intelligentCodeMerger} from '../tools/intelligent-code-merger';
import {fileContextAnalyzer} from '../tools/file-context-analyzer';
import { filenameSuggester } from '../tools/filename-suggester'; // Added filenameSuggester

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
  prompt: z.string().describe("The user's primary request or question."),
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
  code: z.string().describe('The generated code. This could be a new file content, a snippet, or the modified content of an existing file. Should be minimal or empty if fileOperationSuggestion is the primary output.'),
  isNewFile: z.boolean().describe('Whether this should be a new file.'),
  suggestedFileName: z.string().optional().nullable().describe('Suggested filename for new files.'),
  targetPath: z.string().optional().nullable().describe('Target path for existing file edits OR the path of the item being operated on by fileOperationSuggestion.'),
  explanation: z.string().describe('Explanation of what the code does or the file operation. Should be concise if fileOperationSuggestion is primary.'),
  fileOperationSuggestion: FileOperationSuggestionSchema.optional().describe('Suggested file system operation. This should be the primary output for direct file system commands.'),
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
  // Allow passthrough for filenameSuggester results if that was the primary action
  filenameSuggestionData: z.any().optional().describe('If the primary action was to suggest filenames, this field will contain the direct output from the filenameSuggester tool.'),
});

export type EnhancedGenerateCodeOutput = z.infer<typeof EnhancedGenerateCodeOutputSchema>;

export async function enhancedGenerateCode(input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> {
  return enhancedGenerateCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhancedGenerateCodePrompt',
  input: {schema: EnhancedGenerateCodeInputSchema},
  output: {schema: EnhancedGenerateCodeOutputSchema},
  tools: [fileSystemOperations, codebaseSearch, errorValidation, codeUsageAnalysis, operationProgress, terminalOperations, fileSystemExecutor, codebaseDataset, intelligentCodeMerger, fileContextAnalyzer, filenameSuggester], // Added filenameSuggester
  prompt: `You are an expert AI coding assistant with deep understanding of software architecture, file system operations, and best practices.

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

TARGET PRIORITIZATION FOR OPERATIONS (RENAME, DELETE, MOVE, CODE EDITS):
1. If 'attachedFiles' are provided AND the user's prompt clearly references an attached item (e.g., "this folder", "the attached file X", "rename myAttachment.ts", "rename the folder I attached"), you MUST use the path from 'attachedFiles' as the 'targetPath' for the operation or code modification. The AI response should confirm this target.
2. If 'attachedFiles' are present but the prompt clearly references the 'currentFilePath' (e.g., "the current file in the editor"), use 'currentFilePath'.
3. If 'attachedFiles' are present and the prompt is ambiguous (e.g., "rename it"), AND both current file and an attachment seem relevant, ASK FOR CLARIFICATION before proceeding. Explain the ambiguity (e.g., "Do you mean the active file X or the attached folder Y?").
4. If no 'attachedFiles' are relevant or present, use 'currentFilePath' if available and relevant.
5. For new code generation, if the prompt doesn't specify a target, determine the best target based on all context.

ENHANCED INSTRUCTIONS & TOOL USAGE:
1. **Before starting**: Use operationProgress tool to explain what you're about to do.
2. **If user asks for filename suggestions** (e.g., "suggest names for this file/folder"):
   a. Identify the target (file or folder, prioritizing attachments if referenced).
   b. Use the 'filenameSuggester' tool with the target's content (or summary for folders) and current name.
   c. Your primary response should be the direct output from 'filenameSuggester'. Populate the 'filenameSuggestionData' field in your output. Make 'explanation' very brief (e.g., "Here are some name suggestions for [target_name]:") and 'code' empty.
3. **If user gives a direct file system command** (e.g., "rename file X to Y", "delete folder Z", "move file A to folder B"):
   a. Identify the target(s) and parameters, prioritizing attached items as per TARGET PRIORITIZATION.
   b. Your primary output MUST be through the 'fileOperationSuggestion' field.
   c. The 'targetPath' in 'fileOperationSuggestion' must be the path of the item being operated on. For 'rename', include 'newName'. For 'move', include 'destinationPath'. For 'create', include 'fileType' and 'targetPath' (parent directory).
   d. The 'explanation' field should be a concise confirmation of the understood operation (e.g., "Okay, I will rename file X to Y." or "Preparing to delete folder Z.").
   e. The 'code' field should be empty or contain a very brief status message only.
   f. Ensure 'confidence' in 'fileOperationSuggestion' is appropriately set.
4. **For code generation/modification not primarily a file operation**:
   a. Follow the workflow below.
   b. Use 'targetPath' to indicate the file for modification or where new code should be placed.
5. **During analysis**: If the user asks about specific functions/components, use codeUsageAnalysis.
6. **File context analysis**: Use fileContextAnalyzer for suitability.
7. **Smart merging**: For modifications, use intelligentCodeMerger.
8. **After generation/merge**: Use errorValidation. If high-confidence fixes are available, apply them to 'code' output and mention in 'explanation'.
9. **Other tool usage**: fileSystemOperations (for suggesting operations if not a direct command), fileSystemExecutor (if explicit execution after confirmation is needed, though direct output via fileOperationSuggestion is preferred), terminalOperations, codebaseDataset, codebaseSearch as appropriate.

WORKFLOW (for code generation/modification):
1. Start with operationProgress (stage: 'starting', progress: 10)
2. Initialize/query codebaseDataset for project context (stage: 'analyzing', progress: 15)
3. Analyze context, requirements, and TARGET PRIORITIZATION (stage: 'analyzing', progress: 25)
4. Use fileContextAnalyzer on relevant existing files (stage: 'analyzing', progress: 35)
5. Determine optimal file targeting (stage: 'analyzing', progress: 45)
6. Generate/modify code (stage: 'processing', progress: 65)
7. If modifying: Use intelligentCodeMerger (stage: 'processing', progress: 80)
8. Validate with errorValidation. Apply high-confidence fixes. (stage: 'validating', progress: 90)
9. Complete with results (stage: 'completing', progress: 100)

ERROR HANDLING & CLARIFICATION:
- If 'errorValidation' tool finds errors with high-confidence fixes, apply them to 'code' output and explain.
- If an operation fails or target is ambiguous, use operationProgress (stage: 'error') or ask for clarification.
- Always explain what you're doing before using tools that modify state or need confirmation.

OUTPUT REQUIREMENTS:
- For pure file operations or filename suggestions, prioritize 'fileOperationSuggestion' or 'filenameSuggestionData' respectively, keeping 'code' and 'explanation' concise or empty.
- For code generation, produce clean, production-ready code.
- Accurately set 'targetPath' based on TARGET PRIORITIZATION.
- Set 'isNewFile' and 'suggestedFileName' correctly for new code.

Respond with a comprehensive JSON object matching the schema. Ensure 'targetPath' in the root of your response correctly reflects the primary file/folder being acted upon or targeted for code.`,
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
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    