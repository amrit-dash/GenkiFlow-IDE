/**
 * @fileOverview Smart content insertion tool for intelligent file content merging.
 *
 * - smartContentInsertion: Analyzes existing file content and intelligently inserts new content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for smart content insertion
const SmartContentInsertionInputSchema = z.object({
  existingContent: z.string().describe('The current content of the file'),
  newContent: z.string().describe('The new content to be inserted'),
  filePath: z.string().describe('The path of the file being modified'),
  insertionContext: z.string().describe('Context about what the new content is (e.g., "new function", "documentation section", "configuration")'),
  preserveExisting: z.boolean().default(true).describe('Whether to preserve all existing content'),
});

// Define the output schema
const SmartContentInsertionOutputSchema = z.object({
  mergedContent: z.string().describe('The final merged content'),
  insertionPoint: z.string().describe('Description of where the content was inserted'),
  insertionType: z.enum(['append', 'prepend', 'insert_after_section', 'insert_before_section', 'replace_section', 'add_import', 'add_function']),
  reasoning: z.string().describe('Explanation of why this insertion method was chosen'),
  success: z.boolean().describe('Whether the insertion was successful'),
});

export const smartContentInsertion = ai.defineTool(
  {
    name: 'smartContentInsertion',
    description: 'Intelligently inserts new content into existing files based on file type, structure, and context. Preserves existing content and finds the most appropriate insertion point.',
    inputSchema: SmartContentInsertionInputSchema,
    outputSchema: SmartContentInsertionOutputSchema,
  },
  async (input) => {
    console.log('Smart content insertion called for:', input.filePath);
    
    const { existingContent, newContent, filePath, insertionContext } = input;
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    
    // Determine file type and insertion strategy
    const insertionStrategy = determineInsertionStrategy(fileExtension, existingContent, newContent, insertionContext, filePath);
    
    // Perform the smart insertion
    const mergedContent = performSmartInsertion(existingContent, newContent, insertionStrategy);
    
    return {
      mergedContent,
      insertionPoint: insertionStrategy.insertionPoint,
      insertionType: insertionStrategy.type,
      reasoning: insertionStrategy.reasoning,
      success: true,
    };
  }
);

// Helper function to determine the best insertion strategy
function determineInsertionStrategy(fileExtension: string, existingContent: string, newContent: string, context: string, filePath: string) {
  const contextLower = context.toLowerCase();
  const newContentLower = newContent.toLowerCase();
  
  // README and documentation files
  if (fileExtension === 'md' || fileExtension === 'txt' || filePath.toLowerCase().includes('readme')) {
    if (contextLower.includes('section') || newContent.includes('#') || newContent.includes('##')) {
      return {
        type: 'append' as const,
        insertionPoint: 'End of file as new section',
        reasoning: 'Documentation files should have new sections appended to maintain structure',
      };
    }
    return {
      type: 'append' as const,
      insertionPoint: 'End of file',
      reasoning: 'Default append for documentation files',
    };
  }
  
  // JavaScript/TypeScript files
  if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
    if (newContentLower.includes('import') && existingContent.includes('import')) {
      return {
        type: 'add_import' as const,
        insertionPoint: 'After existing imports',
        reasoning: 'Import statements should be grouped together at the top',
      };
    }
    
    if (newContentLower.includes('function') || newContentLower.includes('const') || newContentLower.includes('export')) {
      return {
        type: 'add_function' as const,
        insertionPoint: 'Before export default or at end of file',
        reasoning: 'Functions should be added in appropriate scope, before default exports',
      };
    }
    
    return {
      type: 'append' as const,
      insertionPoint: 'End of file',
      reasoning: 'Default append for code files',
    };
  }
  
  // Python files
  if (fileExtension === 'py') {
    if (newContentLower.includes('import')) {
      return {
        type: 'add_import' as const,
        insertionPoint: 'After existing imports',
        reasoning: 'Import statements should be at the top of Python files',
      };
    }
    
    if (newContentLower.includes('def ') || newContentLower.includes('class ')) {
      return {
        type: 'add_function' as const,
        insertionPoint: 'End of file',
        reasoning: 'Functions and classes should be added at the end of Python files',
      };
    }
    
    return {
      type: 'append' as const,
      insertionPoint: 'End of file',
      reasoning: 'Default append for Python files',
    };
  }
  
  // CSS files
  if (['css', 'scss', 'sass'].includes(fileExtension)) {
    return {
      type: 'append' as const,
      insertionPoint: 'End of file',
      reasoning: 'CSS rules should be appended to maintain cascade order',
    };
  }
  
  // JSON files
  if (fileExtension === 'json') {
    return {
      type: 'replace_section' as const,
      insertionPoint: 'Merged with existing JSON structure',
      reasoning: 'JSON files require careful merging to maintain valid structure',
    };
  }
  
  // Default strategy
  return {
    type: 'append' as const,
    insertionPoint: 'End of file',
    reasoning: 'Default append strategy for unknown file types',
  };
}

// Helper function to perform the actual insertion
function performSmartInsertion(existingContent: string, newContent: string, strategy: any): string {
  const existing = existingContent.trim();
  const newContentTrimmed = newContent.trim();
  
  switch (strategy.type) {
    case 'append':
      return existing + '\n\n' + newContentTrimmed;
      
    case 'prepend':
      return newContentTrimmed + '\n\n' + existing;
      
    case 'add_import':
      // Find the last import statement and add after it
      const lines = existing.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('from ')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, newContentTrimmed);
        return lines.join('\n');
      }
      
      // If no imports found, prepend
      return newContentTrimmed + '\n\n' + existing;
      
    case 'add_function':
      // For JavaScript/TypeScript, add before export default
      if (existing.includes('export default')) {
        const exportIndex = existing.lastIndexOf('export default');
        const beforeExport = existing.substring(0, exportIndex).trim();
        const afterExport = existing.substring(exportIndex);
        return beforeExport + '\n\n' + newContentTrimmed + '\n\n' + afterExport;
      }
      
      // Default to append
      return existing + '\n\n' + newContentTrimmed;
      
    case 'insert_after_section':
      // Look for section headers and insert after the specified section
      // This would need more sophisticated parsing based on the context
      return existing + '\n\n' + newContentTrimmed;
      
    case 'replace_section':
      // For JSON files, attempt to merge
      if (strategy.insertionPoint.includes('JSON')) {
        try {
          const existingJson = JSON.parse(existing);
          const newJson = JSON.parse(newContentTrimmed);
          const merged = { ...existingJson, ...newJson };
          return JSON.stringify(merged, null, 2);
        } catch (e) {
          // If parsing fails, append
          return existing + '\n\n' + newContentTrimmed;
        }
      }
      return existing + '\n\n' + newContentTrimmed;
      
    default:
      return existing + '\n\n' + newContentTrimmed;
  }
} 