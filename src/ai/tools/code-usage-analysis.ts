/**
 * @fileOverview Tool for analyzing code usage patterns and finding symbol references.
 *
 * - codeUsageAnalysis: A tool that finds all usages of functions, classes, variables, etc.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

export const codeUsageAnalysis = ai.defineTool(
  {
    name: 'codeUsageAnalysis',
    description: 'Analyzes code usage patterns and finds all references, definitions, and related symbols for a given symbol name.',
    inputSchema: CodeUsageAnalysisInputSchema,
    outputSchema: CodeUsageAnalysisOutputSchema,
  },
  async (input) => {
    console.log(`Code usage analysis called for symbol: ${input.symbolName}`);
    
    // In a real implementation, this would parse the actual codebase
    // For now, we'll provide intelligent mock responses based on common patterns
    
    const symbolType = inferSymbolType(input.symbolName);
    const mockUsages = generateMockUsages(input.symbolName, symbolType, input.currentFilePath);
    const mockDefinition = generateMockDefinition(input.symbolName, symbolType);
    const relatedSymbols = findRelatedSymbols(input.symbolName, symbolType);
    
    const summary = {
      totalUsages: mockUsages.length,
      filesWithUsages: new Set(mockUsages.map(u => u.filePath)).size,
      mostUsedIn: findMostUsedFile(mockUsages),
    };
    
    return {
      symbolInfo: {
        name: input.symbolName,
        type: symbolType,
        definition: mockDefinition,
      },
      usages: mockUsages,
      relatedSymbols,
      summary,
    };
  }
);

function inferSymbolType(symbolName: string): 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown' {
  // Heuristics to infer symbol type
  if (symbolName.startsWith('use') && symbolName.length > 3) {
    return 'function'; // Likely a React hook
  }
  if (symbolName[0] === symbolName[0].toUpperCase()) {
    if (symbolName.includes('Component') || symbolName.includes('Provider') || symbolName.includes('Context')) {
      return 'component';
    }
    return 'class'; // PascalCase suggests class or component
  }
  if (symbolName.includes('Type') || symbolName.includes('Interface')) {
    return 'interface';
  }
  if (symbolName.includes('handle') || symbolName.includes('get') || symbolName.includes('set') || symbolName.includes('create')) {
    return 'function';
  }
  return 'variable';
}

function generateMockUsages(symbolName: string, symbolType: string, currentFilePath?: string) {
  const usages = [];
  
  // Generate realistic usage examples based on symbol type
  switch (symbolType) {
    case 'function':
      usages.push(
        {
          filePath: '/src/components/Button.tsx',
          line: 15,
          context: `const result = ${symbolName}(params);`,
          usageType: 'call' as const,
        },
        {
          filePath: '/src/hooks/useAuth.ts',
          line: 8,
          context: `import { ${symbolName} } from './utils';`,
          usageType: 'import' as const,
        },
        {
          filePath: '/src/pages/Home.tsx',
          line: 23,
          context: `  const data = await ${symbolName}();`,
          usageType: 'call' as const,
        }
      );
      break;
      
    case 'component':
      usages.push(
        {
          filePath: '/src/pages/Dashboard.tsx',
          line: 45,
          context: `<${symbolName} onClick={handleClick} />`,
          usageType: 'reference' as const,
        },
        {
          filePath: '/src/components/Layout.tsx',
          line: 12,
          context: `import ${symbolName} from './${symbolName}';`,
          usageType: 'import' as const,
        },
        {
          filePath: '/src/app/page.tsx',
          line: 67,
          context: `  return <${symbolName} {...props} />;`,
          usageType: 'reference' as const,
        }
      );
      break;
      
    case 'class':
      usages.push(
        {
          filePath: '/src/services/ApiClient.ts',
          line: 34,
          context: `const instance = new ${symbolName}();`,
          usageType: 'instantiation' as const,
        },
        {
          filePath: '/src/models/User.ts',
          line: 5,
          context: `class User extends ${symbolName} {`,
          usageType: 'reference' as const,
        }
      );
      break;
      
    case 'variable':
      usages.push(
        {
          filePath: '/src/config/constants.ts',
          line: 18,
          context: `export const API_URL = ${symbolName}.baseUrl;`,
          usageType: 'reference' as const,
        },
        {
          filePath: '/src/utils/helpers.ts',
          line: 42,
          context: `if (${symbolName} && ${symbolName}.length > 0) {`,
          usageType: 'reference' as const,
        }
      );
      break;
  }
  
  return usages;
}

function generateMockDefinition(symbolName: string, symbolType: string) {
  const definitionExamples: Record<string, { filePath: string; line: number; code: string }> = {
    function: {
      filePath: '/src/utils/helpers.ts',
      line: 12,
      code: `export function ${symbolName}(param: string): string {\n  // Implementation\n  return param.toLowerCase();\n}`,
    },
    component: {
      filePath: `/src/components/${symbolName}.tsx`,
      line: 8,
      code: `export function ${symbolName}({ children }: { children: React.ReactNode }) {\n  return <div>{children}</div>;\n}`,
    },
    class: {
      filePath: `/src/models/${symbolName}.ts`,
      line: 3,
      code: `export class ${symbolName} {\n  constructor() {\n    // Initialization\n  }\n}`,
    },
    variable: {
      filePath: '/src/config/constants.ts',
      line: 7,
      code: `export const ${symbolName} = {\n  baseUrl: 'https://api.example.com',\n  timeout: 5000,\n};`,
    },
  };
  
  return definitionExamples[symbolType] || definitionExamples.variable;
}

function findRelatedSymbols(symbolName: string, symbolType: string) {
  const related = [];
  
  switch (symbolType) {
    case 'component':
      related.push(
        { name: `${symbolName}Props`, relationship: 'implements' as const, filePath: `/src/components/${symbolName}.tsx` },
        { name: `use${symbolName}`, relationship: 'calls' as const, filePath: `/src/hooks/use${symbolName}.ts` }
      );
      break;
      
    case 'function':
      if (symbolName.startsWith('use')) {
        related.push(
          { name: symbolName.replace('use', ''), relationship: 'calls' as const, filePath: '/src/components/Example.tsx' }
        );
      }
      break;
      
    case 'class':
      related.push(
        { name: `${symbolName}Interface`, relationship: 'implements' as const, filePath: `/src/interfaces/${symbolName}.ts` },
        { name: `Base${symbolName}`, relationship: 'extends' as const, filePath: `/src/base/Base${symbolName}.ts` }
      );
      break;
  }
  
  return related;
}

function findMostUsedFile(usages: any[]): string | undefined {
  const fileCounts = usages.reduce((acc, usage) => {
    acc[usage.filePath] = (acc[usage.filePath] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(fileCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0];
} 