/**
 * @fileOverview Defines a Genkit tool for file system operations.
 *
 * - fileSystemOperations: A tool that analyzes file system structure and suggests operations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

// Define the input schema for the tool
const FileSystemOperationsInputSchema = z.object({
  operation: z.enum(['create', 'delete', 'rename', 'analyze', 'move']).describe('The type of operation to suggest or analyze'),
  currentFileSystemTree: z.string().describe('The current file system structure as a tree string'),
  targetPath: z.string().optional().describe('The path of the file/folder to operate on (for delete/rename)'),
  newName: z.string().optional().describe('The new name for rename operations'),
  fileType: z.enum(['file', 'folder']).optional().describe('The type of item to create'),
  suggestedLocation: z.string().optional().describe('Suggested location for new files/folders'),
  context: z.string().optional().describe('Additional context about why this operation is needed'),
  content: z.string().optional().describe('Content to be written to the file'),
  destinationPath: z.string().optional().describe('Destination path for move operations'),
  openInIDE: z.boolean().optional().describe('Whether to open the file in IDE after creation'),
});

// Define the output schema for the tool
const FileSystemOperationsOutputSchema = z.object({
  suggestion: z.object({
    operation: z.enum(['create', 'delete', 'rename', 'move', 'none']),
    reasoning: z.string().describe('Explanation of why this operation is suggested'),
    targetPath: z.string().optional().describe('The path where the operation should be performed'),
    newName: z.string().optional().describe('New name for the file/folder'),
    fileType: z.enum(['file', 'folder']).optional().describe('Type of item for create operations'),
    suggestedContent: z.string().optional().describe('Suggested initial content for new files'),
    confidence: z.number().min(0).max(1).describe('Confidence level of the suggestion (0-1)'),
    requiresConfirmation: z.boolean().default(true).describe('Whether this operation requires user confirmation'),
    openInIDE: z.boolean().optional().describe('Whether to open the file in IDE after creation'),
    destinationPath: z.string().optional().describe('Destination path for move operations'),
  }).describe('The suggested file system operation'),
  alternativeLocations: z.array(z.string()).optional().describe('Alternative locations where the file could be placed'),
  userActions: z.array(z.object({
    type: z.enum(['confirm', 'cancel', 'modify']),
    label: z.string(),
    icon: z.string(),
  })).optional().describe('Available user actions for this operation'),
});

// Interface for project structure analysis
interface ProjectStructure {
  hasGitIgnore: boolean;
  hasPackageJson: boolean;
  hasReadme: boolean;
  hasSrcFolder: boolean;
  hasTestsFolder: boolean;
  isTypescript: boolean;
  isReact: boolean;
  hasNext: boolean;
  mainEntryPoint: string | null;
  packageManager: 'npm' | 'yarn' | 'pnpm' | null;
}

// Analyze project structure
async function analyzeProjectStructure(rootPath: string): Promise<ProjectStructure> {
  const files = await glob('**/*', {
    cwd: rootPath,
    dot: true,
    ignore: ['node_modules/**', '.git/**'],
  });

  const structure: ProjectStructure = {
    hasGitIgnore: false,
    hasPackageJson: false,
    hasReadme: false,
    hasSrcFolder: false,
    hasTestsFolder: false,
    isTypescript: false,
    isReact: false,
    hasNext: false,
    mainEntryPoint: null,
    packageManager: null,
  };

  // Check for specific files and folders
  structure.hasGitIgnore = files.includes('.gitignore');
  structure.hasPackageJson = files.includes('package.json');
  structure.hasReadme = files.some(f => /^readme\.md$/i.test(f));
  structure.hasSrcFolder = files.some(f => f.startsWith('src/'));
  structure.hasTestsFolder = files.some(f => /^(test|tests|__tests__)\//.test(f));

  // Analyze package.json if present
  if (structure.hasPackageJson) {
    try {
      const packageJson = JSON.parse(await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8'));
      structure.isTypescript = Boolean(packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript);
      structure.isReact = Boolean(packageJson.dependencies?.react);
      structure.hasNext = Boolean(packageJson.dependencies?.next);
      structure.mainEntryPoint = packageJson.main || null;
    } catch (error) {
      console.error('Error reading package.json:', error);
    }
  }

  // Detect package manager
  if (await fs.stat(path.join(rootPath, 'yarn.lock')).catch(() => null)) {
    structure.packageManager = 'yarn';
  } else if (await fs.stat(path.join(rootPath, 'pnpm-lock.yaml')).catch(() => null)) {
    structure.packageManager = 'pnpm';
  } else if (await fs.stat(path.join(rootPath, 'package-lock.json')).catch(() => null)) {
    structure.packageManager = 'npm';
  }

  return structure;
}

// Suggest file location based on type and context
async function suggestFileLocation(
  rootPath: string,
  fileType: string,
  context: string,
  projectStructure: ProjectStructure
): Promise<{ path: string; alternatives: string[] }> {
  const baseFolder = projectStructure.hasSrcFolder ? 'src' : '';
  const context_lower = context.toLowerCase();
  
  // Default location and alternatives
  let suggestedPath = baseFolder;
  let alternativesList: string[] = [];

  if (fileType === 'file') {
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(context)) {
      // Test files
      if (projectStructure.hasTestsFolder) {
        suggestedPath = 'tests';
        alternativesList = ['__tests__', 'test'];
      } else {
        suggestedPath = '__tests__';
        alternativesList = ['tests', 'test'];
      }
    } else if (context_lower.includes('component') || /\.(tsx|jsx)$/.test(context)) {
      // React components
      suggestedPath = path.join(baseFolder, 'components');
      alternativesList = [
        path.join(baseFolder, 'ui'),
        path.join(baseFolder, 'views'),
        baseFolder
      ];
    } else if (context_lower.includes('api') || context_lower.includes('service')) {
      // API/Service files
      suggestedPath = path.join(baseFolder, 'api');
      alternativesList = [
        path.join(baseFolder, 'services'),
        path.join(baseFolder, 'lib')
      ];
    } else if (context_lower.includes('util') || context_lower.includes('helper')) {
      // Utility files
      suggestedPath = path.join(baseFolder, 'utils');
      alternativesList = [
        path.join(baseFolder, 'lib'),
        path.join(baseFolder, 'helpers')
      ];
    } else if (context_lower.includes('type') || context_lower.includes('interface')) {
      // Type definitions
      suggestedPath = path.join(baseFolder, 'types');
      alternativesList = [
        path.join(baseFolder, 'interfaces'),
        baseFolder
      ];
    } else if (context_lower.includes('hook')) {
      // React hooks
      suggestedPath = path.join(baseFolder, 'hooks');
      alternativesList = [
        path.join(baseFolder, 'lib'),
        baseFolder
      ];
    } else if (context_lower.includes('context') || context_lower.includes('provider')) {
      // Context providers
      suggestedPath = path.join(baseFolder, 'contexts');
      alternativesList = [
        path.join(baseFolder, 'providers'),
        baseFolder
      ];
    }
  } else if (fileType === 'folder') {
    if (context_lower.includes('component')) {
      suggestedPath = path.join(baseFolder, 'components');
      alternativesList = [path.join(baseFolder, 'ui')];
    } else if (context_lower.includes('test')) {
      suggestedPath = 'tests';
      alternativesList = ['__tests__', 'test'];
    } else if (context_lower.includes('doc')) {
      suggestedPath = 'docs';
      alternativesList = ['documentation'];
    }
  }

  // Ensure all paths are absolute
  return {
    path: path.join(rootPath, suggestedPath),
    alternatives: alternativesList.map(alt => path.join(rootPath, alt))
  };
}

