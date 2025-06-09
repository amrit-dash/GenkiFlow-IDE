
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
  prompt: `You are an expert AI code refactoring specialist with deep knowledge of software engineering best practices, design patterns, and modern programming paradigms.

ANALYSIS TARGET:
Code Snippet:
\`\`\`
{{codeSnippet}}
\`\`\`

File Context:
\`\`\`
{{fileContext}}
\`\`\`

REFACTORING ASSESSMENT CRITERIA:
1. **Code Quality**: Readability, maintainability, and clarity
2. **Performance**: Efficiency improvements and optimization opportunities  
3. **Security**: Vulnerability mitigation and secure coding practices
4. **Modernization**: Latest language features and best practices
5. **Architecture**: Design patterns and structural improvements
6. **TypeScript Enhancement**: Better type safety and type definitions
7. **Error Handling**: Robust exception management and validation
8. **Testing**: Testability and debugging improvements

EVALUATION PROCESS:
- Analyze code structure, patterns, and potential issues
- Identify the most impactful improvement opportunity
- Consider maintainability vs. complexity trade-offs
- Ensure refactored code maintains original functionality
- Prioritize changes that provide maximum benefit with minimal risk

OUTPUT REQUIREMENTS:
- Provide ONE comprehensive refactoring suggestion (most impactful)
- Include clear reasoning for the suggested changes
- Ensure refactored code is production-ready and well-documented
- Maintain backward compatibility where possible
- Focus on meaningful improvements over cosmetic changes

RESPONSE FORMAT:
Generate a JSON object with a 'suggestion' field containing:
- 'description': Detailed explanation of the refactoring and its benefits
- 'proposedCode': Complete refactored version that directly replaces the original code

If the code is already well-optimized and no significant improvements are beneficial:
- Return {"suggestion": null} or {}

QUALITY STANDARDS:
- Ensure refactored code follows modern best practices
- Include proper TypeScript types if applicable
- Add meaningful comments for complex logic
- Implement proper error handling
- Consider edge cases and validation
- Maintain or improve code performance

Example high-quality suggestion:
{
  "suggestion": {
    "description": "Refactored to use modern async/await pattern with proper error handling, TypeScript types, and performance optimization through early returns and input validation.",
    "proposedCode": "// Refactored implementation here"
  }
}

Respond ONLY with JSON matching the schema.`,
  config: {
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

