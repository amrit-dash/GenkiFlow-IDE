
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
    console.error("Detailed error in summarizeCodeSnippetServer:", error);
    // @ts-ignore
    if (error.details) { console.error("Genkit error details:", error.details); }
    throw new Error("Failed to summarize code snippet.");
  }
}

export async function generateCodeServer(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  try {
    return await generateCode(input);
  } catch (error) {
    console.error("Detailed error in generateCodeServer:", error);
    // @ts-ignore
    if (error.details) { console.error("Genkit error details:", error.details); }
    throw new Error("Failed to generate code.");
  }
}

export async function refactorCodeServer(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    return await codeRefactoringSuggestions(input);
  } catch (error) {
    console.error("Detailed error in refactorCodeServer:", error);
    // @ts-ignore
    if (error.details) { console.error("Genkit error details:", error.details); }
    throw new Error("Failed to get refactoring suggestions.");
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    return await findCodebaseExamples(input);
  } catch (error) {
    console.error("Detailed error in findExamplesServer:", error);
    // @ts-ignore
    if (error.details) { console.error("Genkit error details:", error.details); }
    throw new Error("Failed to find codebase examples.");
  }
}
