/**
 * @fileOverview Smart Folder Operations - Intelligent folder analysis and operations
 * 
 * This tool provides intelligent folder operations including:
 * - Smart move destination detection
 * - Folder rename suggestions based on contents
 * - Folder delete operations with context
 * - Conversational clarification for ambiguous operations
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartFolderOperationsInputSchema = z.object({
  operation: z.enum(['move', 'rename', 'delete', 'analyze']).describe('Type of folder operation'),
  targetPath: z.string().describe('Path of the file/folder to operate on'),
  userInstruction: z.string().describe('User instruction describing what they want to do'),
  destinationHint: z.string().optional().describe('Any destination hint from user instruction'),
  fileSystemTree: z.string().describe('Current file system structure as string'),
  folderContents: z.array(z.object({
    path: z.string(),
    name: z.string(),
    type: z.enum(['file', 'folder']),
    language: z.string().optional(),
    purpose: z.string().optional(),
  })).optional().describe('Contents of folders for analysis'),
});

const FolderSuggestionSchema = z.object({
  folderPath: z.string().describe('Suggested folder path'),
  folderName: z.string().describe('Folder name'),
  confidence: z.number().min(0).max(1).describe('Confidence score for this suggestion'),
  reasoning: z.string().describe('Why this folder is suggested'),
  relevanceScore: z.number().min(0).max(1).describe('How relevant this folder is to the file/operation'),
});

const SmartFolderOperationsOutputSchema = z.object({
  operation: z.enum(['move', 'rename', 'delete', 'analyze']),
  canExecuteDirectly: z.boolean().describe('Whether operation can be executed with high confidence'),
  suggestions: z.array(FolderSuggestionSchema).describe('Folder suggestions ranked by relevance'),
  topSuggestion: FolderSuggestionSchema.optional().describe('Best suggestion if confidence is high'),
  needsUserConfirmation: z.boolean().describe('Whether user confirmation is needed'),
  confirmationPrompt: z.string().optional().describe('Question to ask user for clarification'),
  suggestedNewName: z.string().optional().describe('Suggested new name for rename operations'),
  folderAnalysis: z.object({
    totalFiles: z.number(),
    languages: z.array(z.string()),
    primaryPurpose: z.string(),
    suggestedNames: z.array(z.string()),
    isWellOrganized: z.boolean(),
  }).optional().describe('Analysis of folder contents'),
  reasoning: z.string().describe('Detailed explanation of the analysis and suggestions'),
  confidence: z.number().min(0).max(1).describe('Overall confidence in the recommendations'),
});

export type SmartFolderOperationsInput = z.infer<typeof SmartFolderOperationsInputSchema>;
export type SmartFolderOperationsOutput = z.infer<typeof SmartFolderOperationsOutputSchema>;

const smartFolderOperationsPrompt = ai.definePrompt({
  name: 'smartFolderOperationsPrompt',
  input: {schema: SmartFolderOperationsInputSchema},
  output: {schema: SmartFolderOperationsOutputSchema},
  prompt: `You are an expert file system organizer that understands code project structures and can intelligently suggest folder operations.

OPERATION: {{{operation}}}
TARGET: {{{targetPath}}}
USER INSTRUCTION: "{{{userInstruction}}}"
{{#if destinationHint}}DESTINATION HINT: "{{{destinationHint}}}"{{/if}}

FILE SYSTEM STRUCTURE:
{{{fileSystemTree}}}

{{#if folderContents}}
FOLDER CONTENTS ANALYSIS:
{{#each folderContents}}
- {{{this.path}}} ({{{this.type}}}){{#if this.language}} - {{{this.language}}}{{/if}}{{#if this.purpose}} - {{{this.purpose}}}{{/if}}
{{/each}}
{{/if}}

ANALYSIS INSTRUCTIONS:

## For MOVE Operations:
1. **Destination Detection**: Analyze user instruction to identify destination folder
   - Look for keywords like "into", "to", "move to", "put in", etc.
   - Parse folder names mentioned in instruction
   - Consider file type and project structure context

2. **Folder Relevance Analysis**: For each potential destination folder:
   - Check if folder purpose matches file type/content
   - Consider naming conventions and project organization
   - Evaluate folder structure and contents

3. **Confidence Scoring**:
   - 0.85+ = Execute directly (canExecuteDirectly: true)
   - 0.5-0.84 = Suggest top 3 options for user choice
   - <0.5 = Need clarification (needsUserConfirmation: true)

## For RENAME Operations:
1. **Content Analysis**: Understand what's inside the folder
   - Identify primary programming languages
   - Determine folder purpose (components, utils, services, etc.)
   - Check current naming conventions

2. **Name Suggestions**: Generate appropriate folder names based on:
   - Content type and purpose
   - Project naming conventions
   - Best practices for folder organization

## For DELETE Operations:
1. **Safety Check**: Analyze folder importance and contents
2. **Impact Assessment**: Check if folder contains important files
3. **Confirmation Logic**: Determine if deletion needs user confirmation

## For ANALYZE Operations:
1. **Structure Assessment**: Evaluate folder organization
2. **Content Mapping**: Understand what each subfolder contains
3. **Improvement Suggestions**: Recommend better organization if needed

EXAMPLES OF GOOD DESTINATION DETECTION:
- "move python.py into the new folder" → Look for recent folders, prefer empty or python-related folders
- "move this to utils" → Find folders with "util", "utils", "utility" in name
- "put it in components" → Find "components", "comp", "ui" folders
- "move to the math folder" → Find folders with "math", "mathematics", "calculations"

CONFIDENCE GUIDELINES:
- Exact folder name match + relevant content = 0.9+
- Similar name + relevant content = 0.8-0.9
- Relevant content but different name = 0.6-0.8
- Unclear destination but some options = 0.3-0.6
- No clear destination = <0.3

OUTPUT REQUIREMENTS:
- Always provide reasoning for your decisions
- Rank suggestions by relevance and confidence
- For high confidence (0.85+), set canExecuteDirectly: true
- For medium confidence, provide 2-3 good options
- For low confidence, ask specific clarifying questions
- Consider project structure and naming conventions
- Prioritize logical organization and best practices

Focus on understanding the user's intent and the project's organization patterns to make intelligent suggestions.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

export const smartFolderOperations = ai.defineTool(
  {
    name: 'smartFolderOperations',
    description: 'Intelligently analyzes folder operations including move destinations, rename suggestions, and delete operations with context awareness.',
    inputSchema: SmartFolderOperationsInputSchema,
    outputSchema: SmartFolderOperationsOutputSchema,
  },
  async (input) => {
    const result = await smartFolderOperationsPrompt(input);
    return result.output!;
  }
); 