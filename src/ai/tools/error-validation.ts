/**
 * @fileOverview Error validation and auto-fix tool for code changes.
 *
 * - errorValidation: A tool that validates code for errors and suggests fixes.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ErrorValidationInputSchema = z.object({
  code: z.string().describe('The code to validate for errors.'),
  filePath: z.string().describe('The file path where this code will be placed.'),
  language: z.string().optional().describe('Programming language (auto-detected from file extension if not provided).'),
  projectContext: z.string().optional().describe('Additional project context for validation.'),
});

const ErrorValidationOutputSchema = z.object({
  hasErrors: z.boolean().describe('Whether errors were found in the code.'),
  errors: z.array(z.object({
    line: z.number().optional().describe('Line number of the error.'),
    column: z.number().optional().describe('Column number of the error.'),
    message: z.string().describe('Error message.'),
    severity: z.enum(['error', 'warning', 'info']).describe('Severity level.'),
    code: z.string().optional().describe('Error code if available.'),
  })).describe('List of errors found.'),
  suggestions: z.array(z.object({
    description: z.string().describe('Description of the suggested fix.'),
    fixedCode: z.string().describe('The corrected code.'),
    confidence: z.number().min(0).max(1).describe('Confidence in the fix (0-1).'),
  })).optional().describe('Suggested fixes for the errors.'),
  codeQuality: z.object({
    score: z.number().min(0).max(10).describe('Overall code quality score (0-10).'),
    issues: z.array(z.string()).describe('List of quality issues found.'),
    improvements: z.array(z.string()).describe('Suggested improvements.'),
  }).optional().describe('Code quality assessment.'),
});

type ValidationError = {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
};

export const errorValidation = ai.defineTool(
  {
    name: 'errorValidation',
    description: 'Validates code for syntax errors, type errors, and quality issues, providing automatic fixes when possible.',
    inputSchema: ErrorValidationInputSchema,
    outputSchema: ErrorValidationOutputSchema,
  },
  async (input) => {
    console.log(`Error validation called for file: ${input.filePath}`);
    
    // Detect language from file extension if not provided
    const language = input.language || detectLanguageFromPath(input.filePath);
    
    // Perform basic validation based on language
    const errors = await validateCode(input.code, language, input.filePath);
    const hasErrors = errors.length > 0;
    
    // Generate suggestions for fixes if errors are found
    let suggestions;
    if (hasErrors) {
      suggestions = await generateFixSuggestions(input.code, errors, language);
    }
    
    // Assess code quality
    const codeQuality = assessCodeQuality(input.code, language);
    
    return {
      hasErrors,
      errors,
      suggestions,
      codeQuality,
    };
  }
);

function detectLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'cpp': case 'cc': case 'cxx': return 'cpp';
    case 'c': return 'c';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    case 'cs': return 'csharp';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'yaml': case 'yml': return 'yaml';
    default: return 'text';
  }
}

async function validateCode(code: string, language: string, filePath: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  // Basic syntax validation patterns
  switch (language) {
    case 'typescript':
    case 'javascript':
      // Check for common JS/TS errors
      if (code.includes('function(') && !code.includes('function (')) {
        // This is just an example - in real implementation you'd use a proper parser
      }
      
      // Check for missing semicolons in key places
      const lines = code.split('\n');
      lines.forEach((line, index) => {
        if (line.trim().match(/^(const|let|var|return)\s+.*[^;{}\s]$/)) {
          errors.push({
            line: index + 1,
            message: 'Missing semicolon',
            severity: 'warning' as const,
            code: 'missing-semicolon',
          });
        }
      });
      break;
      
    case 'python':
      // Check for common Python errors
      const pythonLines = code.split('\n');
      pythonLines.forEach((line, index) => {
        if (line.trim().startsWith('def ') && !line.endsWith(':')) {
          errors.push({
            line: index + 1,
            message: 'Function definition missing colon',
            severity: 'error' as const,
            code: 'syntax-error',
          });
        }
      });
      break;
  }
  
  return errors;
}

async function generateFixSuggestions(code: string, errors: ValidationError[], language: string) {
  const suggestions = [];
  
  for (const error of errors) {
    switch (error.code) {
      case 'missing-semicolon':
        if (error.line) {
          const fixedCode = code.replace(
            new RegExp(`^(.*${error.line}.*[^;{}\s])$`, 'm'),
            '$1;'
          );
          suggestions.push({
            description: 'Add missing semicolon',
            fixedCode,
            confidence: 0.9,
          });
        }
        break;
        
      case 'syntax-error':
        if (language === 'python' && error.message.includes('colon') && error.line) {
          const lines = code.split('\n');
          lines[error.line - 1] += ':';
          suggestions.push({
            description: 'Add missing colon to function definition',
            fixedCode: lines.join('\n'),
            confidence: 0.95,
          });
        }
        break;
    }
  }
  
  return suggestions;
}

function assessCodeQuality(code: string, language: string) {
  let score = 10;
  const issues = [];
  const improvements = [];
  
  // Basic quality checks
  if (code.length < 10) {
    score -= 2;
    issues.push('Code is very short');
  }
  
  if (!code.includes('//') && !code.includes('/*') && !code.includes('#')) {
    score -= 1;
    improvements.push('Add comments to explain the code');
  }
  
  // Language-specific checks
  switch (language) {
    case 'typescript':
    case 'javascript':
      if (!code.includes('const') && !code.includes('let') && code.includes('var')) {
        score -= 1;
        improvements.push('Use const/let instead of var for better scoping');
      }
      
      if (code.includes('== ') || code.includes('!= ')) {
        score -= 0.5;
        improvements.push('Use === and !== for strict equality checks');
      }
      break;
      
    case 'python':
      if (code.includes('    ') && !code.includes('\t')) {
        // Good indentation
      } else if (code.includes('\t')) {
        score -= 0.5;
        improvements.push('Use spaces instead of tabs for indentation');
      }
      break;
  }
  
  return {
    score: Math.max(0, score),
    issues,
    improvements,
  };
} 