// Generate initial content for new files
function generateInitialContent(fileName: string, projectStructure: ProjectStructure): string {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  
  switch (ext) {
    case '.tsx':
      return `import React from 'react';\n\ninterface ${baseName}Props {\n  // Define props here\n}\n\nexport const ${baseName}: React.FC<${baseName}Props> = (props) => {\n  return (\n    <div>\n      {/* Component content */}\n    </div>\n  );\n};\n`;
    
    case '.ts':
      if (fileName.endsWith('.d.ts')) {
        return `// Type definitions for ${baseName}\n\nexport interface ${baseName} {\n  // Define interface properties\n}\n`;
      } else if (fileName.includes('.test.') || fileName.includes('.spec.')) {
        return `import { describe, it, expect } from '@jest/globals';\n\ndescribe('${baseName}', () => {\n  it('should work correctly', () => {\n    // Write test here\n  });\n});\n`;
      }
      return `// ${baseName} implementation\n\nexport function ${baseName}() {\n  // Implementation here\n}\n`;
    
    case '.js':
    case '.jsx':
      if (fileName.includes('.test.') || fileName.includes('.spec.')) {
        return `describe('${baseName}', () => {\n  it('should work correctly', () => {\n    // Write test here\n  });\n});\n`;
      }
      return `// ${baseName} implementation\n\nexport function ${baseName}() {\n  // Implementation here\n}\n`;
    
    case '.css':
    case '.scss':
      return `/* Styles for ${baseName} */\n\n`;
    
    case '.md':
      return `# ${baseName}\n\n## Overview\n\nDescription goes here.\n\n## Usage\n\nUsage instructions go here.\n`;
    
    case '.json':
      return '{\n  \n}\n';
    
    default:
      return '';
  }
}

