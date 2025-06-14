
"use client";

import { useCallback } from 'react';
import type { IdeState } from '@/contexts/ide-context';
import type { ChatMessage, AttachedFileUIData, UndoOperation, UseAIInteractionProps, FilenameSuggestionData as ChatFilenameSuggestionData } from '../types';
import {
  enhancedGenerateCodeServer,
  summarizeCodeSnippetServer,
  generateCodeServer,
  refactorCodeServer,
  findExamplesServer,
  executeFileSystemOperationServer, // For suggesting operations
  executeFileSystemCommandServer, // For direct execution if needed by AI
  executeActualTerminalCommandServer,
  suggestFilenameServer,
  smartFolderOperationsServer,
  // Other server actions as needed...
} from '@/app/(ide)/actions';
import { generateId, generateFolderContext } from '../ai-assistant-utils';
import type { FileSystemNode } from '@/lib/types';

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
    currentFileNameForFiltering?: string;
  };
}

export function useAIInteraction({
  prompt,
  setPrompt,
  attachedFiles,
  setAttachedFiles, // Keep this to allow clearing attachments if needed by other UI actions
  chatHistory,
  setChatHistory,
  setIsLoading,
  ideContext,
  performFileOperation, // This is for client-side execution after confirmation
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
    toast,
    analyzeFileSystemStructure,
  } = ideContext;

  const prepareContextualData = useCallback(() => {
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
    const fsTreeSummary = generateMinimalTree(fileSystem);
    const activeNode = activeFilePath ? getFileSystemNode(activeFilePath) : null;
    const currentFileContentForContext = activeFilePath ? (openedFiles.get(activeFilePath)?.content || (activeNode && !Array.isArray(activeNode) && activeNode.type === 'file' ? activeNode.content : undefined)) : undefined;
    const currentFileNameForContext = activeFilePath ? (activeNode && !Array.isArray(activeNode) ? activeNode.name : activeFilePath.split('/').pop()) : undefined;

    const attachedFilesDataForAI = attachedFiles.map(f => ({
      path: f.path,
      content: f.type === 'file' ? f.content : generateFolderContext(f as FileSystemNode) // generateFolderContext creates a summary string
    }));

    const projectAnalysis = analyzeFileSystemStructure(fileSystem);
    const projectContextForAI = projectAnalysis ? {
      hasPackageJson: projectAnalysis.hasPackageJson,
      hasReadme: projectAnalysis.hasReadme,
      hasSrcFolder: projectAnalysis.hasSrcFolder,
      hasTestFolder: projectAnalysis.hasTestFolder,
      totalFiles: projectAnalysis.totalFiles,
      totalFolders: projectAnalysis.totalFolders,
    } : undefined;

    return {
      fsTreeSummary,
      currentFileContentForContext,
      currentFileNameForContext,
      attachedFilesDataForAI,
      projectContextForAI,
    };
  }, [fileSystem, activeFilePath, openedFiles, attachedFiles, getFileSystemNode, analyzeFileSystemStructure]);


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
    const currentPrompt = prompt.trim();
    setPrompt('');
    // Do NOT clear attachedFiles here. They should persist.

    const assistantMessageId = generateId();
    const loadingMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      type: 'loading',
      content: 'Thinking...',
    };
    setChatHistory(prev => [...prev, loadingMessage]);

    let responseMessage: ChatMessage | null = null;

    try {
      const {
        fsTreeSummary,
        currentFileContentForContext,
        currentFileNameForContext,
        attachedFilesDataForAI,
        projectContextForAI
      } = prepareContextualData();

      // Simple Intent Classification
      const lowerPrompt = currentPrompt.toLowerCase();
      let intentHandled = false;

      // 1. Filename Suggestion Intent
      if (lowerPrompt.includes("suggest name") || lowerPrompt.includes("what should i call this") || lowerPrompt.includes("new name for")) {
        let targetContent = "";
        let targetCurrentName: string | undefined;
        let targetItemType: 'file' | 'folder' = 'file';
        let targetItemPath: string | undefined;

        if (attachedFilesDataForAI.length > 0) {
            targetContent = attachedFilesDataForAI[0].content; // Use content/summary of the first attachment
            targetCurrentName = attachedFiles[0].name;
            targetItemType = attachedFiles[0].type;
            targetItemPath = attachedFiles[0].path;
        } else if (activeFilePath && currentFileContentForContext) {
            targetContent = currentFileContentForContext;
            targetCurrentName = currentFileNameForContext;
            const activeNode = getFileSystemNode(activeFilePath);
            targetItemType = (activeNode && !Array.isArray(activeNode)) ? activeNode.type : 'file';
            targetItemPath = activeFilePath;
        }

        if (targetContent) {
            const result = await suggestFilenameServer({
                fileContent: targetContent,
                currentFileName: targetCurrentName,
                fileType: targetItemType,
                context: currentPrompt,
                projectStructure: fsTreeSummary
            });
            responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'filenameSuggestion',
                content: result.suggestions.length > 0 ? `Here are some name suggestions for "${targetCurrentName || 'the item'}":` : `I couldn't come up with specific name suggestions for "${targetCurrentName || 'the item'}".`,
                filenameSuggestionData: {
                  suggestions: result.suggestions,
                  analysis: result.analysis as ChatFilenameSuggestionData['analysis'],
                  topSuggestion: result.topSuggestion,
                  currentFileName: targetCurrentName,
                  targetPath: targetItemPath,
                  itemType: targetItemType,
                }
            };
            intentHandled = true;
        }
      }
      // 2. File System Operation Intents (more robustly handled by enhancedGenerateCode's tools for now)
      // For direct "rename X to Y", "delete X", "move X to Y", "create file/folder X"
      // These are complex to parse reliably on client-side. The `enhancedGenerateCode` flow is better equipped
      // with its tools (`fileSystemOperations`, `smartFolderOperations`, `filenameSuggester`) to understand these.
      // It will then return a `fileOperationSuggestion` or `filenameSuggestionData`.

      // 3. Terminal Command Intent
      else if (lowerPrompt.startsWith("run ") || lowerPrompt.startsWith("execute `") || lowerPrompt.startsWith("terminal:")) {
          const commandToRun = lowerPrompt.replace(/^(run|execute `|terminal:)\s*/, '').replace(/`$/, '');
          const result = await executeActualTerminalCommandServer({ command: commandToRun, context: "User requested terminal command" });
          responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'terminalCommandExecution',
              content: `Terminal command status for: \`${result.command}\``,
              terminalCommandData: result
          };
          intentHandled = true;
      }

      // 4. Refactor Intent
      else if (lowerPrompt.includes("refactor") && (currentFileContentForContext || attachedFilesDataForAI.length > 0)) {
          const codeToRefactor = attachedFilesDataForAI.length > 0 ? attachedFilesDataForAI[0].content : currentFileContentForContext!;
          const pathForRefactor = attachedFilesDataForAI.length > 0 ? attachedFilesDataForAI[0].path : activeFilePath!;
          const fileNameForRefactor = pathForRefactor.split('/').pop() || "selected code";

          const result = await refactorCodeServer({ codeSnippet: codeToRefactor, fileContext: `File: ${fileNameForRefactor}` });
          responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'refactorSuggestion',
              content: result.suggestion ? "Here's a refactoring suggestion:" : "No specific refactoring suggestions found.",
              suggestion: result.suggestion,
              targetPath: pathForRefactor,
          };
          intentHandled = true;
      }

      // 5. Summarize Intent
      else if (lowerPrompt.startsWith("summarize") && (currentFileContentForContext || attachedFilesDataForAI.length > 0)) {
          const contentToSummarize = attachedFilesDataForAI.length > 0 ? attachedFilesDataForAI[0].content : currentFileContentForContext!;
          const result = await summarizeCodeSnippetServer({ codeSnippet: contentToSummarize });
          responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'text',
              content: result.summary || "Could not summarize the content."
          };
          intentHandled = true;
      }
      
      // 6. Find Examples Intent
      else if (lowerPrompt.includes("find example") || lowerPrompt.includes("show me how to use")) {
        const queryForExamples = currentPrompt.replace(/(find example(s)? of|show me how to use)\s*/i, "").trim();
        if (queryForExamples) {
            const result = await findExamplesServer({ query: queryForExamples });
            responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'codeExamples',
                content: `Here are some examples for "${queryForExamples}":`,
                examples: result.examples
            };
            intentHandled = true;
        }
      }


      // Default: Fallback to enhancedGenerateCode for complex generation, modifications, or general queries
      if (!intentHandled) {
        const enhancedGenInput = {
          prompt: currentPrompt,
          currentFilePath: activeFilePath || undefined,
          currentFileContent: currentFileContentForContext,
          currentFileName: currentFileNameForContext,
          attachedFiles: attachedFilesDataForAI,
          fileSystemTree: fsTreeSummary,
          chatHistory: chatHistory.slice(-5).map(m => ({ role: m.role, content: m.content })),
          projectContext: projectContextForAI,
        };
        const enhancedResult = await enhancedGenerateCodeServer(enhancedGenInput);

        if (enhancedResult.filenameSuggestionData) {
            const toolOutput = enhancedResult.filenameSuggestionData as FilenameSuggesterToolOutput;
            const targetPathForResult = enhancedResult.targetPath;
            const targetNode = targetPathForResult ? getFileSystemNode(targetPathForResult) : null;
            const itemTypeForResult = (targetNode && !Array.isArray(targetNode)) ? targetNode.type : (enhancedResult.fileOperationSuggestion?.fileType || 'file');
            const currentNameForSuggestion = toolOutput.analysis?.currentFileNameForFiltering || (targetNode && !Array.isArray(targetNode) ? targetNode.name : targetPathForResult?.split('/').pop());

            responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'filenameSuggestion',
              content: enhancedResult.explanation || `Okay, I've analyzed "${currentNameForSuggestion || 'the item'}" and here are some name suggestions:`,
              filenameSuggestionData: {
                suggestions: toolOutput.suggestions,
                analysis: toolOutput.analysis as ChatFilenameSuggestionData['analysis'],
                topSuggestion: toolOutput.suggestions.length > 0 ? toolOutput.suggestions[0] : null,
                currentFileName: currentNameForSuggestion,
                targetPath: targetPathForResult,
                itemType: itemTypeForResult,
              },
              targetPath: targetPathForResult,
              explanation: enhancedResult.explanation,
            };
        } else if (enhancedResult.fileOperationSuggestion && enhancedResult.fileOperationSuggestion.type !== 'none') {
             // Check if smartFolderOperations was used (conceptually, enhancedGenerateCode might return this structure)
            const sfData = enhancedResult as any; // Assuming enhancedResult might conform to SmartFolderOperationOutput like structure
            if (sfData.suggestions && sfData.reasoning && sfData.operation) { // Heuristic for smartFolderOp like response
                 responseMessage = {
                    id: assistantMessageId, role: 'assistant', type: 'smartFolderOperation',
                    content: enhancedResult.explanation || `Regarding folder operation for "${sfData.targetPath || 'item'}"`,
                    smartFolderOperationData: {
                        operation: sfData.operation,
                        targetPath: sfData.targetPath,
                        canExecuteDirectly: sfData.canExecuteDirectly || false,
                        suggestions: sfData.suggestions,
                        topSuggestion: sfData.topSuggestion,
                        needsUserConfirmation: sfData.needsUserConfirmation || true,
                        confirmationPrompt: sfData.confirmationPrompt,
                        suggestedNewName: sfData.suggestedNewName,
                        folderAnalysis: sfData.folderAnalysis,
                        reasoning: sfData.reasoning,
                        confidence: sfData.confidence || 0.7,
                    },
                    explanation: enhancedResult.explanation,
                 };
            } else { // General file operation suggestion
                responseMessage = {
                  id: assistantMessageId, role: 'assistant', type: 'enhancedCodeGeneration', // Or a more specific type if only FOS
                  content: enhancedResult.explanation || "I have a file operation suggestion:",
                  code: enhancedResult.code, // Usually null/empty for pure FOS
                  isNewFile: enhancedResult.isNewFile || false,
                  suggestedFileName: enhancedResult.suggestedFileName,
                  targetPath: enhancedResult.targetPath,
                  explanation: enhancedResult.explanation,
                  fileOperationSuggestion: enhancedResult.fileOperationSuggestion,
                  alternativeOptions: enhancedResult.alternativeOptions,
                  codeQuality: enhancedResult.codeQuality,
                };
            }
        } else {
          responseMessage = {
            id: assistantMessageId, role: 'assistant', type: 'enhancedCodeGeneration',
            content: enhancedResult.explanation || "Here's what I came up with:",
            code: enhancedResult.code,
            isNewFile: enhancedResult.isNewFile || false,
            suggestedFileName: enhancedResult.suggestedFileName,
            targetPath: enhancedResult.targetPath,
            explanation: enhancedResult.explanation,
            fileOperationSuggestion: enhancedResult.fileOperationSuggestion,
            alternativeOptions: enhancedResult.alternativeOptions,
            codeQuality: enhancedResult.codeQuality,
          };
        }
      }

      if (responseMessage) {
        setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? responseMessage! : msg));
      } else {
        setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? {
          id: assistantMessageId, role: 'assistant', type: 'error', content: "Sorry, I couldn't process that request with a specific handler."
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
      // DO NOT clear attachments here: setAttachedFiles([]);
    }
  }, [
    prompt,
    setPrompt,
    attachedFiles,
    // setAttachedFiles, // Not clearing anymore
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
    getFileSystemNode,
    toast,
    prepareContextualData,
    analyzeFileSystemStructure
  ]);

  return { handleSendMessage };
}
