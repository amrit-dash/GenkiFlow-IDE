
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
  console.error(`--- Error in ${actionName} at ${timestamp} ---`);
  console.error("Message:", error?.message);
  if (error?.stack) {
    console.error("Stack:", error.stack);
  }
  if (error?.cause) {
    // Handle if error.cause is a function (seen in some error patterns)
    const cause = typeof error.cause === 'function' ? error.cause() : error.cause;
    console.error("Cause:", cause);
  }
  if (error?.details) { // Genkit specific or other structured errors
      console.error("Details:", error.details);
  }
  console.error("Full error object (raw):", error);
  try {
    // Attempt to stringify common/useful properties for a cleaner log
    console.error("Error JSON (selective properties):", JSON.stringify({
      message: error?.message,
      name: error?.name,
      stackSummary: error?.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      cause: typeof error?.cause === 'function' ? error.cause() : error?.cause,
      details: error?.details,
    }, null, 2));
  } catch (e_stringify) {
    console.error("Could not stringify parts of the error object for detailed logging:", e_stringify);
  }
  console.error(`--- End of Error in ${actionName} at ${timestamp} ---`);
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
