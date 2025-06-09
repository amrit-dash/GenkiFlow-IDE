
'use server';
/**
 * @fileOverview An AI agent that generates code based on a prompt, with context awareness for new files vs. edits, and can use explicitly attached files for context.
 *
 * - generateCode - A function that handles the code generation process.
 * - GenerateCodeInput - The input type for the generateCode function.
 * - GenerateCodeOutput - The return type for the generateCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AttachedFileSchema = z.object({
  path: z.string().describe('Path of the attached file.'),
  content: z.string().describe('Content of the attached file.')
});

const GenerateCodeInputSchema = z.object({
  prompt: z.string().describe('The prompt to generate code from.'),
  currentFilePath: z.string().optional().describe('The path of the currently active file in the editor, if any.'),
  currentFileContent: z.string().optional().describe('The content of the currently active file, if any.'),
  attachedFiles: z.array(AttachedFileSchema).optional().describe('Explicitly attached files provided by the user for additional context (max 3).'),
});
export type GenerateCodeInput = z.infer<typeof GenerateCodeInputSchema>;

const GenerateCodeOutputSchema = z.object({
  code: z.string().describe('The generated code. This could be a new file content, a snippet, or the modified content of an existing file.'),
  isNewFile: z.boolean().describe('Indicates if the generated code is intended for a new file.'),
  suggestedFileName: z.string().optional().describe('A suggested filename if isNewFile is true. Will include extension.'),
  targetPath: z.string().optional().describe('If the code is an edit for an existing file (current or attached), this specifies its path.'),
});
export type GenerateCodeOutput = z.infer<typeof GenerateCodeOutputSchema>;

export async function generateCode(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  return generateCodeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCodePrompt',
  input: {schema: GenerateCodeInputSchema},
  output: {schema: GenerateCodeOutputSchema},
  prompt: `You are an expert code generation assistant with deep understanding of software architecture, best practices, and contextual code generation.

User Prompt: {{{prompt}}}

CURRENT CONTEXT:
File Path: {{{currentFilePath}}}
File Content:
\`\`\`
{{{currentFileContent}}}
\`\`\`

{{#if attachedFiles.length}}
ATTACHED FILES CONTEXT:
{{#each attachedFiles}}
File: {{this.path}}
Content:
\`\`\`
{{{this.content}}}
\`\`\`
---
{{/each}}
{{/if}}

ANALYSIS INSTRUCTIONS:
1. Examine the user prompt for intent and context clues
2. Consider the current file state and content
3. Analyze attached files for additional context
4. Determine the most appropriate action:
   - NEW FILE: For standalone functionality, different language/framework, or when current context doesn't match
   - MODIFY EXISTING: For enhancements, additions, or modifications to current/attached files
   - CODE SNIPPET: For general examples or reusable code blocks

CONTEXTUAL CONSIDERATIONS:
- If current file is blank/untitled: Consider renaming to match generated code purpose
- If language/framework mismatch: Suggest new file with appropriate extension
- If code doesn't logically fit current file: Recommend new file creation
- If enhancing existing functionality: Modify current or attached file appropriately

QUALITY REQUIREMENTS:
- Generate production-ready, well-documented code
- Include proper TypeScript types when applicable
- Add appropriate imports and dependencies
- Implement proper error handling
- Follow modern coding standards and best practices
- Ensure code is contextually appropriate and functional

OUTPUT GUIDELINES:
- isNewFile: true for new files, false for modifications/snippets
- suggestedFileName: Provide when isNewFile=true (include proper extension)
- targetPath: Set when modifying existing files (current or attached)
- code: Complete file content for new files, or targeted modifications for existing files

SPECIAL CASES:
- Blank files: Generate content AND suggest appropriate filename
- Mismatched contexts: Recommend new file with proper extension
- Large implementations: Consider breaking into multiple logical components
- Framework-specific code: Ensure proper project structure and conventions

Generate clean, functional code that integrates well with the existing codebase context.
Respond with JSON matching the schema.`, 
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

const generateCodeFlow = ai.defineFlow(
  {
    name: 'generateCodeFlow',
    inputSchema: GenerateCodeInputSchema,
    outputSchema: GenerateCodeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
