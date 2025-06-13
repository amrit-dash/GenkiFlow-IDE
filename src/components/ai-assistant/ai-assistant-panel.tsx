
"use client";

import React from 'react';
import { useIde } from '@/contexts/ide-context';
import { TooltipProvider } from "@/components/ui/tooltip";

import { ChatMessageItem } from './chat-message-item'; // Will be used by ChatHistoryDisplay
import { ChatInputArea } from './components/ChatInputArea';
import { ConfirmationDialogComponent } from './components/ConfirmationDialogComponent';
import { AiAssistantHeader } from './components/AiAssistantHeader';
import { ChatHistoryDisplay } from './components/ChatHistoryDisplay';

import { useChatManager } from './hooks/useChatManager';
import { useAttachmentManager } from './hooks/useAttachmentManager';
import { useOperationHandler } from './hooks/useOperationHandler';
import { useAIInteraction } from './hooks/useAIInteraction';
import type { FileSystemNode } from '@/lib/types';


interface AiAssistantPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function AiAssistantPanel({ isVisible, onToggleVisibility }: AiAssistantPanelProps) {
  const ideContext = useIde();

  const {
    prompt,
    setPrompt,
    chatHistory,
    setChatHistory,
    isLoading, // This isLoading state will be managed by useAIInteraction
    setIsLoading, // Setter for isLoading
    scrollAreaRef,
    textareaRef,
    copiedStates,
    setCopiedStates,
    actionAppliedStates,
    setActionAppliedStates,
    loadingStates,
    setLoadingStates,
    expandedCodePreviews,
    // setExpandedCodePreviews, // Managed by toggleCodePreview
    toggleCodePreview,
    forceReplaceState,
    setForceReplaceState,
    handleNewChat,
  } = useChatManager();

  const {
    attachedFiles,
    setAttachedFiles,
    fileSelectorOpen,
    setFileSelectorOpen,
    allFilesForSelector,
    handleFileSelect,
    handleRemoveAttachedFile,
  } = useAttachmentManager(ideContext);

  const {
    undoStack,
    setUndoStack,
    confirmationDialog,
    // setConfirmationDialog, // Managed by show/close
    performFileOperation,
    executeUndo,
    showConfirmationDialog,
    closeConfirmationDialog,
    handleApplyCodeToEditor,
    handleCreateFileFromSuggestion,
    handleExecuteFileOperationSuggestion,
  } = useOperationHandler({
    ideContext,
    setChatHistory,
    setAttachedFiles,
    setCopiedStates,
    setLoadingStates,
    setActionAppliedStates,
    setForceReplaceState,
  });

  const aiInteraction = useAIInteraction({
    prompt,
    setPrompt,
    attachedFiles,
    setAttachedFiles,
    chatHistory,
    setChatHistory,
    setIsLoading, // Pass the setIsLoading from useChatManager
    ideContext,
    performFileOperation,
    showConfirmationDialog,
    setLoadingStates,
    setActionAppliedStates,
    addToUndoStack: (op) => setUndoStack(prev => [op, ...prev].slice(0, 10)),
    setForceReplaceState,
    // ensure findNodeByPath and generateFolderContext are available or passed if needed by AI Interaction for specific flows
    // For now, assuming they are used by handlers within useOperationHandler or directly via ideContext
  });

  const handleCopyCode = (codeToCopy: string, key: string) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
    }).catch(err => {
      console.error("Clipboard copy failed", err);
      ideContext.toast({ variant: "destructive", title: "Copy Failed" });
    });
  };


  if (!isVisible) return null;

  return (
    <TooltipProvider>
      <div className="w-full border-l border-border bg-sidebar flex flex-col h-full">
        <AiAssistantHeader onNewChat={handleNewChat} />

        <ChatHistoryDisplay
          chatHistory={chatHistory}
          isLoading={isLoading}
          scrollAreaRef={scrollAreaRef}
          // Empty state props
          setPromptForEmptyState={setPrompt}
          textareaRefForEmptyState={textareaRef}
          attachedFilesForEmptyState={attachedFiles}
          // ChatMessageItem props spread starts here
          // Props from ideContext
          activeFilePath={ideContext.activeFilePath}
          currentCode={ideContext.activeFilePath ? ideContext.openedFiles.get(ideContext.activeFilePath)?.content : undefined}
          openedFiles={ideContext.openedFiles}
          fileSystem={ideContext.fileSystem as FileSystemNode[]} // Cast if necessary, ensure type alignment
          getFileSystemNode={ideContext.getFileSystemNode}
          // Props from useChatManager
          copiedStates={copiedStates}
          actionAppliedStates={actionAppliedStates}
          loadingStates={loadingStates}
          expandedCodePreviews={expandedCodePreviews}
          toggleCodePreview={toggleCodePreview}
          forceReplaceState={forceReplaceState}
          setForceReplaceState={setForceReplaceState}
          setChatHistory={setChatHistory} // For Undo operations within ChatMessageItem
          // Props from useOperationHandler
          handleApplyToEditor={handleApplyCodeToEditor}
          handleCreateFileAndInsert={handleCreateFileFromSuggestion}
          handleFileOperationSuggestionAction={handleExecuteFileOperationSuggestion}
          undoStack={undoStack}
          executeUndo={executeUndo}
          setUndoStack={setUndoStack} // For ChatMessageItem to update stack after local undo
          handleFileOperation={performFileOperation} // For direct file ops from ChatMessageItem
          // Other direct handlers
          handleCopyCode={handleCopyCode}
        />

        <ChatInputArea
          prompt={prompt}
          setPrompt={setPrompt}
          isLoading={isLoading}
          handleSendMessage={aiInteraction.handleSendMessage}
          textareaRef={textareaRef}
          attachedFiles={attachedFiles}
          fileSelectorOpen={fileSelectorOpen}
          setFileSelectorOpen={setFileSelectorOpen}
          allFilesForSelector={allFilesForSelector}
          handleFileSelect={handleFileSelect}
          handleRemoveAttachedFile={handleRemoveAttachedFile}
        />

        {confirmationDialog.isOpen && (
          <ConfirmationDialogComponent
            isOpen={confirmationDialog.isOpen}
            title={confirmationDialog.title}
            message={confirmationDialog.message}
            onConfirm={() => {
              confirmationDialog.operation();
              closeConfirmationDialog();
            }}
            onCancel={closeConfirmationDialog}
            isDangerous={confirmationDialog.isDangerous}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
