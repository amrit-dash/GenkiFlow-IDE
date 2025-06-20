/**
 * @fileOverview Intent Classification Tool for Enhanced Code Generation
 * 
 * This tool analyzes user prompts and classifies them into specific intents
 * to route requests to appropriate specialized tools.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the input schema
const IntentClassifierInputSchema = z.object({
  prompt: z.string().describe('The user prompt to analyze'),
  context: z.object({
    hasAttachedFiles: z.boolean().describe('Whether user has attached files'),
    attachedFilesInfo: z.string().optional().describe('Summary of attached files'),
    currentFileName: z.string().optional().describe('Currently active file name'),
    currentFilePath: z.string().optional().describe('Currently active file path'),
    hasFileContent: z.boolean().describe('Whether there is content in current file'),
  }).describe('Context information about the current state'),
});

// Define the output schema
const IntentClassifierOutputSchema = z.object({
  primaryIntent: z.enum([
    'generate_code',           // Create new code/files
    'modify_code',            // Edit existing code
    'suggest_filename',       // Suggest names for files/folders
    'file_operation',         // File system operations (create, rename, move, delete)
    'ask_question',          // General questions or help
    'explain_code',          // Explain existing code
    'debug_code',            // Fix errors or debug issues
    'refactor_code',         // Improve existing code structure
  ]).describe('The primary intent category'),
  
  confidence: z.number().min(0).max(1).describe('Confidence in classification (0-1)'),
  
  subIntent: z.object({
    operation: z.string().optional().describe('Specific operation (e.g., "create_file", "rename_folder", "move_to_location")'),
    target: z.string().optional().describe('What the operation targets (e.g., "python_script", "web_scraper", "component")'),
    context: z.string().optional().describe('Additional context about the intent'),
  }).describe('More specific details about the intent'),
  
  routingInfo: z.object({
    toolToCall: z.enum([
      'code_generator',
      'file_operations',
      'filename_suggester', 
      'general_assistant',
      'code_modifier',
      'code_explainer',
    ]).describe('Which specialized tool should handle this request'),
    
    priority: z.enum(['high', 'medium', 'low']).describe('Priority level for processing'),
    
    requiresUserConfirmation: z.boolean().describe('Whether this action needs user confirmation'),
    
    expectedOutputType: z.enum([
      'code_content',
      'file_suggestion', 
      'operation_confirmation',
      'explanation_text',
      'filename_suggestions',
    ]).describe('What type of output is expected'),
  }).describe('Information for routing to appropriate tool'),
  
  analysis: z.object({
    keywords: z.array(z.string()).describe('Key terms extracted from the prompt'),
    actionVerbs: z.array(z.string()).describe('Action verbs identified'),
    programmingLanguage: z.string().optional().describe('Programming language mentioned or implied'),
    fileType: z.string().optional().describe('Type of file involved (if any)'),
    domainContext: z.string().optional().describe('Domain or context (e.g., "web_scraping", "ui_components")'),
  }).describe('Detailed analysis of the prompt'),
});

export const intentClassifier = ai.defineTool(
  {
    name: 'intentClassifier',
    description: 'Analyzes user prompts to classify intent and determine appropriate routing to specialized tools',
    inputSchema: IntentClassifierInputSchema,
    outputSchema: IntentClassifierOutputSchema,
  },
  async (input) => {
    console.log(`Intent classifier analyzing prompt: "${input.prompt.substring(0, 100)}..."`);
    
    const prompt = input.prompt.toLowerCase();
    const context = input.context;
    
    // Extract keywords and action verbs
    const keywords = extractKeywords(input.prompt);
    const actionVerbs = extractActionVerbs(input.prompt);
    const programmingLanguage = detectProgrammingLanguage(input.prompt);
    const fileType = detectFileType(input.prompt);
    const domainContext = detectDomainContext(input.prompt);
    
    // Classification logic
    let primaryIntent: any = 'ask_question';
    let confidence = 0.5;
    let toolToCall: any = 'general_assistant';
    let expectedOutputType: any = 'explanation_text';
    let requiresUserConfirmation = false;
    let priority: any = 'medium';
    let operation = '';
    let target = '';
    let intentContext = '';
    
    // Code generation patterns
    if (
      prompt.includes('generate') || 
      prompt.includes('create') && (prompt.includes('script') || prompt.includes('file') || prompt.includes('code')) ||
      prompt.includes('write') && (prompt.includes('code') || prompt.includes('function') || prompt.includes('script')) ||
      prompt.includes('build') && (prompt.includes('component') || prompt.includes('module'))
    ) {
      primaryIntent = 'generate_code';
      toolToCall = 'code_generator';
      expectedOutputType = 'code_content';
      confidence = 0.9;
      priority = 'high';
      operation = 'create_file';
      target = detectTargetFromPrompt(input.prompt);
      intentContext = `User wants to generate new ${target || 'code'}`;
    }
    
    // Filename suggestion patterns
    else if (
      prompt.includes('suggest') && (prompt.includes('name') || prompt.includes('filename')) ||
      prompt.includes('rename') && !prompt.includes(' to ') ||
      prompt.includes('what should i call') ||
      prompt.includes('name suggestions') ||
      prompt.includes('what should i name')
    ) {
      primaryIntent = 'suggest_filename';
      toolToCall = 'filename_suggester';
      expectedOutputType = 'filename_suggestions';
      confidence = 0.95;
      priority = 'medium';
      operation = 'suggest_names';
      target = context.hasAttachedFiles ? 'attached_item' : 'current_file';
      intentContext = 'User wants filename suggestions';
    }
    
    // File operations patterns
    else if (
      prompt.includes('rename') && prompt.includes(' to ') ||
      prompt.includes('move') && (prompt.includes(' to ') || prompt.includes(' into ')) ||
      prompt.includes('delete') && (prompt.includes('file') || prompt.includes('folder')) ||
      prompt.includes('create') && (prompt.includes('folder') || prompt.includes('directory'))
    ) {
      primaryIntent = 'file_operation';
      toolToCall = 'file_operations';
      expectedOutputType = 'operation_confirmation';
      confidence = 0.9;
      priority = 'high';
      requiresUserConfirmation = true;
      
      if (prompt.includes('rename')) {
        operation = 'rename';
      } else if (prompt.includes('move')) {
        operation = 'move';
      } else if (prompt.includes('delete')) {
        operation = 'delete';
      } else if (prompt.includes('create') && prompt.includes('folder')) {
        operation = 'create_folder';
      }
      
      target = detectFileOperationTarget(input.prompt);
      intentContext = `User wants to ${operation} ${target}`;
    }
    
    // Code modification patterns
    else if (
      prompt.includes('modify') || 
      prompt.includes('update') || 
      prompt.includes('edit') ||
      prompt.includes('change') && context.hasFileContent ||
      prompt.includes('add') && (prompt.includes('function') || prompt.includes('method') || prompt.includes('code'))
    ) {
      primaryIntent = 'modify_code';
      toolToCall = 'code_modifier';
      expectedOutputType = 'code_content';
      confidence = 0.85;
      priority = 'high';
      operation = 'modify_existing';
      target = context.currentFileName || 'current_file';
      intentContext = 'User wants to modify existing code';
    }
    
    // Explanation patterns
    else if (
      prompt.includes('explain') ||
      prompt.includes('what does') ||
      prompt.includes('how does') ||
      prompt.includes('what is') && context.hasFileContent
    ) {
      primaryIntent = 'explain_code';
      toolToCall = 'code_explainer';
      expectedOutputType = 'explanation_text';
      confidence = 0.8;
      priority = 'low';
      operation = 'explain';
      target = 'code_or_concept';
      intentContext = 'User wants explanation or clarification';
    }
    
    // Debug patterns
    else if (
      prompt.includes('fix') ||
      prompt.includes('debug') ||
      prompt.includes('error') ||
      prompt.includes('issue') ||
      prompt.includes('problem')
    ) {
      primaryIntent = 'debug_code';
      toolToCall = 'code_modifier';
      expectedOutputType = 'code_content';
      confidence = 0.85;
      priority = 'high';
      operation = 'fix_errors';
      target = 'problematic_code';
      intentContext = 'User needs help fixing code issues';
    }
    
    // Refactor patterns
    else if (
      prompt.includes('refactor') ||
      prompt.includes('improve') ||
      prompt.includes('optimize') ||
      prompt.includes('clean up')
    ) {
      primaryIntent = 'refactor_code';
      toolToCall = 'code_modifier';
      expectedOutputType = 'code_content';
      confidence = 0.8;
      priority = 'medium';
      operation = 'refactor';
      target = context.currentFileName || 'code';
      intentContext = 'User wants to improve code quality';
    }
    
    return {
      primaryIntent,
      confidence,
      subIntent: {
        operation: operation || undefined,
        target: target || undefined,
        context: intentContext || undefined,
      },
      routingInfo: {
        toolToCall,
        priority,
        requiresUserConfirmation,
        expectedOutputType,
      },
      analysis: {
        keywords,
        actionVerbs,
        programmingLanguage: programmingLanguage || undefined,
        fileType: fileType || undefined,
        domainContext: domainContext || undefined,
      },
    };
  }
);

// Helper functions
function extractKeywords(prompt: string): string[] {
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their']);
  
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
    .slice(0, 10);
}

function extractActionVerbs(prompt: string): string[] {
  const actionVerbs = ['create', 'generate', 'build', 'make', 'write', 'add', 'modify', 'update', 'edit', 'change', 'fix', 'debug', 'refactor', 'improve', 'optimize', 'rename', 'move', 'delete', 'remove', 'explain', 'show', 'display'];
  
  return actionVerbs.filter(verb => prompt.toLowerCase().includes(verb));
}

function detectProgrammingLanguage(prompt: string): string | null {
  const languages = {
    'python': ['python', 'py', 'django', 'flask', 'pandas', 'numpy'],
    'javascript': ['javascript', 'js', 'node', 'react', 'vue', 'angular'],
    'typescript': ['typescript', 'ts', 'tsx'],
    'java': ['java', 'spring', 'maven'],
    'html': ['html', 'webpage', 'website'],
    'css': ['css', 'styling', 'styles'],
    'sql': ['sql', 'database', 'query'],
  };
  
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [lang, keywords] of Object.entries(languages)) {
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return lang;
    }
  }
  
  return null;
}

function detectFileType(prompt: string): string | null {
  const fileTypes = {
    'component': ['component', 'ui', 'interface'],
    'script': ['script', 'automation', 'tool'],
    'utility': ['utility', 'helper', 'utils'],
    'service': ['service', 'api', 'client'],
    'configuration': ['config', 'settings', 'setup'],
  };
  
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [type, keywords] of Object.entries(fileTypes)) {
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return type;
    }
  }
  
  return null;
}

function detectDomainContext(prompt: string): string | null {
  const domains = {
    'web_scraping': ['scraper', 'scraping', 'extract', 'crawl', 'beautifulsoup', 'selenium'],
    'data_processing': ['data', 'csv', 'json', 'analysis', 'processing', 'pandas'],
    'web_development': ['website', 'webpage', 'frontend', 'backend', 'api'],
    'ui_components': ['component', 'button', 'form', 'modal', 'ui', 'interface'],
    'automation': ['automation', 'automate', 'script', 'task', 'workflow'],
  };
  
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return domain;
    }
  }
  
  return null;
}

function detectTargetFromPrompt(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('scraper')) return 'web_scraper';
  if (lowerPrompt.includes('component')) return 'ui_component';
  if (lowerPrompt.includes('script')) return 'script';
  if (lowerPrompt.includes('function')) return 'function';
  if (lowerPrompt.includes('class')) return 'class';
  if (lowerPrompt.includes('module')) return 'module';
  if (lowerPrompt.includes('service')) return 'service';
  if (lowerPrompt.includes('utility')) return 'utility';
  
  return 'code';
}

function detectFileOperationTarget(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('folder') || lowerPrompt.includes('directory')) return 'folder';
  if (lowerPrompt.includes('file')) return 'file';
  if (lowerPrompt.includes('script')) return 'script_file';
  if (lowerPrompt.includes('component')) return 'component_file';
  
  return 'item';
} 