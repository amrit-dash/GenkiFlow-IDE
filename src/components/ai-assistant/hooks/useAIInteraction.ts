
"use client";

import { useCallback } from 'react';
import type { IdeState } from '@/contexts/ide-context';
import type { ChatMessage, AttachedFileUIData, UndoOperation, UseAIInteractionProps, FilenameSuggestionData as ChatFilenameSuggestionData } from '../types';
import {
  enhancedGenerateCodeServer,
} from '@/app/(ide)/actions';
import { generateId, generateFolderContext } from '../ai-assistant-utils';
import type { FileSystemNode } from '@/lib/types';
// Import the output type of the filenameSuggester tool if it's defined in its own file, or use a compatible local type.
// For this example, let's assume the structure from the tool's output matches what FilenameSuggestionData needs,
// or we'll adapt it. Let's refine this.
// The filenameSuggester tool (in src/ai/tools/filename-suggester.ts) outputs a specific schema.
// We need to map that tool's output to the ChatFilenameSuggestionData type.

// Assuming FilenameSuggesterToolOutput type matching src/ai/tools/filename-suggester.ts outputSchema
interface FilenameSuggesterToolOutput {
  suggestions: Array<{
    filename: string;
    reasoning: string;
    confidence: number;
    category: 'descriptive' | 'conventional' | 'functional' | 'contextual';
  }>;
  analysis: {
    detectedLanguage: string;
    codeType: string;
    mainFunctions: string[];
    hasExports: boolean;
    isComponent: boolean;
    suggestedExtension: string;
    currentFileNameForFiltering?: string; // This comes from the tool's analysis
  };
}


