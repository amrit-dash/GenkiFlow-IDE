
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
    // Genkit errors might have a 'cause' that is an object with more details
    // or a 'rootCause'. Let's try to log these.
    if ((error as any).rootCause) {
        console.error("Error Root Cause (Genkit?):", JSON.stringify((error as any).rootCause, null, 2));
    } else if (error.cause) {
      // Check if cause is a function (older Genkit style) or an object
      const cause = typeof (error as any).cause === 'function' ? (error as any).cause() : (error as any).cause;
      console.error("Error Cause:", JSON.stringify(cause, Object.getOwnPropertyNames(cause), 2));
    }
    if ((error as any).details) { 
        console.error("Error Details (Genkit?):", JSON.stringify((error as any).details, null, 2));
    }
  } else if (typeof error === 'object' && error !== null) {
    console.error("Error (object form):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  } else {
    console.error("Error (primitive form):", error);
  }
  console.error(`--- END OF DETAILED SERVER ERROR in ${actionName} at ${timestamp} ---`);
}

function formatErrorForClient(baseMessage: string, error: any): string {
  let detailedMessage = "Unknown error occurred.";
  if (error instanceof Error) {
    detailedMessage = error.message;
    if ((error as any).details) {
        detailedMessage += `\nDetails: ${JSON.stringify((error as any).details, null, 2)}`;
    }
    if ((error as any).rootCause) {
        detailedMessage += `\nRoot Cause: ${JSON.stringify((error as any).rootCause, null, 2)}`;
    } else if (error.cause && !(error as any).rootCause) {
        const cause = typeof (error as any).cause === 'function' ? (error as any).cause() : (error as any).cause;
        try {
            detailedMessage += `\nCause: ${JSON.stringify(cause, Object.getOwnPropertyNames(cause), 2)}`;
        } catch (e) {
            detailedMessage += `\nCause: ${cause}`;
        }
    }
    // Optionally add stack for client debugging if needed, but can be very verbose
    // if (error.stack) {
    //   detailedMessage += `\nStack: ${error.stack}`;
    // }
  } else if (typeof error === 'object' && error !== null) {
    try {
        detailedMessage = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    } catch (e) {
        detailedMessage = String(error);
    }
  } else if (error) {
    detailedMessage = String(error);
  }
  return `${baseMessage}\n\nError Details:\n${detailedMessage}`;
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
