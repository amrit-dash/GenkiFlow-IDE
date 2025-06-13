
"use client";

import { useCallback } from 'react';
import type { IdeState } from '@/contexts/ide-context';
import type { ChatMessage, AttachedFileUIData, UndoOperation, UseAIInteractionProps } from '../types';
import { 
  enhancedGenerateCodeServer,
} from '@/app/(ide)/actions';
import { generateId, generateFolderContext } from '../ai-assistant-utils';
import type { FileSystemNode } from '@/lib/types';


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
      
      const generateMinimalTree = (nodes: FileSystemNode[], prefix = "", depth = 0, maxDepth = 2): string => {
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
      const currentFileNode = activeFilePath ? getFileSystemNode(activeFilePath) : null;
      const currentFileContent = activeFilePath ? openedFiles.get(activeFilePath)?.content : undefined;
      const currentFileName = (currentFileNode && typeof currentFileNode === 'object' && !Array.isArray(currentFileNode)) ? currentFileNode.name : undefined;

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
        prompt: prompt.trim(),
        currentFilePath: activeFilePath || undefined,
        currentFileContent: currentFileContent,
        currentFileName: currentFileName,
        attachedFiles: attachedFilesData,
        fileSystemTree: fileSystemTree,
        chatHistory: chatHistory.slice(-5).map(m => ({ role: m.role, content: m.content })),
        projectContext: projectContextForAI,
      };

      const enhancedResult = await enhancedGenerateCodeServer(enhancedGenInput);
      
      response = {
        id: assistantMessageId,
        role: 'assistant',
        type: 'enhancedCodeGeneration',
        content: enhancedResult.explanation,
        code: enhancedResult.code,
        isNewFile: enhancedResult.isNewFile,
        suggestedFileName: enhancedResult.suggestedFileName || undefined,
        targetPath: enhancedResult.targetPath || undefined,
        explanation: enhancedResult.explanation,
        fileOperationSuggestion: enhancedResult.fileOperationSuggestion,
        alternativeOptions: enhancedResult.alternativeOptions,
        codeQuality: enhancedResult.codeQuality,
      };
      
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
      setAttachedFiles([]);
    }
  }, [
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
    activeFilePath,
    openedFiles,
    fileSystem,
    toast,
    getFileSystemNode
  ]);

  return { handleSendMessage };
}
