/**
 * @fileOverview Intelligent Code Merger - Analyzes and merges generated code with existing files
 * 
 * This tool compares existing file content with AI-generated content and determines
 * the best way to merge them - whether to insert, update, replace, or append content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentCodeMergerInputSchema = z.object({
  existingContent: z.string().describe('Current content of the file'),
  generatedContent: z.string().describe('AI-generated content to be merged'),
  fileName: z.string().describe('Name of the file being modified'),
  fileExtension: z.string().describe('File extension (e.g., .ts, .py, .md)'),
  userInstruction: z.string().optional().describe('User instruction about what they wanted to generate/modify'),
  insertionContext: z.string().optional().describe('Context about where the code should be inserted'),
});

const MergeOperationSchema = z.object({
  type: z.enum(['insert', 'replace', 'append', 'prepend', 'update_section']),
  targetLineNumber: z.number().optional().describe('Line number where operation should occur'),
  startLineNumber: z.number().optional().describe('Start line for section replacement'),
  endLineNumber: z.number().optional().describe('End line for section replacement'),
  insertionPoint: z.string().optional().describe('Text pattern to find insertion point'),
  reasoning: z.string().describe('Why this merge strategy was chosen'),
});

const IntelligentCodeMergerOutputSchema = z.object({
  mergedContent: z.string().describe('The final merged content'),
  operations: z.array(MergeOperationSchema).describe('List of operations performed'),
  summary: z.string().describe('Summary of changes made'),
  confidence: z.number().min(0).max(1).describe('Confidence in the merge strategy'),
  warnings: z.array(z.string()).optional().describe('Any potential issues or warnings'),
  preservedSections: z.array(z.string()).optional().describe('Important sections that were preserved'),
});

export type IntelligentCodeMergerInput = z.infer<typeof IntelligentCodeMergerInputSchema>;
export type IntelligentCodeMergerOutput = z.infer<typeof IntelligentCodeMergerOutputSchema>;

const intelligentCodeMergerPrompt = ai.definePrompt({
  name: 'intelligentCodeMergerPrompt',
  input: {schema: IntelligentCodeMergerInputSchema},
  output: {schema: IntelligentCodeMergerOutputSchema},
  prompt: `You are an expert code merger that intelligently combines existing file content with AI-generated content.

EXISTING FILE CONTENT:
\`\`\`{{{fileExtension}}}
{{{existingContent}}}
\`\`\`

GENERATED CONTENT TO MERGE:
\`\`\`{{{fileExtension}}}
{{{generatedContent}}}
\`\`\`

FILE: {{{fileName}}}
{{#if userInstruction}}
USER INSTRUCTION: {{{userInstruction}}}
{{/if}}
{{#if insertionContext}}
INSERTION CONTEXT: {{{insertionContext}}}
{{/if}}

ANALYSIS FRAMEWORK:

1. **CONTENT ANALYSIS**:
   - Identify what's new in generated content vs existing content
   - Find overlapping/duplicate sections
   - Detect if generated content is partial update or complete replacement
   - Analyze code structure (functions, classes, imports, etc.)

2. **MERGE STRATEGIES**:
   - **INSERT**: Add new content at specific location (new functions, imports, etc.)
   - **REPLACE**: Replace specific sections that have been updated
   - **APPEND**: Add new content at end of file
   - **PREPEND**: Add new content at beginning of file  
   - **UPDATE_SECTION**: Update specific section while preserving surrounding code

3. **SMART INSERTION LOGIC**:
   - For functions: Insert after similar functions or in appropriate section
   - For imports: Add to existing import block at top
   - For classes: Insert in logical grouping
   - For documentation: Update relevant sections inline
   - For configuration: Merge with existing config objects

4. **PRESERVATION PRIORITIES**:
   - Preserve existing comments and documentation
   - Maintain existing code formatting and style
   - Keep important metadata (file headers, licenses)
   - Preserve working functionality
   - Maintain import order and organization

5. **FILE TYPE SPECIFIC RULES**:
   
   **TypeScript/JavaScript**:
   - Group imports at top
   - Maintain function/class organization
   - Preserve existing type definitions
   - Insert new functions near related ones
   
   **Python**:
   - Maintain import order (standard, third-party, local)
   - Group functions by purpose
   - Preserve docstrings and comments
   - Insert new functions in logical sections
   
   **Markdown**:
   - Insert new sections in appropriate hierarchy
   - Preserve existing structure and links
   - Update tables of contents if present
   - Maintain consistent formatting
   
   **JSON/YAML**:
   - Merge objects intelligently
   - Preserve existing structure
   - Add new keys in logical groupings
   - Maintain consistent formatting

6. **CONFLICT RESOLUTION**:
   - If functions/classes have same name, prefer generated version with warning
   - If imports conflict, merge them intelligently
   - If documentation sections overlap, merge content thoughtfully
   - If configuration conflicts, prefer generated with warning

OPERATION EXAMPLES:

**Scenario 1: Adding new function to existing file**
- Operation: "insert"
- Find related functions or end of function section
- Insert with proper spacing and context

**Scenario 2: Updating existing function**
- Operation: "replace" 
- Find exact function boundaries
- Replace only that function, preserve others

**Scenario 3: Adding to documentation**
- Operation: "update_section"
- Find relevant section header
- Insert new content in appropriate subsection

**Scenario 4: Updating configuration**
- Operation: "update_section" or "replace"
- Merge configuration objects intelligently
- Preserve existing settings where possible

OUTPUT REQUIREMENTS:
- Generate complete merged content that's immediately usable
- Provide clear reasoning for merge strategy chosen
- List all operations performed for transparency
- Include warnings for potential issues
- Report confidence level in merge quality

QUALITY CHECKS:
- Ensure syntax is valid after merge
- Verify no important content was lost
- Check that generated content is properly integrated
- Confirm file structure remains logical
- Validate that imports/dependencies are correct

Return a comprehensive analysis and the merged result.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT', 
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

export const intelligentCodeMerger = ai.defineTool(
  {
    name: 'intelligentCodeMerger',
    description: 'Intelligently merges AI-generated code with existing file content, performing smart insertions, updates, or replacements based on context analysis.',
    inputSchema: IntelligentCodeMergerInputSchema,
    outputSchema: IntelligentCodeMergerOutputSchema,
  },
  async (input) => {
    const result = await intelligentCodeMergerPrompt(input);
    return result.output!;
  }
); 