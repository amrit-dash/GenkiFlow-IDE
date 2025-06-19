/**
 * @fileOverview Error validation and auto-fix tool for code changes.
 *
 * - errorValidation: A tool that validates code for errors and suggests fixes.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as ts from 'typescript';
import { ESLint } from 'eslint';

const ErrorValidationInputSchema = z.object({
  code: z.string().describe('The code to validate for errors.'),
  filePath: z.string().describe('The file path where this code will be placed.'),
  language: z.string().optional().describe('Programming language (auto-detected from file extension if not provided).'),
  projectContext: z.string().optional().describe('Additional project context for validation.'),
  validateTypes: z.boolean().optional().default(true).describe('Whether to validate TypeScript types'),
  validateLinting: z.boolean().optional().default(true).describe('Whether to validate with ESLint'),
  validateBestPractices: z.boolean().optional().default(true).describe('Whether to check best practices'),
});

const ErrorValidationOutputSchema = z.object({
  hasErrors: z.boolean().describe('Whether errors were found in the code.'),
  errors: z.array(z.object({
    line: z.number().optional().describe('Line number of the error.'),
    column: z.number().optional().describe('Column number of the error.'),
    message: z.string().describe('Error message.'),
    severity: z.enum(['error', 'warning', 'info']).describe('Severity level.'),
    code: z.string().optional().describe('Error code if available.'),
    source: z.enum(['typescript', 'eslint', 'best-practices', 'general']).describe('Source of the error.'),
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
  source: 'typescript' | 'eslint' | 'best-practices' | 'general';
};

// Create TypeScript compiler host
function createCompilerHost(options: ts.CompilerOptions): ts.CompilerHost {
  return {
    getSourceFile: (fileName: string, languageVersion: ts.ScriptTarget) => {
      const sourceText = ts.sys.readFile(fileName);
      return sourceText !== undefined
        ? ts.createSourceFile(fileName, sourceText, languageVersion)
        : undefined;
    },
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: fileName => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
  };
}

// Validate TypeScript code
async function validateTypeScript(code: string, filePath: string): Promise<ValidationError[]> {
  const options: ts.CompilerOptions = {
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    jsx: ts.JsxEmit.React,
  };

  const host = createCompilerHost(options);
  const program = ts.createProgram([filePath], options, host);
  const sourceFile = program.getSourceFile(filePath);
  
  if (!sourceFile) {
    return [{
      message: 'Failed to parse TypeScript file',
      severity: 'error',
      source: 'typescript'
    }];
  }

  const errors: ValidationError[] = [];
  const diagnostics = [
    ...program.getSemanticDiagnostics(sourceFile),
    ...program.getSyntacticDiagnostics(sourceFile),
  ];

  diagnostics.forEach(diagnostic => {
    if (diagnostic.file && diagnostic.start) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      errors.push({
        line: line + 1,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        code: diagnostic.code.toString(),
        source: 'typescript'
      });
    }
  });

  return errors;
}

// Validate with ESLint
async function validateWithESLint(code: string, filePath: string): Promise<ValidationError[]> {
  const eslint = new ESLint({
    overrideConfig: {
      plugins: {
        '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      },
    },
  });

  try {
    const results = await eslint.lintText(code, { filePath });
    return (results[0]?.messages || []).map(error => ({
      line: error.line,
      column: error.column,
      message: error.message,
      severity: error.severity === 2 ? 'error' : 'warning',
      code: error.ruleId || undefined,
      source: 'eslint'
    }));
  } catch (error) {
    console.error('ESLint validation error:', error);
    return [{
      message: 'ESLint validation failed',
      severity: 'error',
      source: 'eslint'
    }];
  }
}

// Check best practices
function checkBestPractices(code: string, language: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // TypeScript/JavaScript specific checks
  if (language === 'typescript' || language === 'javascript') {
    // Check for console.log statements
    if (code.includes('console.log')) {
      errors.push({
        message: 'Avoid using console.log in production code',
        severity: 'warning',
        source: 'best-practices'
      });
    }

    // Check for proper error handling in async functions
    if (code.includes('async') && !code.includes('try {')) {
      errors.push({
        message: 'Consider adding try-catch blocks for error handling in async functions',
        severity: 'info',
        source: 'best-practices'
      });
    }

    // TypeScript specific checks
    if (language === 'typescript') {
      if (code.includes(': any')) {
        errors.push({
          message: 'Avoid using "any" type, specify proper types instead',
          severity: 'warning',
          source: 'best-practices'
        });
      }
    }

    // React specific checks
    if (code.includes('React') || code.includes('jsx')) {
      // Check hooks rules
      if (code.includes('useState') && !code.includes('const [')) {
        errors.push({
          message: 'Use array destructuring with useState hook',
          severity: 'warning',
          source: 'best-practices'
        });
      }

      if (code.includes('useEffect') && !code.includes('return () =>')) {
        errors.push({
          message: 'Consider adding cleanup function in useEffect hook if needed',
          severity: 'info',
          source: 'best-practices'
        });
      }
    }
  }

  return errors;
}

// Detect language from file extension
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

// Generate fix suggestions for errors
async function generateFixSuggestions(code: string, errors: ValidationError[], language: string) {
  const suggestions: Array<{
    description: string;
    fixedCode: string;
    confidence: number;
  }> = [];

  for (const error of errors) {
    if (error.source === 'typescript' && error.code) {
      const fix = await generateTypeScriptFix(code, error);
      if (fix) {
        suggestions.push(fix);
      }
    } else if (error.source === 'best-practices') {
      const fix = generateBestPracticeFix(code, error, language);
      if (fix) {
        suggestions.push(fix);
      }
    }
  }

  return suggestions;
}

// Generate TypeScript-specific fixes
async function generateTypeScriptFix(code: string, error: ValidationError) {
  // Add specific fixes based on common TypeScript error codes
  switch (error.code) {
    case '2322': // Type mismatch
      return {
        description: 'Fix type mismatch by adding type assertion or proper type',
        fixedCode: code.replace(/(const|let|var)\s+(\w+)(\s*=)/, '$1 $2: any$3'),
        confidence: 0.7
      };
    case '2339': // Property does not exist
      return {
        description: 'Add optional chaining for potentially undefined property',
        fixedCode: code.replace(/(\w+)\.(\w+)/, '$1?.$2'),
        confidence: 0.8
      };
    // Add more cases for common TypeScript errors
  }
}

// Generate fixes for best practice violations
function generateBestPracticeFix(code: string, error: ValidationError, language: string) {
  if (error.message.includes('console.log')) {
    return {
      description: 'Replace console.log with proper logging utility',
      fixedCode: code.replace(/console\.log\((.*)\)/g, 'logger.debug($1)'),
      confidence: 0.9
    };
  }

  if (error.message.includes('try-catch') && language === 'typescript') {
    return {
      description: 'Add try-catch block to async function',
      fixedCode: code.replace(
        /(async\s+\w+\s*\([^)]*\)\s*{)/,
        '$1\n  try {'
      ) + '\n  } catch (error) {\n    throw error;\n  }',
      confidence: 0.8
    };
  }

  // Add more best practice fixes as needed
  return null;
}

// Assess code quality
function assessCodeQuality(code: string, language: string) {
  const score = calculateCodeQualityScore(code, language);
  const issues = identifyQualityIssues(code, language);
  const improvements = generateImprovements(issues);

  return {
    score,
    issues,
    improvements,
  };
}

function calculateCodeQualityScore(code: string, language: string): number {
  let score = 10;
  
  // Deduct points for various quality issues
  if (code.includes('any')) score -= 1;
  if (code.includes('console.log')) score -= 1;
  if (!code.includes('try') && code.includes('async')) score -= 1;
  if (code.length > 500) score -= 1; // Long file
  if ((code.match(/\n/g) || []).length > 200) score -= 1; // Too many lines
  
  // Language-specific scoring
  if (language === 'typescript') {
    if (!code.includes('interface') && !code.includes('type ')) score -= 1;
    if (code.includes(': any')) score -= 2;
  }
  
  return Math.max(0, Math.min(10, score));
}

function identifyQualityIssues(code: string, language: string): string[] {
  const issues: string[] = [];
  
  // Common issues
  if (code.length > 500) issues.push('File is too long, consider splitting into smaller modules');
  if ((code.match(/\n/g) || []).length > 200) issues.push('Too many lines, consider refactoring');
  if (code.includes('console.log')) issues.push('Debug statements found in code');
  
  // Language-specific issues
  if (language === 'typescript') {
    if (code.includes(': any')) issues.push('Usage of "any" type detected');
    if (!code.includes('interface') && !code.includes('type ')) {
      issues.push('No type definitions found');
    }
  }
  
  return issues;
}

function generateImprovements(issues: string[]): string[] {
  return issues.map(issue => {
    switch (issue) {
      case 'File is too long, consider splitting into smaller modules':
        return 'Split the file into smaller, more focused modules with clear responsibilities';
      case 'Too many lines, consider refactoring':
        return 'Extract common functionality into separate functions or utilities';
      case 'Debug statements found in code':
        return 'Replace console.log with proper logging utility or remove debug statements';
      case 'Usage of "any" type detected':
        return 'Replace "any" types with proper type definitions';
      case 'No type definitions found':
        return 'Add proper type definitions using interfaces or type aliases';
      default:
        return `Fix: ${issue}`;
    }
  });
}

export const errorValidation = ai.defineTool(
  {
    name: 'errorValidation',
    description: 'Validates code for syntax errors, type errors, and quality issues, providing automatic fixes when possible.',
    inputSchema: ErrorValidationInputSchema,
    outputSchema: ErrorValidationOutputSchema,
  },
  async (input) => {
    console.log(`Error validation called for file: ${input.filePath}`);
    
    const language = input.language || detectLanguageFromPath(input.filePath);
    const errors: ValidationError[] = [];
    
    // TypeScript validation for TS files
    if (input.validateTypes !== false && (language === 'typescript' || input.filePath.endsWith('.ts') || input.filePath.endsWith('.tsx'))) {
      const tsErrors = await validateTypeScript(input.code, input.filePath);
      errors.push(...tsErrors);
    }
    
    // ESLint validation
    if (input.validateLinting !== false && (language === 'typescript' || language === 'javascript')) {
      const eslintErrors = await validateWithESLint(input.code, input.filePath);
      errors.push(...eslintErrors);
    }
    
    // Best practices validation
    if (input.validateBestPractices !== false) {
      const bestPracticeErrors = checkBestPractices(input.code, language);
      errors.push(...bestPracticeErrors);
    }
    
    // Generate fix suggestions
    const suggestions = await generateFixSuggestions(input.code, errors, language);
    
    // Assess code quality
    const codeQuality = assessCodeQuality(input.code, language);
    
    return {
      hasErrors: errors.length > 0,
      errors,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      codeQuality,
    };
  }
);