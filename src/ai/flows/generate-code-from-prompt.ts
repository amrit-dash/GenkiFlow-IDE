
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
  prompt: `You are an expert code generation assistant.
User Prompt: {{{prompt}}}

Current File Context (if available, this is the file open in the editor):
File Path: {{{currentFilePath}}}
File Content:
\`\`\`
{{{currentFileContent}}}
\`\`\`

{{#if attachedFiles.length}}
Additional Context from Attached Files:
{{#each attachedFiles}}
File Path: {{this.path}}
File Content:
\`\`\`
{{{this.content}}}
\`\`\`
---
{{/each}}
{{/if}}

Analyze the user's prompt and ALL available context (current editor file AND any attached files).
Determine if the request is for:
1.  A completely new file/script.
2.  An addition or modification to the 'currentFileContent' (if provided and relevant).
3.  An addition or modification to one of the 'attachedFiles.content' (if provided and relevant).
4.  A general code snippet not specific to any existing file.

Your 'code' output:
- If for a new file: Generate the complete content for this new file.
- If an edit/addition to 'currentFileContent': Generate the relevant code block, or if more appropriate, the ENTIRE modified 'currentFileContent'. Set 'targetPath' to '{{currentFilePath}}'.
- If an edit/addition to one of the 'attachedFiles.content': Generate the relevant code block, or if more appropriate, the ENTIRE modified content for THAT specific attached file. Set 'targetPath' to the path of THAT attached file.
- If a general snippet: Generate the code snippet. 'targetPath' can be omitted.

Response Format:
- Set 'isNewFile' to true if the request implies creating a new file. In this case, also provide a 'suggestedFileName' (e.g., 'utility.py', 'MyComponent.tsx', 'styles.css'). 'targetPath' should be omitted or null.
- Set 'isNewFile' to false if the request is to modify or add to an existing file or if it's a general snippet.
- If modifying an existing file (current or attached), 'targetPath' MUST be set to the path of the file being modified.

Prioritize generating functional, clean, and contextually appropriate code.
Respond ONLY with the JSON output matching the schema.
`, config: {
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
