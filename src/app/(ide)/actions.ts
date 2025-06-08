
"use server";

import { 
  summarizeCodeSnippet, 
  type SummarizeCodeSnippetInput, 
  type SummarizeCodeSnippetOutput 
} from '@/ai/flows/summarize-code-snippet';
import { 
  generateCode, 
  type GenerateCodeInput, 
  type GenerateCodeOutput 
} from '@/ai/flows/generate-code-from-prompt';
import { 
  codeRefactoringSuggestions, 
  type CodeRefactoringSuggestionsInput, 
  type CodeRefactoringSuggestionsOutput 
} from '@/ai/flows/code-refactoring-suggestions';
import { 
  findCodebaseExamples, 
  type FindCodebaseExamplesInput, 
  type FindCodebaseExamplesOutput 
} from '@/ai/flows/find-codebase-examples';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for Genkit-like error structure with details
    // @ts-ignore
    if (typeof error.details === 'string') {
      try {
        // @ts-ignore
        const parsedDetails = JSON.parse(error.details);
        if (parsedDetails && parsedDetails.message) {
          return parsedDetails.message;
        }
        // @ts-ignore
        return error.details; // Return details string if not JSON or no message
      } catch (e) {
        // @ts-ignore
        return error.details; // Fallback to details string if JSON parsing fails
      }
    }
    return error.message;
  }
  return String(error);
}

export async function summarizeCodeSnippetServer(input: SummarizeCodeSnippetInput): Promise<SummarizeCodeSnippetOutput> {
  try {
    return await summarizeCodeSnippet(input);
  } catch (error) {
    console.error("Error in summarizeCodeSnippetServer:", error);
    const detailedMessage = getErrorMessage(error);
    throw new Error(`Failed to summarize code snippet: ${detailedMessage}`);
  }
}

export async function generateCodeServer(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  try {
    return await generateCode(input);
  } catch (error) {
    console.error("Error in generateCodeServer:", error);
    const detailedMessage = getErrorMessage(error);
    throw new Error(`Failed to generate code: ${detailedMessage}`);
  }
}

export async function refactorCodeServer(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    return await codeRefactoringSuggestions(input);
  } catch (error) {
    console.error("Error in refactorCodeServer:", error);
    const detailedMessage = getErrorMessage(error);
    throw new Error(`Refactoring suggestions failed: ${detailedMessage}`);
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    return await findCodebaseExamples(input);
  } catch (error) {
    console.error("Error in findExamplesServer:", error);
    const detailedMessage = getErrorMessage(error);
    throw new Error(`Failed to find codebase examples: ${detailedMessage}`);
  }
}
