
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

export async function summarizeCodeSnippetServer(input: SummarizeCodeSnippetInput): Promise<SummarizeCodeSnippetOutput> {
  try {
    return await summarizeCodeSnippet(input);
  } catch (error) {
    console.error("Error in summarizeCodeSnippetServer:", error);
    throw new Error("Failed to summarize code snippet.");
  }
}

export async function generateCodeServer(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  try {
    return await generateCode(input);
  } catch (error) {
    console.error("Error in generateCodeServer:", error);
    throw new Error("Failed to generate code.");
  }
}

export async function refactorCodeServer(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    return await codeRefactoringSuggestions(input);
  } catch (error)
   {
    console.error("Error in refactorCodeServer:", error);
    // Attempt to parse Genkit's specific error structure if available
    if (typeof error === 'object' && error !== null && 'details' in error) {
      // This is a basic example; you might need to adjust based on actual error structure
      // @ts-ignore
      const details = error.details;
      if (typeof details === 'string') {
         try {
          const parsedDetails = JSON.parse(details);
          if (parsedDetails && parsedDetails.message) {
            throw new Error(`Refactoring suggestions failed: ${parsedDetails.message}`);
          }
         } catch (parseError) {
           // If parsing fails, fall back to a generic message or the details string itself
           throw new Error(`Refactoring suggestions failed: ${details}`);
         }
      }
    }
    throw new Error("Failed to get refactoring suggestions.");
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    return await findCodebaseExamples(input);
  } catch (error) {
    console.error("Error in findExamplesServer:", error);
    throw new Error("Failed to find codebase examples.");
  }
}
