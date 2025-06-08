
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

function logDetailedError(actionName: string, error: any) {
  const timestamp = new Date().toISOString();
  console.error(`--- DETAILED SERVER ERROR in ${actionName} at ${timestamp} ---`);
  console.error("Raw Error Object:", error); // Log the raw error object first

  if (error instanceof Error) {
    console.error("Error Message:", error.message);
    if (error.stack) {
      console.error("Error Stack:", error.stack);
    }
    if (error.cause) {
      const cause = typeof (error as any).cause === 'function' ? (error as any).cause() : (error as any).cause;
      console.error("Error Cause:", cause);
    }
  } else if (typeof error === 'object' && error !== null) {
    console.error("Error (object form):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  } else {
    console.error("Error (primitive form):", error);
  }

  // Genkit specific error details
  if (error?.details) { 
      console.error("Error Details (Genkit?):", error.details);
  }
  if (error?.rootCause) {
      console.error("Error Root Cause (Genkit?):", error.rootCause);
  }
   console.error(`--- END OF DETAILED SERVER ERROR in ${actionName} at ${timestamp} ---`);
}

export async function summarizeCodeSnippetServer(input: SummarizeCodeSnippetInput): Promise<SummarizeCodeSnippetOutput> {
  try {
    return await summarizeCodeSnippet(input);
  } catch (error) {
    logDetailedError("summarizeCodeSnippetServer", error);
    throw new Error("Failed to summarize code snippet.");
  }
}

export async function generateCodeServer(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  try {
    return await generateCode(input);
  } catch (error) {
    logDetailedError("generateCodeServer", error);
    throw new Error("Failed to generate code.");
  }
}

export async function refactorCodeServer(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    return await codeRefactoringSuggestions(input);
  } catch (error) {
    logDetailedError("refactorCodeServer", error);
    throw new Error("Failed to get refactoring suggestions.");
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    return await findCodebaseExamples(input);
  } catch (error) {
    logDetailedError("findExamplesServer", error);
    throw new Error("Failed to find codebase examples.");
  }
}
