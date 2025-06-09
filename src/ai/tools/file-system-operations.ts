/**
 * @fileOverview Defines a Genkit tool for file system operations.
 *
 * - fileSystemOperations: A tool that analyzes file system structure and suggests operations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

export const fileSystemOperations = ai.defineTool(
  {
    name: 'fileSystemOperations',
    description: 'Analyzes file system structure and suggests appropriate file/folder operations based on context and best practices.',
    inputSchema: FileSystemOperationsInputSchema,
    outputSchema: FileSystemOperationsOutputSchema,
  },
  async (input) => {
    console.log(`File system operations tool called with operation: ${input.operation}`);
    
    // Analyze the file system tree structure
    const hasGitIgnore = input.currentFileSystemTree.includes('.gitignore');
    const hasPackageJson = input.currentFileSystemTree.includes('package.json');
    const hasReadme = input.currentFileSystemTree.includes('README');
    const hasSrcFolder = input.currentFileSystemTree.includes('src/');
    const hasTestsFolder = input.currentFileSystemTree.includes('test/') || input.currentFileSystemTree.includes('tests/');
    
    switch (input.operation) {
      case 'create':
        if (input.fileType === 'file') {
          // Suggest appropriate location for new file based on extension and context
          const context = input.context?.toLowerCase() || '';
          let suggestedPath = '/';
          let suggestedContent = input.content || '';
          
          if (context.includes('component') || context.includes('react')) {
            suggestedPath = hasSrcFolder ? '/src/components/' : '/components/';
            suggestedContent = suggestedContent || 'import React from \'react\';\n\nexport default function NewComponent() {\n  return (\n    <div>\n      {/* Component content */}\n    </div>\n  );\n}\n';
          } else if (context.includes('utility') || context.includes('helper')) {
            suggestedPath = hasSrcFolder ? '/src/lib/' : '/lib/';
            suggestedContent = suggestedContent || '// Utility functions\n\nexport function newUtility() {\n  // Implementation\n}\n';
          } else if (context.includes('test')) {
            suggestedPath = hasTestsFolder ? '/tests/' : '/test/';
            suggestedContent = suggestedContent || '// Test file\n\ndescribe(\'Test Suite\', () => {\n  it(\'should test functionality\', () => {\n    // Test implementation\n  });\n});\n';
          } else if (context.includes('config')) {
            suggestedPath = '/';
            suggestedContent = suggestedContent || '// Configuration file\n\nexport default {\n  // Configuration options\n};\n';
          } else {
            suggestedPath = hasSrcFolder ? '/src/' : '/';
          }
          
          return {
            suggestion: {
              operation: 'create' as const,
              reasoning: `Based on the context "${context}" and current project structure, this file should be placed in ${suggestedPath} following common conventions.`,
              targetPath: suggestedPath,
              fileType: 'file' as const,
              suggestedContent,
              confidence: 0.8,
              requiresConfirmation: true,
              openInIDE: input.openInIDE ?? true,
            },
            alternativeLocations: hasSrcFolder ? ['/src/', '/src/lib/', '/'] : ['/lib/', '/utils/', '/'],
            userActions: [
              { type: 'confirm' as const, label: 'Create New File', icon: 'file-plus' },
              { type: 'confirm' as const, label: 'Add to Existing File', icon: 'file-edit' },
              { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
            ],
          };
        } else {
          // Suggest folder creation
          return {
            suggestion: {
              operation: 'create' as const,
              reasoning: 'Creating a new folder to organize related files.',
              targetPath: input.suggestedLocation || '/',
              fileType: 'folder' as const,
              confidence: 0.7,
              requiresConfirmation: true,
            },
            userActions: [
              { type: 'confirm' as const, label: 'Create Folder', icon: 'folder-plus' },
              { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
            ],
          };
        }
        
      case 'delete':
        return {
          suggestion: {
            operation: 'delete' as const,
            reasoning: `Suggested deletion of ${input.targetPath}. Please confirm this action as it cannot be undone.`,
            targetPath: input.targetPath,
            confidence: 0.6,
            requiresConfirmation: true,
          },
          userActions: [
            { type: 'confirm' as const, label: 'Delete', icon: 'trash' },
            { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
          ],
        };
        
      case 'rename':
        return {
          suggestion: {
            operation: 'rename' as const,
            reasoning: `Renaming ${input.targetPath} to ${input.newName} for better clarity and naming conventions.`,
            targetPath: input.targetPath,
            newName: input.newName,
            confidence: 0.8,
            requiresConfirmation: true,
          },
          userActions: [
            { type: 'confirm' as const, label: 'Rename', icon: 'edit' },
            { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
          ],
        };

      case 'move':
        return {
          suggestion: {
            operation: 'move' as const,
            reasoning: `Moving ${input.targetPath} to ${input.destinationPath} for better organization.`,
            targetPath: input.targetPath,
            destinationPath: input.destinationPath,
            confidence: 0.7,
            requiresConfirmation: true,
          },
          userActions: [
            { type: 'confirm' as const, label: 'Move', icon: 'move' },
            { type: 'cancel' as const, label: 'Cancel', icon: 'x' },
          ],
        };
        
      case 'analyze':
      default:
        // Analyze current structure and suggest improvements
        const suggestions = [];
        
        if (!hasGitIgnore && hasPackageJson) {
          suggestions.push('Consider adding a .gitignore file to exclude node_modules and other build artifacts.');
        }
        
        if (!hasReadme) {
          suggestions.push('Consider adding a README.md file to document your project.');
        }
        
        if (hasPackageJson && !hasTestsFolder) {
          suggestions.push('Consider adding a tests/ folder for unit tests.');
        }
        
        return {
          suggestion: {
            operation: 'none' as const,
            reasoning: suggestions.length > 0 
              ? `File system analysis complete. Suggestions: ${suggestions.join(' ')}`
              : 'File system structure looks well organized.',
            confidence: 0.9,
            requiresConfirmation: false,
          },
        };
    }
  }
); 