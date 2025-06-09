
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

const ChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().optional(),
});

const AttachedFileSchema = z.object({
  path: z.string().describe('Path of the attached file.'),
  content: z.string().describe('Content of the attached file.')
});

const EnhancedGenerateCodeInputSchema = z.object({
  prompt: z.string().describe("The user's primary request or question."),
  currentFilePath: z.string().optional().describe('Path of the currently active file.'),
  currentFileContent: z.string().optional().describe('Content of the currently active file.'),
  currentFileName: z.string().optional().describe('Name of the currently active file.'),
  attachedFiles: z.array(AttachedFileSchema).optional().describe('Attached files for context.'),
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
  type: z.enum(['create', 'rename', 'delete', 'none']),
  reasoning: z.string(),
  targetPath: z.string().optional().nullable(),
  newName: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1),
});

const EnhancedGenerateCodeOutputSchema = z.object({
  code: z.string().describe('The generated code.'),
  isNewFile: z.boolean().describe('Whether this should be a new file.'),
  suggestedFileName: z.string().optional().nullable().describe('Suggested filename for new files.'),
  targetPath: z.string().optional().nullable().describe('Target path for existing file edits.'),
  explanation: z.string().describe('Explanation of what the code does and why.'),
  fileOperationSuggestion: FileOperationSuggestionSchema.optional().describe('Suggested file system operation.'),
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
});

export type EnhancedGenerateCodeOutput = z.infer<typeof EnhancedGenerateCodeOutputSchema>;