export function useAIInteraction({
  prompt,
  setPrompt,
  attachedFiles,
  setAttachedFiles,
  chatHistory,
  setChatHistory,
  setIsLoading,
  ideContext,
  performFileOperation,
  showConfirmationDialog,
  setLoadingStates,
  setActionAppliedStates,
  addToUndoStack,
  setForceReplaceState,
}: UseAIInteractionProps) {
  const {
    activeFilePath,
    openedFiles,
    getFileSystemNode,
    fileSystem,
    toast
  } = ideContext;

  const handleSendMessage = useCallback(async () => {
    if (!prompt.trim() && attachedFiles.length === 0) return;

    const userMessageId = generateId();
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      type: 'text',
      content: prompt.trim(),
    };

    setChatHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    const currentPrompt = prompt.trim(); // Capture prompt before clearing
    setPrompt('');

    const assistantMessageId = generateId();
    const loadingMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      type: 'loading',
      content: 'Thinking...',
    };
    setChatHistory(prev => [...prev, loadingMessage]);

    try {
      let response: ChatMessage | null = null;

      const generateMinimalTree = (nodes: FileSystemNode[], prefix = "", depth = 0, maxDepth = 3): string => {
        if (depth > maxDepth) return "";
        let treeString = "";
        nodes.forEach(node => {
          treeString += `${prefix}${node.name}${node.type === 'folder' ? '/' : ''}\n`;
          if (node.type === 'folder' && node.children && node.children.length > 0) {
            treeString += generateMinimalTree(node.children, prefix + "  ", depth + 1, maxDepth);
          }
        });
        return treeString;
      };
      const fileSystemTree = generateMinimalTree(fileSystem);
      const activeFileNode = activeFilePath ? getFileSystemNode(activeFilePath) : null;
      const currentFileContentForContext = activeFilePath ? (openedFiles.get(activeFilePath)?.content || (activeFileNode && !Array.isArray(activeFileNode) && activeFileNode.type === 'file' ? activeFileNode.content : undefined)) : undefined;
      const currentFileNameForContext = activeFilePath ? (activeFileNode && !Array.isArray(activeFileNode) ? activeFileNode.name : activeFilePath.split('/').pop()) : undefined;

      const attachedFilesData = attachedFiles.map(f => ({
        path: f.path,
        content: f.type === 'file' ? f.content : generateFolderContext(f as FileSystemNode)
      }));

      const projectContextAnalysis = ideContext.analyzeFileSystemStructure ? ideContext.analyzeFileSystemStructure(fileSystem) : undefined;
      const projectContextForAI = projectContextAnalysis ? {
        hasPackageJson: projectContextAnalysis.hasPackageJson,
        hasReadme: projectContextAnalysis.hasReadme,
        hasSrcFolder: projectContextAnalysis.hasSrcFolder,
        hasTestFolder: projectContextAnalysis.hasTestFolder,
        totalFiles: projectContextAnalysis.totalFiles,
        totalFolders: projectContextAnalysis.totalFolders,
      } : undefined;

      const enhancedGenInput = {
        prompt: currentPrompt,
        currentFilePath: activeFilePath || undefined,
        currentFileContent: currentFileContentForContext,
        currentFileName: currentFileNameForContext,
        attachedFiles: attachedFilesData,
        fileSystemTree: fileSystemTree,
        chatHistory: chatHistory.slice(-5).map(m => ({ role: m.role, content: m.content })), // Pass recent history
        projectContext: projectContextForAI,
      };

      const enhancedResult = await enhancedGenerateCodeServer(enhancedGenInput);

      // Check if the AI used the filenameSuggester tool via enhancedGenerateCode
      if (enhancedResult.filenameSuggestionData) {
        const toolOutput = enhancedResult.filenameSuggestionData as FilenameSuggesterToolOutput;
        const targetPathForResult = enhancedResult.targetPath; // Relies on enhancedGenerateCode setting this to the item suggested for
        const targetNode = targetPathForResult ? getFileSystemNode(targetPathForResult) : null;
        const itemTypeForResult = (targetNode && !Array.isArray(targetNode)) ? targetNode.type : 'file';
        const currentNameForSuggestion = toolOutput.analysis?.currentFileNameForFiltering || (targetNode && !Array.isArray(targetNode) ? targetNode.name : targetPathForResult?.split('/').pop());

        response = {
          id: assistantMessageId,
          role: 'assistant',
          type: 'filenameSuggestion',
          content: enhancedResult.explanation || `Okay, I've analyzed "${currentNameForSuggestion || 'the item'}" and here are some name suggestions:`,
          filenameSuggestionData: {
            suggestions: toolOutput.suggestions,
            analysis: toolOutput.analysis as ChatFilenameSuggestionData['analysis'], // Cast, ensure fields match
            topSuggestion: toolOutput.suggestions.length > 0 ? toolOutput.suggestions[0] : null,
            currentFileName: currentNameForSuggestion,
            targetPath: targetPathForResult,
            itemType: itemTypeForResult,
          },
          targetPath: targetPathForResult,
          explanation: enhancedResult.explanation,
          code: undefined, isNewFile: false, suggestedFileName: undefined,
          fileOperationSuggestion: undefined, alternativeOptions: undefined, codeQuality: undefined,
        };
      } else { // Handle as a standard enhanced code generation response
        response = {
          id: assistantMessageId,
          role: 'assistant',
          type: 'enhancedCodeGeneration',
          content: enhancedResult.explanation || "Here's what I found:",
          code: enhancedResult.code,
          isNewFile: enhancedResult.isNewFile || false,
          suggestedFileName: enhancedResult.suggestedFileName || undefined,
          targetPath: enhancedResult.targetPath || undefined,
          explanation: enhancedResult.explanation,
          fileOperationSuggestion: enhancedResult.fileOperationSuggestion,
          alternativeOptions: enhancedResult.alternativeOptions,
          codeQuality: enhancedResult.codeQuality,
        };
      }

      if (response) {
        setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? response! : msg));
      } else {
        setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? {
          id: assistantMessageId, role: 'assistant', type: 'error', content: "Sorry, I couldn't process that request."
        } : msg));
      }

    } catch (error: any) {
      console.error("AI Interaction Error:", error);
      const errorMessage = error.message || "An unexpected error occurred.";
      setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? {
        id: assistantMessageId, role: 'assistant', type: 'error', content: `Error: ${errorMessage}`
      } : msg));
      toast({ variant: "destructive", title: "AI Error", description: errorMessage });
    } finally {
      setIsLoading(false);
      setAttachedFiles([]); // Clear attachments after each message
    }
  }, [
    prompt,
    setPrompt,
    attachedFiles,
    setAttachedFiles,
    chatHistory,
    setChatHistory,
    setIsLoading,
    ideContext, // Keep the whole context for simplicity, or destructure specific needs
    performFileOperation,
    showConfirmationDialog,
    setLoadingStates,
    setActionAppliedStates,
    addToUndoStack,
    setForceReplaceState,
    activeFilePath, // Now directly used
    openedFiles,    // Now directly used
    fileSystem,     // Now directly used
    getFileSystemNode, // Now directly used
    toast           // Now directly used
  ]);

  return { handleSendMessage };
}
