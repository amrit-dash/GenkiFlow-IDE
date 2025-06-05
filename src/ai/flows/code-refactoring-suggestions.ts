'use server';
/**
 * @fileOverview This file defines a Genkit flow for providing code refactoring suggestions.
 *
 * - codeRefactoringSuggestions: The main function to trigger the refactoring suggestion flow.
 * - CodeRefactoringSuggestionsInput: The input type for the codeRefactoringSuggestions function.
 * - CodeRefactoringSuggestionsOutput: The output type for the codeRefactoringSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CodeRefactoringSuggestionsInputSchema = z.object({
  codeSnippet: z.string().describe('The code snippet to be refactored.'),
  fileContext: z.string().describe('The context of the code snippet, including the file it belongs to and surrounding code.'),
});
export type CodeRefactoringSuggestionsInput = z.infer<typeof CodeRefactoringSuggestionsInputSchema>;

const CodeRefactoringSuggestionsOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      description: z.string().describe('A description of the refactoring suggestion.'),
      proposedCode: z.string().describe('The proposed refactored code.'),
    })
  ).describe('A list of refactoring suggestions.'),
});
export type CodeRefactoringSuggestionsOutput = z.infer<typeof CodeRefactoringSuggestionsOutputSchema>;

export async function codeRefactoringSuggestions(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
  return codeRefactoringSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'codeRefactoringSuggestionsPrompt',
  input: {schema: CodeRefactoringSuggestionsInputSchema},
  output: {schema: CodeRefactoringSuggestionsOutputSchema},
  prompt: `You are an AI code assistant that suggests refactoring improvements for given code snippets.

  Analyze the provided code snippet within its file context and suggest specific, actionable refactoring improvements.
  Each suggestion should include a clear description of the refactoring and the proposed code.

  Code Snippet:
  {{codeSnippet}}

  File Context:
  {{fileContext}}

  Focus on improvements related to:
  - Readability
  - Maintainability
  - Performance
  - Security
  - Modernization (e.g., using newer language features)

  Present the suggestions as a JSON array of objects, each with a 'description' and 'proposedCode' field.
  Ensure the 'proposedCode' is a valid code snippet that can replace the original code.
  Do not include any explanations or conversational text, only the JSON output.
  `,config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

const codeRefactoringSuggestionsFlow = ai.defineFlow(
  {
    name: 'codeRefactoringSuggestionsFlow',
    inputSchema: CodeRefactoringSuggestionsInputSchema,
    outputSchema: CodeRefactoringSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