export async function enhancedGenerateCode(input: EnhancedGenerateCodeInput): Promise<EnhancedGenerateCodeOutput> {
  return enhancedGenerateCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhancedGenerateCodePrompt',
  input: {schema: EnhancedGenerateCodeInputSchema},
  output: {schema: EnhancedGenerateCodeOutputSchema},
  tools: [fileSystemOperations, codebaseSearch, errorValidation, codeUsageAnalysis, operationProgress, terminalOperations, fileSystemExecutor, codebaseDataset, intelligentCodeMerger, fileContextAnalyzer],
  prompt: `You are an expert AI coding assistant with deep understanding of software architecture and best practices.

User Prompt: {{{prompt}}}

CONTEXT ANALYSIS:
Current File: {{{currentFilePath}}} ({{{currentFileName}}})
Current File Content:
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
Attached Files Context:
{{/if}}
File: {{this.path}}
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

ENHANCED INSTRUCTIONS:
1. **Before starting**: Use operationProgress tool to explain what you're about to do
2. **During analysis**: If the user asks about specific functions/components, use codeUsageAnalysis to find how they're used throughout the codebase
3. **File context analysis**: Use fileContextAnalyzer to understand what existing files do and their suitability for new code
4. **Smart file targeting**: Analyze generated code language/type and match with appropriate existing files or suggest new file creation
5. **Code generation**: Create high-quality, contextually appropriate code
6. **Smart merging**: When modifying existing files, use intelligentCodeMerger to analyze how generated content should be integrated with existing content
7. **After generation**: Use errorValidation tool to check the generated code for issues.
8. **File operations**: Use fileSystemOperations when file placement decisions are needed
9. **File execution**: Use fileSystemExecutor to find, list, delete, rename, or move files when explicitly requested
10. **Terminal commands**: Use terminalOperations for command execution when requested
11. **Dataset management**: Use codebaseDataset to create/query codebase knowledge for better context
12. **Code examples**: Use codebaseSearch to find relevant examples when helpful

WORKFLOW:
1. Start with operationProgress (stage: 'starting', progress: 10)
2. Initialize/query codebaseDataset for better project context (stage: 'analyzing', progress: 15)
3. Analyze context and requirements (stage: 'analyzing', progress: 25)
4. Use fileContextAnalyzer on relevant existing files to understand their purpose and suitability (stage: 'analyzing', progress: 35)
5. Determine optimal file targeting based on code type and context analysis (stage: 'analyzing', progress: 45)
6. Generate appropriate code (stage: 'processing', progress: 65)
7. If modifying existing file: Use intelligentCodeMerger to determine best merge strategy (stage: 'processing', progress: 80)
8. Validate the generated/merged code with errorValidation. If the tool provides high-confidence \`suggestions\` with \`fixedCode\`, apply these fixes directly to your \`code\` output and mention this in the \`explanation\`. (stage: 'validating', progress: 90)
9. Complete with final results (stage: 'completing', progress: 100)

ERROR HANDLING:
- If the errorValidation tool finds errors and provides high-confidence \`suggestions\` with \`fixedCode\`, incorporate these fixes directly into your \`code\` output. Explain that you've applied these automatic corrections in your \`explanation\` field.
- If an operation fails (e.g., a tool call returns an error), use operationProgress with stage: 'error' to inform the user.
- Always explain what you're doing before using tools, especially if it involves file system modifications or command execution.

SPECIAL HANDLING:
- For blank/untitled files: Suggest appropriate renaming based on the code purpose
- For mismatched contexts (e.g., Python code but JS file open): Offer to create new file with proper extension
- For large codebases: Suggest modular approach with multiple files
- For existing files with content: ALWAYS use intelligentCodeMerger to determine optimal merge strategy
- For partial updates: Use intelligentCodeMerger to identify exactly what needs to be inserted/updated
- For file operations requests: Use fileSystemExecutor to list, find, delete, rename, or move files
- For terminal requests: Use terminalOperations to execute commands with user confirmation
- Use progress updates throughout the process

SMART FILE TARGETING GUIDELINES:
- **Language Matching**: Always prefer files that match the generated code's language (Python to .py, JavaScript to .js/.ts, etc.)
- **Context Relevance**: Use fileContextAnalyzer to check if user's request matches what existing files do
- **Avoid README Insertion**: Never insert code into README.md, documentation files, or configuration files unless explicitly requested for documentation updates
- **Purpose Alignment**: Match generated code purpose with file purpose (utilities to utility files, components to component files, etc.)
- **File Quality Check**: Use context analysis to ensure target file has good structure and isn't overly complex
- **New File Suggestion**: If no suitable existing file found, suggest creating a new file with appropriate name and extension

INTELLIGENT MERGING GUIDELINES:
- When user asks to "update this section" or "add function X": Use intelligentCodeMerger with insertionContext
- When generated content contains complete file: Use intelligentCodeMerger to extract only new/changed parts
- When user wants to modify existing functionality: Use intelligentCodeMerger to replace specific sections
- When adding new features: Use intelligentCodeMerger to find optimal insertion points
- Always pass user's instruction as userInstruction parameter to intelligentCodeMerger
- If merger returns low confidence, provide both merged result and original full replacement as alternatives

DOCUMENTATION HANDLING:
- When user explicitly asks to "update README" or "add to documentation": Allow modifications to .md files
- When user asks to "document the new function" or similar: Update relevant documentation sections
- When user wants code examples in docs: Insert properly formatted code blocks in documentation files

FILE OPERATION EXAMPLES:
- "delete untitled files" → Use fileSystemExecutor with operation: 'list' to find untitled files, then 'delete'
- "rename this file" → Use fileSystemExecutor with operation: 'rename'
- "move file to components folder" → Use fileSystemExecutor with operation: 'move'
- "what files are in this project" → Use fileSystemExecutor with operation: 'list'

OUTPUT REQUIREMENTS:
- Generate clean, production-ready code
- Include proper imports and dependencies
- Add TypeScript types where applicable
- Include error handling where appropriate
- Provide clear explanation of the code's purpose
- Suggest file operations when beneficial
- Assess code quality metrics
- Include validation results if errors were found

Always start by explaining what you're going to do, then proceed with the implementation while providing progress updates.
Respond with a comprehensive JSON object matching the schema.`, 
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

    