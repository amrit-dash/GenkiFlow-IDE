/**
 * @fileOverview Defines a Genkit tool for executing file system operations.
 *
 * - fileSystemExecutor: A tool that actually executes file system operations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the executor tool
const FileSystemExecutorInputSchema = z.object({
  operation: z.enum(['create', 'delete', 'rename', 'move', 'list']).describe('The operation to execute'),
  targetPath: z.string().optional().describe('The path of the file/folder to operate on'),
  newName: z.string().optional().describe('The new name for rename operations'),
  destinationPath: z.string().optional().describe('Destination path for move operations'),
  content: z.string().optional().describe('Content for new files'),
  fileType: z.enum(['file', 'folder']).optional().describe('Type for create operations'),
  currentFileSystemTree: z.string().describe('Current file system state'),
});

// Define the output schema for the executor tool
const FileSystemExecutorOutputSchema = z.object({
  success: z.boolean().describe('Whether the operation was successful'),
  operation: z.enum(['create', 'delete', 'rename', 'move', 'list']),
  message: z.string().describe('Human-readable message about the operation result'),
  targetPath: z.string().optional().describe('The path that was operated on'),
  newPath: z.string().optional().describe('New path after operation (for rename/move)'),
  filesFound: z.array(z.string()).optional().describe('List of files found (for list operations)'),
  requiresUserConfirmation: z.boolean().default(false).describe('Whether this operation needs user confirmation'),
  confirmationMessage: z.string().optional().describe('Message to show user for confirmation'),
});

export const fileSystemExecutor = ai.defineTool(
  {
    name: 'fileSystemExecutor',
    description: 'Executes file system operations like delete, rename, move files and folders. Can also list and search for files in the project.',
    inputSchema: FileSystemExecutorInputSchema,
    outputSchema: FileSystemExecutorOutputSchema,
  },
  async (input) => {
    console.log(`File system executor called with operation: ${input.operation}`);
    
    const fileSystemTree = input.currentFileSystemTree;
    
    switch (input.operation) {
      case 'list':
        // Extract file paths from the file system tree
        const lines = fileSystemTree.split('\n');
        const files: string[] = [];
        
        for (const line of lines) {
          // Look for file patterns in the tree (lines that end with file extensions or are marked as files)
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('├──') && !trimmedLine.startsWith('└──') && !trimmedLine.startsWith('│')) {
            // Check if it looks like a file (has extension or specific patterns)
            if (trimmedLine.includes('.') || trimmedLine.toLowerCase().includes('untitled')) {
              files.push(trimmedLine);
            }
          } else {
            // Parse tree structure lines
            const match = trimmedLine.match(/[├└]── (.+)/);
            if (match) {
              const fileName = match[1];
              if (fileName.includes('.') || fileName.toLowerCase().includes('untitled')) {
                files.push(fileName);
              }
            }
          }
        }
        
        return {
          success: true,
          operation: 'list' as const,
          message: `Found ${files.length} files in the project`,
          filesFound: files,
          requiresUserConfirmation: false,
        };
        
      case 'delete':
        if (!input.targetPath) {
          return {
            success: false,
            operation: 'delete' as const,
            message: 'Target path is required for delete operation',
            requiresUserConfirmation: false,
          };
        }
        
        // Check if the file exists in the file system tree
        const fileExists = fileSystemTree.includes(input.targetPath) || 
                          fileSystemTree.toLowerCase().includes(input.targetPath.toLowerCase());
        
        if (!fileExists) {
          return {
            success: false,
            operation: 'delete' as const,
            message: `File "${input.targetPath}" not found in the file system`,
            targetPath: input.targetPath,
            requiresUserConfirmation: false,
          };
        }
        
        return {
          success: true,
          operation: 'delete' as const,
          message: `Ready to delete "${input.targetPath}". This action cannot be undone.`,
          targetPath: input.targetPath,
          requiresUserConfirmation: true,
          confirmationMessage: `Are you sure you want to delete "${input.targetPath}"? This action cannot be undone.`,
        };
        
      case 'rename':
        if (!input.targetPath || !input.newName) {
          return {
            success: false,
            operation: 'rename' as const,
            message: 'Target path and new name are required for rename operation',
            requiresUserConfirmation: false,
          };
        }
        
        const renameFileExists = fileSystemTree.includes(input.targetPath) || 
                               fileSystemTree.toLowerCase().includes(input.targetPath.toLowerCase());
        
        if (!renameFileExists) {
          return {
            success: false,
            operation: 'rename' as const,
            message: `File "${input.targetPath}" not found in the file system`,
            targetPath: input.targetPath,
            requiresUserConfirmation: false,
          };
        }
        
        const pathParts = input.targetPath.split('/');
        pathParts[pathParts.length - 1] = input.newName;
        const newPath = pathParts.join('/');
        
        return {
          success: true,
          operation: 'rename' as const,
          message: `Ready to rename "${input.targetPath}" to "${input.newName}"`,
          targetPath: input.targetPath,
          newPath: newPath,
          requiresUserConfirmation: true,
          confirmationMessage: `Rename "${input.targetPath}" to "${input.newName}"?`,
        };
        
      case 'move':
        if (!input.targetPath || !input.destinationPath) {
          return {
            success: false,
            operation: 'move' as const,
            message: 'Target path and destination path are required for move operation',
            requiresUserConfirmation: false,
          };
        }
        
        const moveFileExists = fileSystemTree.includes(input.targetPath) || 
                             fileSystemTree.toLowerCase().includes(input.targetPath.toLowerCase());
        
        if (!moveFileExists) {
          return {
            success: false,
            operation: 'move' as const,
            message: `File "${input.targetPath}" not found in the file system`,
            targetPath: input.targetPath,
            requiresUserConfirmation: false,
          };
        }
        
        const fileName = input.targetPath.split('/').pop() || '';
        const newMovePath = input.destinationPath.endsWith('/') 
          ? input.destinationPath + fileName 
          : input.destinationPath + '/' + fileName;
        
        return {
          success: true,
          operation: 'move' as const,
          message: `Ready to move "${input.targetPath}" to "${input.destinationPath}"`,
          targetPath: input.targetPath,
          newPath: newMovePath,
          requiresUserConfirmation: true,
          confirmationMessage: `Move "${input.targetPath}" to "${input.destinationPath}"?`,
        };
        
      case 'create':
        if (!input.fileType) {
          return {
            success: false,
            operation: 'create' as const,
            message: 'File type is required for create operation',
            requiresUserConfirmation: false,
          };
        }
        
        const createPath = input.targetPath || (input.fileType === 'file' ? '/NewFile.txt' : '/NewFolder');
        
        return {
          success: true,
          operation: 'create' as const,
          message: `Ready to create new ${input.fileType} at "${createPath}"`,
          targetPath: createPath,
          requiresUserConfirmation: true,
          confirmationMessage: `Create new ${input.fileType} at "${createPath}"?`,
        };
        
      default:
        return {
          success: false,
          operation: input.operation,
          message: `Unknown operation: ${input.operation}`,
          requiresUserConfirmation: false,
        };
    }
  }
); 