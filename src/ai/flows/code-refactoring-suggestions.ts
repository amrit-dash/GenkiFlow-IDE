
'use server';
/**
 * @fileOverview This file defines a Genkit flow for providing a single best code refactoring suggestion.
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

const SingleSuggestionSchema = z.object({
  description: z.string().describe('A description of the refactoring suggestion.'),
  proposedCode: z.string().describe('The proposed refactored code, which should be the complete refactored version of the input codeSnippet.'),
});

const CodeRefactoringSuggestionsOutputSchema = z.object({
  suggestion: SingleSuggestionSchema.optional().describe('The single best refactoring suggestion. Omit or return null if no significant refactoring is beneficial.'),
});
export type CodeRefactoringSuggestionsOutput = z.infer<typeof CodeRefactoringSuggestionsOutputSchema>;

export async function codeRefactoringSuggestions(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
  return codeRefactoringSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'codeRefactoringSuggestionsPrompt',
  input: {schema: CodeRefactoringSuggestionsInputSchema},
  output: {schema: CodeRefactoringSuggestionsOutputSchema},
  prompt: `You are an AI code assistant that provides the single best refactoring improvement for a given code snippet.

  Analyze the provided code snippet within its file context and determine the most impactful refactoring improvement.
  Your response should be a JSON object containing a 'suggestion' field. This 'suggestion' object should have:
  - 'description': A clear description of the refactoring.
  - 'proposedCode': The complete refactored version of the original 'codeSnippet'. This 'proposedCode' should be a valid code snippet that can directly replace the original 'codeSnippet'.

  Code Snippet:
  \`\`\`
  {{codeSnippet}}
  \`\`\`

  File Context:
  \`\`\`
  {{fileContext}}
  \`\`\`

  Focus on improvements related to:
  - Readability
  - Maintainability
  - Performance
  - Security
  - Modernization (e.g., using newer language features)

  If multiple improvements are possible, synthesize them into one optimal suggestion or pick the most impactful one.
  If no significant refactoring is beneficial, you can omit the 'suggestion' field in your JSON response or return it as null.
  Do not include any explanations or conversational text, only the JSON output matching the schema.
  Example JSON for a suggestion:
  {
    "suggestion": {
      "description": "Improved loop efficiency and clarity.",
      "proposedCode": "const newArray = oldArray.map(item => item * 2);"
    }
  }
  Example JSON if no suggestion:
  {
    "suggestion": null
  }
  OR just:
  {}
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

