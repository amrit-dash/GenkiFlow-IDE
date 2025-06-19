/**
 * @fileOverview Tool for analyzing code usage patterns and finding symbol references.
 *
 * - codeUsageAnalysis: A tool that finds all usages of functions, classes, variables, etc.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

const CodeUsageAnalysisInputSchema = z.object({
  symbolName: z.string().describe('The name of the symbol to find usages for (function, class, variable, etc.)'),
  searchScope: z.enum(['workspace', 'current-file', 'directory']).optional().describe('Scope of the search'),
  currentFilePath: z.string().optional().describe('Current file path for context'),
  includeDefinitions: z.boolean().optional().describe('Whether to include the definition location'),
  includeReferences: z.boolean().optional().describe('Whether to include all references'),
  fileSystemTree: z.string().optional().describe('File system structure for context'),
});

const CodeUsageAnalysisOutputSchema = z.object({
  symbolInfo: z.object({
    name: z.string().describe('The symbol name'),
    type: z.enum(['function', 'class', 'variable', 'interface', 'type', 'component', 'unknown']).describe('Type of symbol'),
    definition: z.object({
      filePath: z.string(),
      line: z.number(),
      code: z.string().describe('The definition code'),
    }).optional().describe('Where the symbol is defined'),
  }),
  usages: z.array(z.object({
    filePath: z.string().describe('File where the usage is found'),
    line: z.number().describe('Line number of the usage'),
    context: z.string().describe('Code context around the usage'),
    usageType: z.enum(['call', 'import', 'instantiation', 'reference', 'assignment']).describe('Type of usage'),
  })).describe('List of all usages found'),
  relatedSymbols: z.array(z.object({
    name: z.string(),
    relationship: z.enum(['extends', 'implements', 'imports', 'exports', 'calls', 'overrides']).describe('Relationship to the original symbol'),
    filePath: z.string(),
  })).optional().describe('Related symbols found'),
  summary: z.object({
    totalUsages: z.number(),
    filesWithUsages: z.number(),
    mostUsedIn: z.string().optional().describe('File path where symbol is used most'),
    unusedFiles: z.array(z.string()).optional().describe('Files that might benefit from this symbol'),
  }),
});

// TypeScript program setup
function createTsProgram(rootPath: string): ts.Program {
  const configPath = ts.findConfigFile(
    rootPath,
    ts.sys.fileExists,
    'tsconfig.json'
  );

  if (!configPath) {
    throw new Error('Could not find tsconfig.json');
  }

  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(configPath)
  );

  return ts.createProgram(fileNames, options);
}

// Find symbol definition
function findSymbolDefinition(
  program: ts.Program,
  symbolName: string,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): { filePath: string; line: number; code: string } | undefined {
  let definition: { filePath: string; line: number; code: string } | undefined;

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && node.text === symbolName) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations && declarations.length > 0) {
          const decl = declarations[0];
          const declFile = decl.getSourceFile();
          const { line } = declFile.getLineAndCharacterOfPosition(decl.getStart());
          
          definition = {
            filePath: declFile.fileName,
            line: line + 1,
            code: decl.getText(),
          };
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return definition;
}

// Find symbol usages
function findSymbolUsages(
  program: ts.Program,
  symbolName: string,
  checker: ts.TypeChecker
): Array<{ filePath: string; line: number; context: string; usageType: 'call' | 'import' | 'instantiation' | 'reference' | 'assignment' }> {
  const usages: Array<{ filePath: string; line: number; context: string; usageType: 'call' | 'import' | 'instantiation' | 'reference' | 'assignment' }> = [];

  program.getSourceFiles().forEach(sourceFile => {
    function visit(node: ts.Node) {
      if (ts.isIdentifier(node) && node.text === symbolName) {
        const symbol = checker.getSymbolAtLocation(node);
        if (symbol) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          usages.push({
            filePath: sourceFile.fileName,
            line: line + 1,
            context: getNodeContext(node, sourceFile),
            usageType: determineUsageType(node),
          });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  });

  return usages;
}

// Get code context around a node
function getNodeContext(node: ts.Node, sourceFile: ts.SourceFile): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const lineStarts = sourceFile.getLineStarts();
  const start = lineStarts[Math.max(0, line - 1)];
  const end = lineStarts[Math.min(lineStarts.length - 1, line + 2)];
  return sourceFile.text.slice(start, end).trim();
}

// Determine how a symbol is being used
function determineUsageType(node: ts.Node): 'call' | 'import' | 'instantiation' | 'reference' | 'assignment' {
  let parent = node.parent;
  while (parent) {
    if (ts.isCallExpression(parent) && parent.expression === node) {
      return 'call';
    }
    if (ts.isImportDeclaration(parent)) {
      return 'import';
    }
    if (ts.isNewExpression(parent) && parent.expression === node) {
      return 'instantiation';
    }
    if (ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return 'assignment';
    }
    parent = parent.parent;
  }
  return 'reference';
}

// Find related symbols
function findRelatedSymbols(
  program: ts.Program,
  symbolName: string,
  checker: ts.TypeChecker
): Array<{ name: string; relationship: 'extends' | 'implements' | 'imports' | 'exports' | 'calls' | 'overrides'; filePath: string }> {
  const related: Array<{ name: string; relationship: 'extends' | 'implements' | 'imports' | 'exports' | 'calls' | 'overrides'; filePath: string }> = [];

  program.getSourceFiles().forEach(sourceFile => {
    function visit(node: ts.Node) {
      if (ts.isClassDeclaration(node) && node.heritageClauses) {
        node.heritageClauses.forEach(clause => {
          clause.types.forEach(type => {
            if (type.expression.getText() === symbolName) {
              related.push({
                name: node.name?.text || 'anonymous',
                relationship: clause.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements',
                filePath: sourceFile.fileName,
              });
            }
          });
        });
      }
      
      if (ts.isImportDeclaration(node)) {
        const importText = node.moduleSpecifier.getText();
        if (importText.includes(symbolName)) {
          related.push({
            name: importText.replace(/['"`]/g, ''),
            relationship: 'imports',
            filePath: sourceFile.fileName,
          });
        }
      }
      
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  });

  return related;
}

// Determine symbol type from its declaration
function inferSymbolTypeFromDeclaration(node: ts.Node): 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown' {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return 'function';
  }
  if (ts.isClassDeclaration(node)) {
    return 'class';
  }
  if (ts.isInterfaceDeclaration(node)) {
    return 'interface';
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return 'type';
  }
  if (ts.isVariableDeclaration(node)) {
    const name = node.name.getText();
    if (name[0] === name[0].toUpperCase() && 
        (name.includes('Component') || name.endsWith('Provider') || name.endsWith('Context'))) {
      return 'component';
    }
    return 'variable';
  }
  return 'unknown';
}

// Find files that might benefit from using the symbol
function findPotentialUsers(
  program: ts.Program,
  symbolType: string,
  usages: Array<{ filePath: string }>
): string[] {
  const potentialUsers: string[] = [];
  const usedIn = new Set(usages.map(u => u.filePath));

  program.getSourceFiles().forEach(sourceFile => {
    if (!usedIn.has(sourceFile.fileName)) {
      const content = sourceFile.getText().toLowerCase();
      
      // Look for potential use cases based on symbol type
      if (symbolType === 'component' && content.includes('react')) {
        potentialUsers.push(sourceFile.fileName);
      } else if (symbolType === 'function' && content.includes('function')) {
        potentialUsers.push(sourceFile.fileName);
      }
      // Add more heuristics based on symbol type
    }
  });

  return potentialUsers;
}

export const codeUsageAnalysis = ai.defineTool(
  {
    name: 'codeUsageAnalysis',
    description: 'Analyzes code usage patterns and finds all references, definitions, and related symbols for a given symbol name.',
    inputSchema: CodeUsageAnalysisInputSchema,
    outputSchema: CodeUsageAnalysisOutputSchema,
  },
  async (input) => {
    console.log(`Code usage analysis called for symbol: ${input.symbolName}`);
    
    try {
      const rootPath = input.currentFilePath 
        ? path.dirname(input.currentFilePath)
        : process.cwd();

      // Create TypeScript program
      const program = createTsProgram(rootPath);
      const checker = program.getTypeChecker();

      // Find source file
      const sourceFile = input.currentFilePath 
        ? program.getSourceFile(input.currentFilePath) 
        : program.getSourceFiles()[0];

      if (!sourceFile) {
        throw new Error('Could not find source file');
      }

      // Find symbol definition
      const definition = input.includeDefinitions !== false
        ? findSymbolDefinition(program, input.symbolName, sourceFile, checker)
        : undefined;

      // Determine symbol type from definition
      let symbolType: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown' = 'unknown';
      if (definition) {
        const sourceFile = program.getSourceFile(definition.filePath);
        if (sourceFile) {
          const node = findNodeAtPosition(sourceFile, definition.line);
          if (node) {
            symbolType = inferSymbolTypeFromDeclaration(node);
          }
        }
      }

      // Find all usages
      const usages = input.includeReferences !== false
        ? findSymbolUsages(program, input.symbolName, checker)
        : [];

      // Find related symbols
      const relatedSymbols = findRelatedSymbols(program, input.symbolName, checker);

      // Calculate usage statistics
      const filesWithUsages = new Set(usages.map(u => u.filePath));
      const usagesByFile = new Map<string, number>();
      usages.forEach(u => {
        usagesByFile.set(u.filePath, (usagesByFile.get(u.filePath) || 0) + 1);
      });

      // Find most used file
      let mostUsedFile: string | undefined;
      let maxUsages = 0;
      usagesByFile.forEach((count, file) => {
        if (count > maxUsages) {
          maxUsages = count;
          mostUsedFile = file;
        }
      });

      // Find potential users
      const unusedFiles = findPotentialUsers(program, symbolType, usages);

      return {
        symbolInfo: {
          name: input.symbolName,
          type: symbolType,
          definition,
        },
        usages,
        relatedSymbols: relatedSymbols.length > 0 ? relatedSymbols : undefined,
        summary: {
          totalUsages: usages.length,
          filesWithUsages: filesWithUsages.size,
          mostUsedIn: mostUsedFile,
          unusedFiles: unusedFiles.length > 0 ? unusedFiles : undefined,
        },
      };
    } catch (error) {
      console.error('Error in code usage analysis:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to analyze code usage: ${error.message}`);
      } else {
        throw new Error('Failed to analyze code usage: Unknown error');
      }
    }
  }
);

// Helper function to find a node at a specific line
function findNodeAtPosition(sourceFile: ts.SourceFile, line: number): ts.Node | undefined {
  let result: ts.Node | undefined;

  function visit(node: ts.Node) {
    const nodeLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (nodeLine === line) {
      result = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}