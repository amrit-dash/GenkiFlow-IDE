/**
 * @fileOverview File Context Analyzer - Analyzes files to understand their purpose and context
 * 
 * This tool creates descriptions of files based on their content, helping the AI understand
 * what each file does and determine the best placement for new code.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FileContextAnalyzerInputSchema = z.object({
  filePath: z.string().describe('Path of the file to analyze'),
  fileContent: z.string().describe('Content of the file'),
  fileName: z.string().describe('Name of the file'),
  fileExtension: z.string().describe('File extension (e.g., .ts, .py, .md)'),
  projectContext: z.string().optional().describe('Overall project context'),
});

const FileContextAnalysisSchema = z.object({
  language: z.string().describe('Programming language or file type'),
  purpose: z.string().describe('Main purpose of this file'),
  description: z.string().describe('Detailed description of what this file contains'),
  mainFunctions: z.array(z.string()).describe('List of main functions/methods'),
  dependencies: z.array(z.string()).describe('Key dependencies or imports'),
  codeType: z.enum(['component', 'utility', 'service', 'config', 'test', 'documentation', 'data', 'style', 'other']).describe('Type of code this file contains'),
  complexity: z.enum(['low', 'medium', 'high']).describe('Code complexity level'),
  isEntryPoint: z.boolean().describe('Whether this is a main entry point file'),
  relatedConcepts: z.array(z.string()).describe('Related programming concepts or domains'),
});

const FileContextAnalyzerOutputSchema = z.object({
  analysis: FileContextAnalysisSchema,
  contextScore: z.number().min(0).max(1).describe('How well-defined the file context is'),
  tags: z.array(z.string()).describe('Searchable tags for this file'),
  recommendedForNewCode: z.boolean().describe('Whether this file is suitable for adding new code'),
  reasoning: z.string().describe('Explanation of the analysis'),
});

export type FileContextAnalyzerInput = z.infer<typeof FileContextAnalyzerInputSchema>;
export type FileContextAnalyzerOutput = z.infer<typeof FileContextAnalyzerOutputSchema>;

const fileContextAnalyzerPrompt = ai.definePrompt({
  name: 'fileContextAnalyzerPrompt',
  input: {schema: FileContextAnalyzerInputSchema},
  output: {schema: FileContextAnalyzerOutputSchema},
  prompt: `You are an expert code analyst that understands file purposes and contexts within software projects.

FILE TO ANALYZE:
Path: {{{filePath}}}
Name: {{{fileName}}}
Extension: {{{fileExtension}}}

CONTENT:
\`\`\`{{{fileExtension}}}
{{{fileContent}}}
\`\`\`

{{#if projectContext}}
PROJECT CONTEXT:
{{{projectContext}}}
{{/if}}

ANALYSIS INSTRUCTIONS:

1. **Language Detection**: Identify the programming language or file type (TypeScript, Python, JavaScript, Markdown, JSON, etc.)

2. **Purpose Analysis**: Determine the main purpose of this file:
   - What is this file trying to accomplish?
   - What role does it play in the project?
   - Is it a core component, utility, configuration, documentation, etc.?

3. **Content Analysis**: 
   - Extract main functions, classes, components, or sections
   - Identify key dependencies and imports
   - Understand the code patterns and architecture used
   - Assess complexity based on logic, nesting, and responsibilities

4. **Categorization**:
   - **Component**: React/Vue components, UI elements
   - **Utility**: Helper functions, shared utilities
   - **Service**: API calls, data services, business logic
   - **Config**: Configuration files, settings
   - **Test**: Test files, specs
   - **Documentation**: README, docs, comments
   - **Data**: JSON, CSV, data files
   - **Style**: CSS, SCSS, styling files
   - **Other**: Everything else

5. **Context Scoring**: Rate how well-defined and focused the file is:
   - 1.0: Very focused, single responsibility, clear purpose
   - 0.7-0.9: Mostly focused with some secondary responsibilities
   - 0.4-0.6: Mixed purposes but still coherent
   - 0.1-0.3: Unclear or overly broad responsibilities
   - 0.0: Cannot determine purpose

6. **New Code Suitability**: Determine if this file would be good for adding new code:
   - Consider file focus and single responsibility principle
   - Check if adding code would maintain file coherence
   - Consider file size and complexity

7. **Tagging**: Create searchable tags based on:
   - Functionality (auth, ui, api, math, validation, etc.)
   - Technology (react, express, pandas, etc.)
   - Domain (user-management, payments, analytics, etc.)

QUALITY INDICATORS:
- For **Python**: Look for PEP8 compliance, docstrings, type hints
- For **TypeScript/JavaScript**: Look for type safety, modern patterns, proper exports
- For **React**: Look for component patterns, hooks usage, prop types
- For **Documentation**: Look for completeness, structure, examples

OUTPUT REQUIREMENTS:
- Provide a clear, actionable analysis
- Make recommendations based on file purpose and structure
- Include specific reasoning for your assessments
- Create useful tags for search and matching

Focus on understanding the file's role in the broader codebase and its suitability for different types of code additions.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  }
});

export const fileContextAnalyzer = ai.defineTool(
  {
    name: 'fileContextAnalyzer',
    description: 'Analyzes file content to understand its purpose, context, and suitability for code placement. Creates searchable descriptions and metadata.',
    inputSchema: FileContextAnalyzerInputSchema,
    outputSchema: FileContextAnalyzerOutputSchema,
  },
  async (input) => {
    const result = await fileContextAnalyzerPrompt(input);
    return result.output!;
  }
); 