export const fileSystemOperations = ai.defineTool(
  {
    name: 'fileSystemOperations',
    description: 'Analyzes file system structure and suggests appropriate file/folder operations based on context and best practices.',
    inputSchema: FileSystemOperationsInputSchema,
    outputSchema: FileSystemOperationsOutputSchema,
  },
  async (input): Promise<z.infer<typeof FileSystemOperationsOutputSchema>> => {
    console.log(`File system operations tool called with operation: ${input.operation}`);
    
    try {
      const rootPath = process.cwd();
      const projectStructure = await analyzeProjectStructure(rootPath);

      switch (input.operation) {
        case 'create': {
          if (!input.fileType) {
            throw new Error('fileType is required for create operation');
          }

          const { path: suggestedPath, alternatives } = await suggestFileLocation(
            rootPath,
            input.fileType,
            input.context || '',
            projectStructure
          );

          let suggestedContent = '';
          if (input.fileType === 'file') {
            if (input.content) {
              suggestedContent = input.content;
            } else if (input.targetPath) {
              suggestedContent = generateInitialContent(input.targetPath, projectStructure);
            }
          }

          return {
            suggestion: {
              operation: 'create' as const,
              reasoning: `Based on the project structure and context, this ${input.fileType} should be created in ${suggestedPath}`,
              targetPath: suggestedPath,
              fileType: input.fileType,
              suggestedContent,
              confidence: 0.8,
              requiresConfirmation: true,
              openInIDE: input.openInIDE ?? true,
            },
            alternativeLocations: alternatives,
            userActions: [
              { type: 'confirm' as const, label: `Create New ${input.fileType}`, icon: input.fileType === 'file' ? 'file-plus' : 'folder-plus' },
              { type: 'modify' as const, label: 'Choose Different Location', icon: 'folder' },
              { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
            ],
          };
        }

        case 'delete': {
          if (!input.targetPath) {
            throw new Error('targetPath is required for delete operation');
          }

          // Check if path exists
          const exists = await fs.stat(input.targetPath).catch(() => null);
          if (!exists) {
            return {
              suggestion: {
                operation: 'none' as const,
                reasoning: 'The specified path does not exist',
                confidence: 1,
                requiresConfirmation: false,
              },
            };
          }

          // Check for potential issues
          const isImportant = input.targetPath.includes('package.json') || 
                            input.targetPath.includes('tsconfig.json') ||
                            /readme\.md$/i.test(input.targetPath);

          return {
            suggestion: {
              operation: 'delete' as const,
              reasoning: isImportant 
                ? 'Warning: This appears to be an important project file'
                : 'The file/folder can be safely deleted',
              targetPath: input.targetPath,
              confidence: isImportant ? 0.5 : 0.9,
              requiresConfirmation: true,
            },
            userActions: [
              { type: 'confirm' as const, label: 'Delete', icon: 'trash' },
              { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
            ],
          };
        }

        case 'rename': {
          if (!input.targetPath || !input.newName) {
            throw new Error('targetPath and newName are required for rename operation');
          }

          // Check if source exists
          const exists = await fs.stat(input.targetPath).catch(() => null);
          if (!exists) {
            return {
              suggestion: {
                operation: 'none' as const,
                reasoning: 'The specified path does not exist',
                confidence: 1,
                requiresConfirmation: false,
              },
            };
          }

          // Check if destination already exists
          const newPath = path.join(path.dirname(input.targetPath), input.newName);
          const destinationExists = await fs.stat(newPath).catch(() => null);
          if (destinationExists) {
            return {
              suggestion: {
                operation: 'none' as const,
                reasoning: 'A file or folder with the new name already exists',
                confidence: 1,
                requiresConfirmation: false,
              },
            };
          }

          return {
            suggestion: {
              operation: 'rename' as const,
              reasoning: 'The file/folder can be renamed safely',
              targetPath: input.targetPath,
              newName: input.newName,
              confidence: 0.9,
              requiresConfirmation: true,
            },
            userActions: [
              { type: 'confirm' as const, label: 'Rename', icon: 'edit' },
              { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
            ],
          };
        }

        case 'move': {
          if (!input.targetPath || !input.destinationPath) {
            throw new Error('targetPath and destinationPath are required for move operation');
          }

          // Check if source exists
          const exists = await fs.stat(input.targetPath).catch(() => null);
          if (!exists) {
            return {
              suggestion: {
                operation: 'none' as const,
                reasoning: 'The specified source path does not exist',
                confidence: 1,
                requiresConfirmation: false,
              },
            };
          }

          // Check if destination is valid
          const destExists = await fs.stat(input.destinationPath).catch(() => null);
          if (!destExists || !destExists.isDirectory()) {
            return {
              suggestion: {
                operation: 'none' as const,
                reasoning: 'The destination path is not a valid directory',
                confidence: 1,
                requiresConfirmation: false,
              },
            };
          }

          // Check if destination file already exists
          const destPath = path.join(input.destinationPath, path.basename(input.targetPath));
          const fileExists = await fs.stat(destPath).catch(() => null);
          if (fileExists) {
            return {
              suggestion: {
                operation: 'none' as const,
                reasoning: 'A file with the same name already exists in the destination',
                confidence: 1,
                requiresConfirmation: false,
              },
            };
          }

          return {
            suggestion: {
              operation: 'move' as const,
              reasoning: 'The file/folder can be moved safely',
              targetPath: input.targetPath,
              destinationPath: input.destinationPath,
              confidence: 0.9,
              requiresConfirmation: true,
            },
            userActions: [
              { type: 'confirm' as const, label: 'Move', icon: 'move' },
              { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
            ],
          };
        }

        case 'analyze': {
          return {
            suggestion: {
              operation: 'none' as const,
              reasoning: [
                'Project structure analysis completed',
                !projectStructure.hasReadme && '- Consider adding a README.md file',
                !projectStructure.hasGitIgnore && '- Consider adding a .gitignore file',
                projectStructure.isTypescript && !projectStructure.hasSrcFolder && '- Consider organizing code in a src/ directory',
                !projectStructure.hasTestsFolder && '- Consider adding a tests/ directory'
              ].filter(Boolean).join('\n'),
              confidence: 1,
              requiresConfirmation: false,
            },
          };
        }

        default:
          throw new Error(`Unsupported operation: ${input.operation}`);
      }
    } catch (error) {
      console.error('Error in file system operations:', error);
      throw new Error(`Failed to perform file system operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);