'use server';
/**
 * @fileOverview Summarizes a code snippet provided by the user.
 *
 * - summarizeCodeSnippet - A function that takes a code snippet and returns a summary.
 * - SummarizeCodeSnippetInput - The input type for the summarizeCodeSnippet function.
 * - SummarizeCodeSnippetOutput - The return type for the summarizeCodeSnippet function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCodeSnippetInputSchema = z.object({
  codeSnippet: z
    .string()
    .describe('The code snippet to summarize.'),
});
export type SummarizeCodeSnippetInput = z.infer<typeof SummarizeCodeSnippetInputSchema>;

const SummarizeCodeSnippetOutputSchema = z.object({
  summary: z.string().describe('A summary of the code snippet.'),
});
export type SummarizeCodeSnippetOutput = z.infer<typeof SummarizeCodeSnippetOutputSchema>;

export async function summarizeCodeSnippet(input: SummarizeCodeSnippetInput): Promise<SummarizeCodeSnippetOutput> {
  return summarizeCodeSnippetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCodeSnippetPrompt',
  input: {schema: SummarizeCodeSnippetInputSchema},
  output: {schema: SummarizeCodeSnippetOutputSchema},
  prompt: `You are an expert software developer. Please summarize the following code snippet in a way that is easy to understand.

Code Snippet:
{{codeSnippet}}`,
});

const summarizeCodeSnippetFlow = ai.defineFlow(
  {
    name: 'summarizeCodeSnippetFlow',
    inputSchema: SummarizeCodeSnippetInputSchema,
    outputSchema: SummarizeCodeSnippetOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
