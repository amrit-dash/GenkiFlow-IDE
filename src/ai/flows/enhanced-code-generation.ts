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

**🚨 CRITICAL PRIMARY RULE 🚨**
**YOUR MAIN PURPOSE IS CODE GENERATION. When users ask to "generate", "create", "write", "build", or "make" any code/script/component, you MUST:**
- **ALWAYS provide complete, working code in the 'code' field**
- **NEVER suggest creating files without actual code content**
- **Set 'isNewFile' to true when creating new files**
- **Set 'suggestedFileName' with appropriate name**
- **Fill 'code' field with the complete, functional code**

**MANDATORY CODE EXAMPLES:**
- "Generate a Python script" → MUST include full executable Python code
- "Create a web scraper" → MUST include complete scraper with imports and functions
- "Write a function" → MUST include the complete function implementation
- "Build a component" → MUST include complete component code

**SECONDARY FEATURES:** You can also suggest file operations and use various tools, but code generation is your PRIMARY purpose.

**STEP 1: OPTIONAL INTENT CLASSIFICATION**
For complex or ambiguous requests, you may use the intentClassifier tool to better understand the user's intent:

\`\`\`
intentClassifier({
  prompt: "{{{prompt}}}",
  context: {
    hasAttachedFiles: {{#if attachedFiles}}true{{else}}false{{/if}},
    attachedFilesInfo: "{{#if attachedFiles}}{{#each attachedFiles}}{{this.path}} ({{this.content.length}} chars){{#unless @last}}, {{/unless}}{{/each}}{{/if}}",
    currentFileName: "{{{currentFileName}}}",
    currentFilePath: "{{{currentFilePath}}}",
    hasFileContent: {{#if currentFileContent}}true{{else}}false{{/if}},
  }
})
\`\`\`

This can help guide your approach, but you should still follow the detailed instructions below.

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
ATTACHED FILES/FOLDERS CONTEXT:
The user has explicitly attached these items for context. Please prioritize understanding and working with these attached items:
{{/if}}

📎 ATTACHED ITEM {{@index}}: {{this.path}}
Content/Summary:
\`\`\`
{{{this.content}}}
\`\`\`

{{#unless @last}}---{{/unless}}
{{/each}}

⚠️ IMPORTANT: The user has specifically attached the above items. When they ask to "create a file", "rename this", "refactor", or perform any operations, they are likely referring to these attached items unless explicitly stated otherwise. Always consider these attached items as the primary context for the user's request.

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

🎯 **INTELLIGENT FILE RESOLUTION**: The AI should understand file references from context and suggest appropriate operations.

1.  **ATTACHED FILES PRIORITY**: If 'attachedFiles' are provided, they should be your PRIMARY target for operations:
    - For prompts like "create a new file", "add this code", "rename this" → Use the attached folder as the target location or attached file as the target
    - For code generation → Consider attached files as the primary context and reference point
    - For naming suggestions → Use attached items as the target to rename
    - For refactoring → Apply to attached files unless specified otherwise

2.  **CONTEXTUAL FILE REFERENCES**: When the user mentions specific files WITHOUT attaching them (e.g., "update the readme file", "modify package.json", "edit the main component"), you should:
    - Parse the file system tree to find files matching the reference
    - Look for common file patterns (readme, package.json, index, main, app, etc.)
    - Use fuzzy matching for file names (case-insensitive, with/without extensions)
    - If a clear match is found, suggest a file operation targeting that specific file
    - Show the current file content and ask what changes to make
    - Provide a confirmation step before making changes

3.  **COMMON FILE PATTERNS TO RECOGNIZE**:
    - "readme" → README.md, README.txt, readme.md, etc.
    - "package" → package.json, package-lock.json
    - "config" → config files, .env files, tsconfig.json, etc.
    - "main" → main.js, main.ts, index.js, index.ts, App.js, etc.
    - "component" names → Search for matching .tsx, .jsx, .vue files
    - Directory references → "src folder", "components folder", etc.

4.  **EXPLICIT CURRENT FILE REFERENCE**: Use 'currentFilePath' when the user explicitly mentions "current file", "active file", "the file in the editor", "this file", or similar clear references.

5.  **CONTEXTUAL INTELLIGENCE EXAMPLES**:
    - "update the readme file" → Find README.md in file system, suggest update operation
    - "modify the main component" → Find App.tsx/main.ts/index.js, suggest modification
    - "add to package.json" → Find package.json, suggest adding dependencies/scripts
    - "create a utils file" → Suggest creating utils.ts in appropriate directory
    - "rename the config file" → Find config files, suggest rename operation
    - "move the python script into the folder" → Find python files and recently created/mentioned folders, suggest move operation
    - "move X to Y" → Identify both source (X) and destination (Y) paths for move operation

6.  **OPERATION FLOW FOR CONTEXTUAL REFERENCES**:
    - Parse user prompt for file/folder references
    - Search file system tree for matching items
    - **FOR MOVE OPERATIONS**: Identify both source and destination:
      - Source: Look for files matching the description (e.g., "python script" → .py files)
      - Destination: Look for recently created folders or contextual references (e.g., "the folder" → most recently created folder or attached folder)
      - Set both targetPath (source) and destinationPath (destination) in fileOperationSuggestion
    - If found, populate targetPath with the resolved full path
    - For move operations, also populate destinationPath with the destination folder path
    - Suggest appropriate operation (update, rename, delete, move, etc.)
    - Include current file content in the operation data for context
    - Let the user confirm before proceeding

7.  **CONTEXTUAL REFERENCE RESOLUTION**:
    - "the file" → Most recently mentioned file or currently active file
    - "the folder" → Most recently created folder or attached folder
    - "the python script" → Find .py files in the project
    - "the component" → Find .tsx, .jsx, .vue files
    - "the config" → Find config files, .env files, etc.
    - **PRIORITY FOR CONTEXTUAL RESOLUTION**:
      1. Recently created items (from chat history context)
      2. Attached files/folders
      3. Currently active file/folder
      4. File system search by pattern matching

8.  **AMBIGUOUS CASES**: When multiple files could match or context is unclear, provide options and explain your reasoning in the file operation suggestion.

INSTRUCTIONS & TOOL USAGE:

**SCENARIO PRIORITIZATION ORDER:** Evaluate user requests in this order:

A. **PRIMARY SCENARIO - CODE GENERATION/MODIFICATION** (Handle FIRST for any requests about generating, creating, writing, or building CODE):
   This includes prompts like:
   - "Generate a Python script"
   - "Create a web scraper"
   - "Write a function"
   - "Build a component"
   - "Make a class"
   - "Code a solution"
   - Any request that asks for actual code content
   
   **🚨 MANDATORY STEPS FOR CODE GENERATION 🚨**
   1. Start with \`operationProgress\` (stage: 'starting').
   2. **ACTIVATE RAG SYSTEM**: Before generating code, use the \`codebaseDataset\` tool to index open files and then use \`codeRetriever\` to find relevant code examples:
      a. First, run \`codebaseDataset\` with operation 'create' or 'update' to ensure the current codebase is indexed
      b. Then use \`codeRetriever\` with a semantic query based on the user's request to find relevant examples
      c. Incorporate retrieved code examples and patterns into your generation
   3. Analyze context, requirements, and TARGET PRIORITIZATION. Use \`fileContextAnalyzer\` for existing files.
   4. If generating new code for a new file:
      a. **Set 'isNewFile' to true.**
      b. **Set 'suggestedFileName'** (use \`filenameSuggester\` if the user's prompt gives clues for a name, otherwise derive a sensible default like "web_scraper.py").
      c. **'targetPath' should be the directory for the new file.**
      d. **🚨 'code' MUST be the full content of the new file. This field is CRITICAL and cannot be null or omitted when 'isNewFile' is true. 🚨**
      e. **Example code that MUST be included**: Complete Python script with imports, functions, and executable code
   5. If modifying existing code:
      a. Set 'isNewFile' to false.
      b. 'targetPath' MUST be the path of the file being modified (respecting TARGET PRIORITIZATION).
      c. Use \`intelligentCodeMerger\` to integrate changes. 'code' field should contain the complete, merged content of the modified file.
   6. Provide a clear 'explanation' of the generated/modified code, including how retrieved examples influenced the solution.
   7. Use \`errorValidation\` on generated/merged code. If high-confidence fixes are available, apply them to the 'code' output and mention in 'explanation'.
   8. Use other tools as needed to fulfill the request. If suggesting a file operation as a *secondary step* to code generation (e.g. "Generated the code, and I suggest creating file X for it"), use the \`fileOperationSuggestion\` field.
   9. End with \`operationProgress\` (stage: 'completing').

B. **FILENAME SUGGESTION SCENARIO** (Only when specifically asking for name suggestions):
   This includes prompts like:
   - "suggest names for this file/folder"
   - "what should I call this component?"
   - "rename" (without specifying a new name)
   - "rename this" 
   - "rename this file"
   - "what should I rename this to?"
   - "give me name suggestions"
   
   1. Identify the target item for which names are being suggested (prioritizing attachments as per TARGET PRIORITIZATION). Get its content (for files) or summary (for folders) and its current name.
   2. Use the \`filenameSuggester\` tool with this information.
   3. **IMPORTANT FOR EMPTY FILES**: If the filenameSuggester tool returns analysis.detectedLanguage as null (for empty files), ensure you handle this gracefully. The tool should provide "unknown" or "text" as default values for empty files.
   4. Your *primary response* should be the direct output from \`filenameSuggester\`. Populate the 'filenameSuggestionData' field in your output with the tool's result.
   5. Set 'code' to null or empty.
   6. Set 'explanation' to a very brief confirmation (e.g., "Here are some name suggestions for [target_name]:").
   7. Set 'isNewFile' to **false**.
   8. Ensure 'targetPath' in your root output reflects the path of the item for which names were suggested.

C. **FILE OPERATION SCENARIO** (Direct file system commands or contextual file references):
   Examples: "rename file X to Y", "delete folder Z", "move file A to folder B", "update the readme file", "modify package.json", "edit the main component"
   
   1. Identify the target(s) and parameters, using this priority order:
      a. Attached items (if any)
      b. Contextual file references from the prompt (parse file system tree to find matches)
      c. Current file (if explicitly referenced)
   2. **FOR MOVE OPERATIONS SPECIFICALLY**:
      a. Identify the SOURCE item (what to move):
         - Look for file patterns in the prompt (e.g., "python script" → .py files)
         - Use file system tree to find matching files
         - Set this as 'targetPath' in fileOperationSuggestion
      b. Identify the DESTINATION (where to move it):
         - Look for folder references (e.g., "the folder", "into X folder")
         - Check recently created folders from chat history
         - Check attached folders
         - Use file system tree to find matching folders
         - Set this as 'destinationPath' in fileOperationSuggestion
      c. BOTH targetPath AND destinationPath MUST be set for move operations
   3. For CONTEXTUAL FILE REFERENCES without specific operations:
      a. Parse the file system tree to find files matching the user's reference
      b. Use fuzzy matching for common patterns (readme → README.md, package → package.json, etc.)
      c. If found, suggest an 'update'/'modify' operation targeting that specific file
      d. Include the current file content in your reasoning
      e. Ask the user what specific changes they want to make
   4. Your *primary output* MUST be through the 'fileOperationSuggestion' field. Ensure all required sub-fields (type, reasoning, confidence) are provided.
   5. 'targetPath' in 'fileOperationSuggestion' must be the FULL PATH of the item being operated on (from file system tree search).
   6. For contextual updates, set operation type to 'rename' if they want to rename, or prepare for content modification.
   7. Set 'code' to null or empty initially - the user will specify changes in the confirmation step.
   8. Set 'explanation' to a clear statement of what file was found and what operation is suggested.
   9. Set 'isNewFile' to **false**.
   10. Ensure 'targetPath' in your root output reflects the path of the resolved item.
   1. Start with \`operationProgress\` (stage: 'starting').
   2. **ACTIVATE RAG SYSTEM**: Before generating code, use the \`codebaseDataset\` tool to index open files and then use \`codeRetriever\` to find relevant code examples:
      a. First, run \`codebaseDataset\` with operation 'create' or 'update' to ensure the current codebase is indexed
      b. Then use \`codeRetriever\` with a semantic query based on the user's request to find relevant examples
      c. Incorporate retrieved code examples and patterns into your generation
   3. Analyze context, requirements, and TARGET PRIORITIZATION. Use \`fileContextAnalyzer\` for existing files.
   4. If generating new code for a new file:
      a. Set 'isNewFile' to true.
      b. Set 'suggestedFileName' (use \`filenameSuggester\` if the user's prompt gives clues for a name, otherwise derive a sensible default like "newComponent.tsx").
      c. 'targetPath' should be the directory for the new file.
      d. **'code' MUST be the full content of the new file. This field is CRITICAL and cannot be null or omitted when 'isNewFile' is true. The primary purpose of this request type is to obtain this code.**
      e. **MANDATORY CODE GENERATION**: When the user asks to "generate", "create", or "write" code, you MUST provide complete, working code in the 'code' field. Never suggest a file without providing the actual code content.
      f. **Example code requests that MUST include code**: "Generate a Python script", "Create a web scraper", "Write a function", "Build a component", etc.
   5. If modifying existing code:
      a. Set 'isNewFile' to false.
      b. 'targetPath' MUST be the path of the file being modified (respecting TARGET PRIORITIZATION).
      c. Use \`intelligentCodeMerger\` to integrate changes. 'code' field should contain the complete, merged content of the modified file.
   6. Provide a clear 'explanation' of the generated/modified code, including how retrieved examples influenced the solution.
   7. Use \`errorValidation\` on generated/merged code. If high-confidence fixes are available, apply them to the 'code' output and mention in 'explanation'.
   8. Use other tools (\`codebaseSearch\`, \`codeUsageAnalysis\`, \`terminalOperations\`, \`fileSystemExecutor\`) as needed to fulfill the request. If suggesting a file operation as a *secondary step* to code generation (e.g. "Generated the code, and I suggest creating file X for it"), use the \`fileOperationSuggestion\` field.
   9. End with \`operationProgress\` (stage: 'completing').

GENERAL OUTPUT REQUIREMENTS:
- For scenario A (code generation), 'code', 'isNewFile', 'targetPath', and 'explanation' are key. **IF 'isNewFile' IS TRUE, THE 'code' FIELD IS MANDATORY.**
- For scenario B (filename suggestions), prioritize 'filenameSuggestionData'. 'code' should be null/empty, 'isNewFile' false, and 'explanation' concise.
- For scenario C (file operations), prioritize 'fileOperationSuggestion'. 'code' should be null/empty, 'isNewFile' false, and 'explanation' concise.
- Always ensure 'targetPath' in the root of your response correctly reflects the primary file/folder being acted upon or targeted.
- If 'isNewFile' is true, 'suggestedFileName' is expected. If 'isNewFile' is false, 'suggestedFileName' can be null.
- If no specific code generation is required or file operation is suggested (e.g., a general question or clarification), respond with a helpful 'explanation' and ensure 'code' and 'fileOperationSuggestion' are null or omitted. 'isNewFile' should be false.
- Ensure any optional objects like 'codeQuality' or 'alternativeOptions', if included, are fully populated according to their schemas or omitted entirely. Do not provide partially filled optional objects. If an optional field of type array or object is not applicable, omit the field entirely rather than setting it to null.
- **RAG Integration**: When code is generated using retrieved examples, mention this in the 'explanation' field to show how the RAG system enhanced the solution.

Respond with a comprehensive JSON object matching the EnhancedGenerateCodeOutputSchema.`,
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
        // Return an explanation to the user that code was expected but not provided
        return {
          ...cleanedOutput, // Keep other suggestions if any
          code: null, // Ensure code is null
          explanation: cleanedOutput.explanation ? 
            `${cleanedOutput.explanation}\n\nHowever, the AI did not provide the actual code content for the new file. You might need to ask for the code specifically.` :
            "The AI suggested creating a new file but didn't provide the code content. Please try asking for the code itself.",
        };
      }

      // *** ENHANCED FILE OPERATION HANDLING ***
      // Ensure proper file operation suggestions are set up for client-side execution
      if (cleanedOutput.code && cleanedOutput.code.trim() !== "") {
        
        // SCENARIO 1: Creating a new file
        if (cleanedOutput.isNewFile) {
          if (cleanedOutput.suggestedFileName && cleanedOutput.targetPath) {
            // Ensure we have a proper file operation suggestion for creation
            if (!cleanedOutput.fileOperationSuggestion) {
              cleanedOutput.fileOperationSuggestion = {
                type: 'create',
                reasoning: `Create new file ${cleanedOutput.suggestedFileName} with the generated code`,
                targetPath: cleanedOutput.targetPath,
                newName: cleanedOutput.suggestedFileName,
                fileType: 'file',
                content: cleanedOutput.code,
                confidence: 0.9,
              };
            }
            // Ensure existing suggestion has content
            if (cleanedOutput.fileOperationSuggestion && !cleanedOutput.fileOperationSuggestion.content) {
              cleanedOutput.fileOperationSuggestion.content = cleanedOutput.code;
            }
            
            // Enhance explanation with file creation info
            cleanedOutput.explanation = (cleanedOutput.explanation || '') + 
              `\n\n📄 Ready to create: ${cleanedOutput.suggestedFileName}`;
          }
        } 
        // SCENARIO 2: Modifying existing file (code merging scenario)
        else if (cleanedOutput.targetPath) {
          // Check if we have existing content to merge with
          let hasExistingContent = false;
          if (input.currentFilePath === cleanedOutput.targetPath && input.currentFileContent) {
            hasExistingContent = true;
          } else {
            // Check attached files
            const attachedFile = input.attachedFiles?.find(f => f.path === cleanedOutput.targetPath);
            if (attachedFile) {
              hasExistingContent = true;
            }
          }

          if (hasExistingContent) {
            // This is a code merging scenario - the client will handle the merge
            cleanedOutput.explanation = (cleanedOutput.explanation || '') + 
              `\n\n🔀 Ready to merge code into: ${cleanedOutput.targetPath.split('/').pop()}`;
              
            // Ensure we have a file operation suggestion for updating
            if (!cleanedOutput.fileOperationSuggestion) {
              cleanedOutput.fileOperationSuggestion = {
                type: 'create', // Using 'create' as a generic update operation the client will interpret correctly
                reasoning: `Apply generated code to existing file ${cleanedOutput.targetPath}`,
                targetPath: cleanedOutput.targetPath,
                content: cleanedOutput.code,
                confidence: 0.8,
              };
            }
            // Ensure existing suggestion has content
            if (cleanedOutput.fileOperationSuggestion && !cleanedOutput.fileOperationSuggestion.content) {
              cleanedOutput.fileOperationSuggestion.content = cleanedOutput.code;
            }
          } else {
            // No existing content found, treat as new file creation
            const fileName = cleanedOutput.targetPath.split('/').pop() || 'newfile.txt';
            cleanedOutput.isNewFile = true;
            cleanedOutput.suggestedFileName = fileName;
            cleanedOutput.fileOperationSuggestion = {
              type: 'create',
              reasoning: `Create new file as existing content was not found`,
              targetPath: cleanedOutput.targetPath.substring(0, cleanedOutput.targetPath.lastIndexOf('/')) || '/',
              newName: fileName,
              fileType: 'file',
              content: cleanedOutput.code,
              confidence: 0.7,
            };
            cleanedOutput.explanation = (cleanedOutput.explanation || '') + 
              `\n\n📄 Creating new file: ${fileName} (existing content not accessible)`;
          }
        }
        // SCENARIO 3: Code generation without specific target (default new file)
        else if (!cleanedOutput.targetPath && cleanedOutput.isNewFile) {
          // Generate a default filename if not provided
          if (!cleanedOutput.suggestedFileName) {
            // Try to derive filename from prompt or code content
            const promptLower = input.prompt.toLowerCase();
            if (promptLower.includes('python') || promptLower.includes('.py')) {
              cleanedOutput.suggestedFileName = 'script.py';
            } else if (promptLower.includes('javascript') || promptLower.includes('js')) {
              cleanedOutput.suggestedFileName = 'script.js';
            } else if (promptLower.includes('typescript') || promptLower.includes('ts')) {
              cleanedOutput.suggestedFileName = 'script.ts';
            } else if (promptLower.includes('component') || promptLower.includes('react')) {
              cleanedOutput.suggestedFileName = 'Component.tsx';
            } else {
              cleanedOutput.suggestedFileName = 'generated_code.txt';
            }
          }
          
          cleanedOutput.targetPath = '/'; // Root directory as default
          cleanedOutput.fileOperationSuggestion = {
            type: 'create',
            reasoning: `Create new file with generated code`,
            targetPath: '/',
            newName: cleanedOutput.suggestedFileName,
            fileType: 'file',
            content: cleanedOutput.code,
            confidence: 0.8,
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

    