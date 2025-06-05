// src/ai/flows/find-codebase-examples.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow to find examples of how a specific function or component is used within the codebase.
 *
 * findCodebaseExamples - A function that orchestrates the process of finding codebase examples.
 * FindCodebaseExamplesInput - The input type for the findCodebaseExamples function.
 * FindCodebaseExamplesOutput - The return type for the findCodebaseExamples function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindCodebaseExamplesInputSchema = z.object({
  query: z.string().describe('The function or component to find examples of.'),
});
export type FindCodebaseExamplesInput = z.infer<typeof FindCodebaseExamplesInputSchema>;

const FindCodebaseExamplesOutputSchema = z.object({
  examples: z.array(z.string()).describe('Examples of how the function or component is used within the codebase.'),
});
export type FindCodebaseExamplesOutput = z.infer<typeof FindCodebaseExamplesOutputSchema>;

import {codebaseSearch} from '../tools/codebase-search';

export async function findCodebaseExamples(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  return findCodebaseExamplesFlow(input);
}

const findCodebaseExamplesPrompt = ai.definePrompt({
  name: 'findCodebaseExamplesPrompt',
  input: {schema: FindCodebaseExamplesInputSchema},
  output: {schema: FindCodebaseExamplesOutputSchema},
  tools: [codebaseSearch],
  prompt: `You are an AI assistant helping a developer find examples of how a particular function or component is used within the codebase.

  The developer is looking for examples of how to use: {{{query}}}

  Use the codebaseSearch tool to find relevant examples in the codebase. Return a diverse set of examples with a brief description of what the example does.
  `,
});

const findCodebaseExamplesFlow = ai.defineFlow(
  {
    name: 'findCodebaseExamplesFlow',
    inputSchema: FindCodebaseExamplesInputSchema,
    outputSchema: FindCodebaseExamplesOutputSchema,
  },
  async input => {
    const {output} = await findCodebaseExamplesPrompt(input);
    return output!;
  }
);
