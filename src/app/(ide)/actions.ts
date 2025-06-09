
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
  console.error("Raw Error Object:", error); 

  if (error instanceof Error) {
    console.error("Error Message:", error.message);
    if (error.stack) {
      console.error("Error Stack:", error.stack);
    }
    if ((error as any).rootCause) {
        console.error("Error Root Cause (Genkit?):", JSON.stringify((error as any).rootCause, null, 2));
    } else if (error.cause) {
      const cause = typeof (error as any).cause === 'function' ? (error as any).cause() : (error as any).cause;
      try {
        console.error("Error Cause:", JSON.stringify(cause, Object.getOwnPropertyNames(cause), 2));
      } catch (e) {
        console.error("Error Cause (could not stringify):", cause);
      }
    }
    if ((error as any).details) { 
        console.error("Error Details (Genkit?):", JSON.stringify((error as any).details, null, 2));
    }
  } else if (typeof error === 'object' && error !== null) {
    try {
        console.error("Error (object form):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
        console.error("Error (object form, could not stringify):", error);
    }
  } else {
    console.error("Error (primitive form):", error);
  }
  console.error(`--- END OF DETAILED SERVER ERROR in ${actionName} at ${timestamp} ---`);
}

// Updated to return only the base message for the client, detailed logging on server
function formatErrorForClient(baseMessage: string, error: any): string {
  logDetailedError("Client-facing error formatting", error); // Log detailed error on server
  // Check if the error has a message property that might be more specific (e.g., from Genkit validation)
  if (error && error.message && typeof error.message === 'string' && error.message.length < 200) { // Avoid overly long messages
    // Check if error message already contains known patterns we don't want to expose directly.
    if (error.message.includes("Model") && error.message.includes("not found")) {
        return baseMessage; // Keep it generic
    }
    // If it's a Zod validation error from Genkit, it might start with "Input validation failed"
    if (error.message.startsWith("Input validation failed") || error.message.startsWith("Output validation failed")) {
        // Could attempt to parse error.cause for Zod issues if client, but simple message is safer
        return `${baseMessage} There was an issue with the data format.`;
    }
    // For other relatively short messages, it might be safe to append.
    // return `${baseMessage} Details: ${error.message}`; // Potentially exposing too much
  }
  return baseMessage; // Default to simple base message
}

export async function summarizeCodeSnippetServer(input: SummarizeCodeSnippetInput): Promise<SummarizeCodeSnippetOutput> {
  try {
    return await summarizeCodeSnippet(input);
  } catch (error: any) {
    logDetailedError("summarizeCodeSnippetServer", error);
    throw new Error(formatErrorForClient("Failed to summarize code snippet.", error));
  }
}

export async function generateCodeServer(input: GenerateCodeInput): Promise<GenerateCodeOutput> {
  try {
    // console.log("generateCodeServer input:", JSON.stringify(input, null, 2)); // For debugging
    return await generateCode(input);
  } catch (error: any) {
    logDetailedError("generateCodeServer", error);
    throw new Error(formatErrorForClient("Failed to generate code.", error));
  }
}

export async function refactorCodeServer(input: CodeRefactoringSuggestionsInput): Promise<CodeRefactoringSuggestionsOutput> {
   try {
    return await codeRefactoringSuggestions(input);
  } catch (error: any) {
    logDetailedError("refactorCodeServer", error);
    throw new Error(formatErrorForClient("Failed to get refactoring suggestions.", error));
  }
}

export async function findExamplesServer(input: FindCodebaseExamplesInput): Promise<FindCodebaseExamplesOutput> {
  try {
    return await findCodebaseExamples(input);
  } catch (error: any) {
    logDetailedError("findExamplesServer", error);
    throw new Error(formatErrorForClient("Failed to find codebase examples.", error));
  }
}
