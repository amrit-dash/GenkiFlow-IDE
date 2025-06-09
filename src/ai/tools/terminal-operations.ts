/**
 * @fileOverview Defines a Genkit tool for terminal operations.
 *
 * - terminalOperations: A tool that executes only available terminal commands with user confirmation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Available commands in our terminal implementation
const AVAILABLE_COMMANDS = [
  'echo',    // Prints text
  'clear',   // Clears terminal
  'help',    // Shows available commands
  'date',    // Shows current date/time
  'ls',      // Lists files/folders
  'cd',      // Changes directory
  'pwd',     // Shows current working directory
  'mkdir',   // Creates directories
  'touch',   // Creates files
  'rm',      // Deletes files/folders
  'cat',     // Displays file content
] as const;

// Define the input schema for the tool
const TerminalOperationsInputSchema = z.object({
  command: z.string().describe(`The terminal command to execute. Available commands: ${AVAILABLE_COMMANDS.join(', ')}`),
  context: z.string().describe('The context or reason for executing this command'),
  requiresConfirmation: z.boolean().default(true).describe('Whether this command requires user confirmation'),
  isBackground: z.boolean().default(false).describe('Whether this command should run in the background'),
});

// Define the output schema for the tool
const TerminalOperationsOutputSchema = z.object({
  status: z.enum(['pending', 'executed', 'failed', 'cancelled', 'unsupported']),
  output: z.string().optional().describe('The output of the command if executed'),
  error: z.string().optional().describe('Any error message if the command failed'),
  command: z.string().describe('The command that was/will be executed'),
  context: z.string().describe('The context for the command execution'),
  availableCommands: z.array(z.string()).optional().describe('List of available commands if command is unsupported'),
});

export const terminalOperations = ai.defineTool(
  {
    name: 'terminalOperations',
    description: `Executes terminal commands with user confirmation. Only supports these commands: ${AVAILABLE_COMMANDS.join(', ')}. Does NOT support code execution (node, python, compile) or external tools (git, npm).`,
    inputSchema: TerminalOperationsInputSchema,
    outputSchema: TerminalOperationsOutputSchema,
  },
  async (input) => {
    console.log(`Terminal operations tool called with command: ${input.command}`);
    
    // Extract the base command (first word)
    const baseCommand = input.command.trim().split(' ')[0].toLowerCase();
    
    // Check if the command is supported
    if (!AVAILABLE_COMMANDS.includes(baseCommand as any)) {
      return {
        status: 'unsupported' as const,
        command: input.command,
        context: input.context,
        error: `Command '${baseCommand}' is not supported. This terminal does not support code execution or external tools.`,
        availableCommands: [...AVAILABLE_COMMANDS],
      };
    }
    
    // Command is supported, return pending status for user confirmation
    return {
      status: 'pending' as const,
      command: input.command,
      context: input.context,
    };
  }
); 