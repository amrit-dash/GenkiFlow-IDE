/**
 * @fileOverview Enhanced progress tracking and operation explanations.
 *
 * - operationProgress: A tool that provides detailed progress updates and explanations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OperationProgressInputSchema = z.object({
  operation: z.string().describe('The operation being performed'),
  stage: z.enum(['starting', 'analyzing', 'processing', 'validating', 'completing', 'error']).describe('Current stage of the operation'),
  progress: z.number().min(0).max(100).describe('Progress percentage (0-100)'),
  details: z.string().optional().describe('Additional details about the current stage'),
  estimatedTimeRemaining: z.number().optional().describe('Estimated time remaining in seconds'),
  context: z.object({
    totalSteps: z.number().optional(),
    currentStep: z.number().optional(),
    filePath: z.string().optional(),
    operationType: z.enum(['code-generation', 'error-validation', 'usage-analysis', 'file-operation', 'refactoring']).optional(),
  }).optional().describe('Additional context about the operation'),
});

const OperationProgressOutputSchema = z.object({
  explanation: z.string().describe('Human-friendly explanation of what is happening'),
  technicalDetails: z.string().optional().describe('Technical details for advanced users'),
  nextSteps: z.array(z.string()).optional().describe('What will happen next'),
  userFeedback: z.object({
    canCancel: z.boolean().describe('Whether the user can cancel this operation'),
    requiresInput: z.boolean().describe('Whether user input is required'),
    suggestedActions: z.array(z.string()).optional().describe('Actions the user might want to take'),
  }),
  progressVisual: z.object({
    barPercentage: z.number().min(0).max(100),
    statusMessage: z.string(),
    icon: z.enum(['loading', 'success', 'error', 'warning', 'info']).describe('Icon to display'),
    estimatedCompletion: z.string().optional().describe('Human-readable time estimate'),
  }),
});

export const operationProgress = ai.defineTool(
  {
    name: 'operationProgress',
    description: 'Provides detailed, user-friendly progress updates and explanations for long-running operations, following best practices for tool transparency.',
    inputSchema: OperationProgressInputSchema,
    outputSchema: OperationProgressOutputSchema,
  },
  async (input) => {
    const { operation, stage, progress, details, context } = input;
    
    const explanation = generateExplanation(operation, stage, context);
    const technicalDetails = generateTechnicalDetails(operation, stage, details);
    const nextSteps = generateNextSteps(operation, stage, context);
    const userFeedback = generateUserFeedback(stage, context);
    const progressVisual = generateProgressVisual(progress, stage, input.estimatedTimeRemaining);
    
    return {
      explanation,
      technicalDetails,
      nextSteps,
      userFeedback,
      progressVisual,
    };
  }
);

type OperationStage = 'starting' | 'analyzing' | 'processing' | 'validating' | 'completing' | 'error';

function generateExplanation(operation: string, stage: OperationStage, context?: any): string {
  const stageExplanations: Record<OperationStage, string> = {
    starting: `I'm beginning to ${operation.toLowerCase()}. Let me analyze the current context and prepare the necessary tools.`,
    analyzing: `I'm examining your code and project structure to understand the best approach for ${operation.toLowerCase()}.`,
    processing: `I'm now working on ${operation.toLowerCase()}. This involves generating optimized code based on your project's patterns and requirements.`,
    validating: `I'm validating the results to ensure everything works correctly and follows best practices.`,
    completing: `Almost done! I'm finalizing the ${operation.toLowerCase()} and preparing the results for you.`,
    error: `I encountered an issue while ${operation.toLowerCase()}. Let me analyze what went wrong and suggest solutions.`,
  };
  
  const baseExplanation = stageExplanations[stage] || `I'm working on ${operation.toLowerCase()}.`;
  
  // Add context-specific details
  if (context?.filePath) {
    return `${baseExplanation} I'm focusing on ${context.filePath} and related files.`;
  }
  
  if (context?.totalSteps && context?.currentStep) {
    return `${baseExplanation} This is step ${context.currentStep} of ${context.totalSteps}.`;
  }
  
  return baseExplanation;
}

function generateTechnicalDetails(operation: string, stage: OperationStage, details?: string): string | undefined {
  if (!details) return undefined;
  
  const techPrefixes: Record<OperationStage, string> = {
    starting: 'Initializing:',
    analyzing: 'Analysis phase:',
    processing: 'Execution phase:',
    validating: 'Validation phase:',
    completing: 'Finalization:',
    error: 'Error details:',
  };
  
  return `${techPrefixes[stage]} ${details}`;
}

function generateNextSteps(operation: string, stage: OperationStage, context?: any): string[] | undefined {
  const nextStepsMap: Record<OperationStage, string[]> = {
    starting: [
      'Analyze current file and project structure',
      'Identify the best approach for the task',
      'Prepare necessary tools and context',
    ],
    analyzing: [
      'Process the gathered information',
      'Generate appropriate code or suggestions',
      'Apply best practices and patterns',
    ],
    processing: [
      'Validate the generated results',
      'Check for potential issues',
      'Optimize for your project structure',
    ],
    validating: [
      'Present results with options',
      'Provide alternative approaches if needed',
      'Allow you to review and apply changes',
    ],
    completing: [
      'Results are ready for your review',
      'You can apply, modify, or request alternatives',
    ],
    error: [
      'Analyze the error cause',
      'Suggest potential fixes',
      'Retry with adjusted approach if possible',
    ],
  };
  
  return nextStepsMap[stage];
}

function generateUserFeedback(stage: OperationStage, context?: any) {
  const canCancel = stage !== 'completing' && stage !== 'error';
  const requiresInput = stage === 'error';
  
  const suggestedActions = [];
  
  if (stage === 'error') {
    suggestedActions.push('Review the error details', 'Try a different approach', 'Provide more specific requirements');
  } else if (stage === 'completing') {
    suggestedActions.push('Review the results', 'Apply the changes', 'Request modifications');
  } else if (canCancel) {
    suggestedActions.push('Wait for completion', 'Cancel if needed');
  }
  
  return {
    canCancel,
    requiresInput,
    suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
  };
}

function generateProgressVisual(progress: number, stage: OperationStage, estimatedTimeRemaining?: number) {
  const stageIcons: Record<OperationStage, 'loading' | 'success' | 'error' | 'warning' | 'info'> = {
    starting: 'loading',
    analyzing: 'loading',
    processing: 'loading',
    validating: 'loading',
    completing: 'success',
    error: 'error',
  };
  
  const stageMessages: Record<OperationStage, string> = {
    starting: 'Getting started...',
    analyzing: 'Analyzing code...',
    processing: 'Generating results...',
    validating: 'Validating output...',
    completing: 'Complete!',
    error: 'Error occurred',
  };
  
  let estimatedCompletion;
  if (estimatedTimeRemaining && estimatedTimeRemaining > 0) {
    if (estimatedTimeRemaining < 60) {
      estimatedCompletion = `~${Math.round(estimatedTimeRemaining)}s remaining`;
    } else {
      estimatedCompletion = `~${Math.round(estimatedTimeRemaining / 60)}m remaining`;
    }
  }
  
  return {
    barPercentage: Math.max(0, Math.min(100, progress)),
    statusMessage: stageMessages[stage] || 'Working...',
    icon: stageIcons[stage] || 'loading',
    estimatedCompletion,
  };
}

// Utility function to create progress updates for use in flows
export function createProgressUpdate(
  operation: string,
  stage: OperationStage,
  progress: number,
  details?: string,
  context?: any
) {
  return {
    operation,
    stage,
    progress,
    details,
    context,
  };
} 