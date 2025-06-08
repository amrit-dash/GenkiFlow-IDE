
'use server';
/**
 * @fileOverview An AI agent that generates code based on a prompt, with context awareness for new files vs. edits.
 *
 * - generateCode - A function that handles the code generation process.
 * - GenerateCodeInput - The input type for the generateCode function.
 * - GenerateCodeOutput - The return type for the generateCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCodeInputSchema = z.object({
  prompt: z.string().describe('The prompt to generate code from.'),
  currentFilePath: z.string().optional().describe('The path of the currently active file in the editor, if any.'),
  currentFileContent: z.string().optional().describe('The content of the currently active file, if any.'),
});
export type GenerateCodeInput = z.infer<typeof GenerateCodeInputSchema>;

const GenerateCodeOutputSchema = z.object({
  code: z.string().describe('The generated code. This could be a new file content, a snippet, or the modified content of an existing file.'),
  isNewFile: z.boolean().describe('Indicates if the generated code is intended for a new file.'),
  suggestedFileName: z.string().optional().describe('A suggested filename if isNewFile is true. Will include extension.'),
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

Current File Context (if available):
File Path: {{{currentFilePath}}}
File Content:
\`\`\`
{{{currentFileContent}}}
\`\`\`

Analyze the user's prompt and the current file context. Determine if the request is for:
1.  A completely new file/script.
2.  An addition or modification to the existing code in 'currentFileContent'.

Your 'code' output:
- If for a new file: Generate the complete content for this new file.
- If an edit/addition: Generate the relevant code block, or if more appropriate, the ENTIRE modified 'currentFileContent' with your changes seamlessly integrated.

Response Format:
- Set 'isNewFile' to true if the request implies creating a new file. In this case, also provide a 'suggestedFileName' (e.g., 'utility.py', 'MyComponent.tsx', 'styles.css').
- Set 'isNewFile' to false if the request is to modify or add to the 'currentFileContent'. 'suggestedFileName' can be omitted or null.

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

