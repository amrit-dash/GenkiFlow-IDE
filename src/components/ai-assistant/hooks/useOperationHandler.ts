
"use client";

import { useState, useCallback } from 'react';
import type { IdeState } from '@/contexts/ide-context';
import type { ChatMessage, UndoOperation, ConfirmationDialogData } from '../types';
import { intelligentCodeMergerServer } from '@/app/(ide)/actions';
import { isFullFileReplacement } from '../ai-assistant-utils';

const MAX_UNDO_OPERATIONS = 10;

interface UseOperationHandlerProps {
  ideContext: IdeState;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setAttachedFiles: React.Dispatch<React.SetStateAction<any[]>>; // Replace 'any' with actual AttachedFileUIData if possible
  setCopiedStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setLoadingStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setActionAppliedStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setForceReplaceState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function useOperationHandler({
  ideContext,
  setChatHistory,
  setAttachedFiles,
  // setCopiedStates, // Not directly used by handlers here, but kept if other ops need it
  setLoadingStates,
  setActionAppliedStates,
  setForceReplaceState,
}: UseOperationHandlerProps) {
  const {
    getFileSystemNode,
    deleteNode,
    renameNode,
    moveNode,
    addNode,
    openFile,
    updateFileContent,
    closeFile,
    toast,
    activeFilePath,
    openedFiles,
  } = ideContext;

  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogData>({
    isOpen: false,
    title: '',
    message: '',
    operation: () => {},
    isDangerous: false,
  });

  const addToUndoStack = useCallback((operation: UndoOperation) => {
    setUndoStack(prev => [operation, ...prev].slice(0, MAX_UNDO_OPERATIONS));
  }, []);

  const showConfirmationDialog = useCallback((title: string, message: string, operation: () => void, isDangerous: boolean = false) => {
    setConfirmationDialog({ isOpen: true, title, message, operation, isDangerous });
  }, []);

  const closeConfirmationDialog = useCallback(() => {
    setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const performFileOperation = useCallback(async (operation: 'create' | 'delete' | 'rename' | 'move' | 'list', operationData: any) => {
    try {
      let success = false;
      let message = '';
      let undoOperation: UndoOperation | null = null;

      switch (operation) {
        case 'delete':
          if (operationData.targetPath) {
            const nodeToDelete = getFileSystemNode(operationData.targetPath);
            if (nodeToDelete && !Array.isArray(nodeToDelete)) {
              undoOperation = {
                type: 'delete',
                data: {
                  name: nodeToDelete.name,
                  type: nodeToDelete.type,
                  content: nodeToDelete.type === 'file' ? (openedFiles.get(nodeToDelete.path)?.content || nodeToDelete.content || '') : '',
                  parentPath: nodeToDelete.path.substring(0, nodeToDelete.path.lastIndexOf('/')) || '/',
                  originalPath: nodeToDelete.path
                },
                timestamp: Date.now(),
                description: `Deleted ${nodeToDelete.name}`
              };
              if (openedFiles.has(nodeToDelete.path)) {
                closeFile(nodeToDelete.path);
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              success = deleteNode(nodeToDelete.id);
              message = success ? `Successfully deleted ${nodeToDelete.name}.` : `Failed to delete ${nodeToDelete.name}.`;
              if (success) {
                setAttachedFiles(prev => prev.filter(f => f.path !== nodeToDelete.path));
                if (undoOperation) addToUndoStack(undoOperation);
              }
            } else { message = `Item not found: ${operationData.targetPath}`; }
          } else { message = "Target path is required for delete."; }
          break;
        // ... (rename, move, create, list cases from ai-assistant-panel)
        case 'rename':
          if (operationData.targetPath && operationData.newName) {
            const nodeToRename = getFileSystemNode(operationData.targetPath);
            if (nodeToRename && !Array.isArray(nodeToRename)) {
              const originalName = nodeToRename.name;
              const newPath = nodeToRename.path.replace(originalName, operationData.newName);
              undoOperation = {
                type: 'rename',
                data: { originalName, newName: operationData.newName, originalPath: nodeToRename.path, newPath },
                timestamp: Date.now(),
                description: `Renamed ${originalName} to ${operationData.newName}`
              };
              success = renameNode(nodeToRename.id, operationData.newName);
              message = success ? `Successfully renamed to ${operationData.newName}.` : `Failed to rename.`;
              if (success) addToUndoStack(undoOperation);
            } else { message = `Item not found: ${operationData.targetPath}`; }
          } else { message = 'Target path and new name are required.'; }
          break;
        case 'move':
          if (operationData.targetPath && operationData.destinationPath) {
            const nodeToMove = getFileSystemNode(operationData.targetPath);
            const destinationNode = getFileSystemNode(operationData.destinationPath);
            if (nodeToMove && !Array.isArray(nodeToMove) && destinationNode && !Array.isArray(destinationNode)) {
              if (destinationNode.type !== 'folder') {
                message = `Destination "${destinationNode.name}" is not a folder.`;
              } else {
                const originalParentPath = nodeToMove.path.substring(0, nodeToMove.path.lastIndexOf('/')) || '/';
                const newPath = (destinationNode.path === '/' ? '' : destinationNode.path) + '/' + nodeToMove.name;
                undoOperation = {
                  type: 'move',
                  data: { name: nodeToMove.name, originalPath: nodeToMove.path, newPath, originalParentPath, destinationPath: destinationNode.path },
                  timestamp: Date.now(),
                  description: `Moved ${nodeToMove.name} to ${destinationNode.name}`
                };
                moveNode(nodeToMove.id, destinationNode.id); // Assume this might throw on error
                success = true;
                message = `Successfully moved ${nodeToMove.name} to ${destinationNode.name}.`;
                if(undoOperation) addToUndoStack(undoOperation);
              }
            } else { message = `Source or destination not found.`; }
          } else { message = 'Target and destination paths are required.'; }
          break;
        case 'create':
           if (operationData.fileName && operationData.fileType) {
            const parentPath = operationData.parentPath || '/';
            const parentNode = parentPath === '/' ? null : getFileSystemNode(parentPath);
            const parentId = parentNode && !Array.isArray(parentNode) ? parentNode.id : null;
            const newNode = addNode(parentId, operationData.fileName, operationData.fileType, parentPath);
            if (newNode) {
              if (operationData.content && operationData.fileType === 'file') updateFileContent(newNode.path, operationData.content);
              if (operationData.openInIDE && operationData.fileType === 'file') openFile(newNode.path, newNode);
              success = true;
              message = `Successfully created ${operationData.fileType}: ${operationData.fileName}.`;
               undoOperation = {
                type: 'create',
                data: { name: newNode.name, path: newNode.path, type: newNode.type },
                timestamp: Date.now(),
                description: `Created ${newNode.type} ${newNode.name}`
              };
              if (undoOperation) addToUndoStack(undoOperation);
            } else { message = `Failed to create.`; }
          } else { message = 'File name and type are required.'; }
          break;
        case 'list':
          // This operation doesn't modify fs, just returns info.
          // The actual listing logic is in useAIInteraction or display component.
          success = true;
          message = `Listed items.`; // Or retrieve actual list if needed here
          break;
      }

      toast({ 
        title: success ? "Operation Successful" : "Action Failed", 
        description: message,
        variant: success ? "default" : "destructive"
      });
      return { success, message };
    } catch (error: any) {
      console.error(`Error in ${operation} operation:`, error);
      toast({ 
        title: "Operation Error", 
        description: `Unexpected error during ${operation}. Check console.`,
        variant: "destructive"
      });
      return { success: false, message: `Operation failed: ${error.message || 'unexpected error.'}` };
    }
  }, [getFileSystemNode, deleteNode, renameNode, moveNode, addNode, openFile, updateFileContent, closeFile, openedFiles, toast, setAttachedFiles, addToUndoStack]);

  const executeUndo = useCallback(async (operation: UndoOperation) => {
    // ... (existing executeUndo logic, ensuring it uses performFileOperation or direct ideContext methods)
    try {
      let undoSuccess = false;
      let feedbackMessage = "";

      switch (operation.type) {
        case 'delete': // To undo delete, we create
          const created = await performFileOperation('create', {
            parentPath: operation.data.parentPath,
            fileName: operation.data.name,
            fileType: operation.data.type,
            content: operation.data.content,
            openInIDE: false
          });
          undoSuccess = created?.success || false;
          feedbackMessage = undoSuccess ? `Restored ${operation.data.name}.` : `Failed to restore ${operation.data.name}.`;
          break;
        case 'rename': // To undo rename, we rename back
          const renamedBack = await performFileOperation('rename', {
            targetPath: operation.data.newPath,
            newName: operation.data.originalName,
          });
          undoSuccess = renamedBack?.success || false;
          feedbackMessage = undoSuccess ? `Renamed back to ${operation.data.originalName}.` : `Failed to rename back.`;
          break;
        case 'move': // To undo move, we move back
          const movedBack = await performFileOperation('move', {
            targetPath: operation.data.newPath,
            destinationPath: operation.data.originalParentPath,
          });
          undoSuccess = movedBack?.success || false;
          feedbackMessage = undoSuccess ? `Moved ${operation.data.name} back.` : `Failed to move back.`;
          break;
        case 'create': // To undo create, we delete
          const deleted = await performFileOperation('delete', {
            targetPath: operation.data.path,
          });
          undoSuccess = deleted?.success || false;
          feedbackMessage = undoSuccess ? `Removed created ${operation.data.name}.` : `Failed to remove created ${operation.data.name}.`;
          break;
      }

      setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'assistant', type: 'text', content: `✅ Undo: ${feedbackMessage}` }]);
      toast({ title: "Undo", description: feedbackMessage, variant: undoSuccess ? "default" : "destructive" });

    } catch (error) {
      console.error("Undo operation failed:", error);
      setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'assistant', type: 'error', content: `❌ Undo operation encountered an error.` }]);
      toast({ title: "Undo Failed", variant: "destructive" });
    }
  }, [performFileOperation, setChatHistory, toast]);


  const handleApplyCodeToEditor = useCallback(async (codeToApply: string, buttonKey: string, targetPathProvided?: string, insertionContext?: string, forceReplace = false) => {
    const path = targetPathProvided || activeFilePath;
    if (!path) {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Please open or select a file.' });
      return;
    }

    const targetNode = getFileSystemNode(path);
    if (!targetNode || Array.isArray(targetNode) || targetNode.type !== 'file') {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Target path is not a valid file.' });
      return;
    }

    setLoadingStates(prev => ({ ...prev, [buttonKey]: true }));
    const existingContent = openedFiles.get(path)?.content ?? targetNode.content ?? '';
    const fileName = targetNode.name;
    const fileExtension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';

    try {
      if (forceReplace || isFullFileReplacement(codeToApply)) {
        updateFileContent(path, codeToApply);
        toast({ title: 'Code Applied', description: `Full content replaced in ${fileName}.` });
        setForceReplaceState(prev => ({ ...prev, [buttonKey]: false })); // Reset force if it was used
      } else {
        const mergerResult = await intelligentCodeMergerServer({
          existingContent,
          generatedContent: codeToApply,
          fileName,
          fileExtension,
          userInstruction: insertionContext || 'Generated code insertion',
          insertionContext: insertionContext || 'AI assistant code application',
        });

        if (!mergerResult.mergedContent.includes(codeToApply.trim().slice(0,20))) {
          // Heuristic: If the start of the generated code isn't found, it might be a full replace scenario presented as merge
           setForceReplaceState(prev => ({ ...prev, [buttonKey]: true }));
        } else {
           setForceReplaceState(prev => ({ ...prev, [buttonKey]: false }));
        }
        updateFileContent(path, mergerResult.mergedContent);
        toast({ title: 'Code Merged', description: mergerResult.summary });
      }
      setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
    } catch (error: any) {
      console.error("Error applying/merging code:", error);
      updateFileContent(path, codeToApply); // Fallback to simple replacement
      toast({ title: 'Code Applied (Fallback)', description: `Changes applied to ${fileName}. Merge error.` });
      setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
      setForceReplaceState(prev => ({ ...prev, [buttonKey]: false }));
    }
    setLoadingStates(prev => ({ ...prev, [buttonKey]: false }));
  }, [activeFilePath, getFileSystemNode, openedFiles, updateFileContent, toast, setLoadingStates, setActionAppliedStates, setForceReplaceState]);

  const handleCreateFileFromSuggestion = useCallback(async (suggestedFileName: string, code: string, buttonKey: string) => {
    setLoadingStates(prev => ({ ...prev, [buttonKey]: true }));
    let parentDirNode = activeFilePath ? getFileSystemNode(activeFilePath) : null;
    let parentIdForNewNode: string | null = null;
    let baseDirForNewNode = "/";

    if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'file') {
        const pathParts = parentDirNode.path.split('/');
        pathParts.pop();
        baseDirForNewNode = pathParts.join('/') || '/';
        const actualParentDirNode = getFileSystemNode(baseDirForNewNode);
        parentIdForNewNode = (actualParentDirNode && !Array.isArray(actualParentDirNode) && actualParentDirNode.type === 'folder') ? actualParentDirNode.id : null;
        if (!parentIdForNewNode) baseDirForNewNode = "/";
    } else if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'folder') {
        parentIdForNewNode = parentDirNode.id;
        baseDirForNewNode = parentDirNode.path;
    }

    const newNode = addNode(parentIdForNewNode, suggestedFileName, 'file', baseDirForNewNode);
    if (newNode) {
      openFile(newNode.path, newNode);
      updateFileContent(newNode.path, code);
      toast({ title: "File Created", description: `"${newNode.name}" created.`});
      setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
      addToUndoStack({ type: 'create', data: { name: newNode.name, path: newNode.path, type: newNode.type }, timestamp: Date.now(), description: `Created ${newNode.name}`});
    } else {
      toast({ variant: "destructive", title: "File Creation Failed", description: `Could not create "${suggestedFileName}".`});
    }
    setLoadingStates(prev => ({ ...prev, [buttonKey]: false }));
  }, [activeFilePath, getFileSystemNode, addNode, openFile, updateFileContent, toast, setLoadingStates, setActionAppliedStates, addToUndoStack]);

  const handleExecuteFileOperationSuggestion = useCallback(async (
    operationType: 'create' | 'rename' | 'delete' | 'move',
    targetPath: string | undefined,
    newName: string | undefined,
    fileType: 'file' | 'folder' | undefined,
    buttonKey: string,
    destinationPath?: string
  ) => {
    setLoadingStates(prev => ({...prev, [buttonKey]: true}));
    try {
      let result;
      if (operationType === 'create' && newName && fileType) {
        result = await performFileOperation('create', { parentPath: targetPath || '/', fileName: newName, fileType, openInIDE: true });
      } else if (operationType === 'rename' && targetPath && newName) {
        result = await performFileOperation('rename', { targetPath, newName });
      } else if (operationType === 'delete' && targetPath) {
        const nodeToDelete = getFileSystemNode(targetPath);
        const itemTypeConfirm = nodeToDelete && !Array.isArray(nodeToDelete) && nodeToDelete.type === 'folder' ? 'folder' : 'file';
        const itemNameConfirm = nodeToDelete ? nodeToDelete.name : targetPath.split('/').pop();
        showConfirmationDialog(
          `Delete ${itemTypeConfirm}`,
          `AI suggested deleting "${itemNameConfirm}". This action cannot be undone. Confirm?`,
          async () => {
            const deleteResult = await performFileOperation('delete', { targetPath });
            if (deleteResult?.success) setActionAppliedStates(prev => ({...prev, [buttonKey]: true}));
            setLoadingStates(prev => ({...prev, [buttonKey]: false}));
          },
          true
        );
        return; // Confirmation dialog handles further action
      } else if (operationType === 'move' && targetPath && destinationPath) {
        result = await performFileOperation('move', {targetPath, destinationPath});
      } else {
        throw new Error("Invalid parameters for file operation suggestion.");
      }
      if (result?.success) setActionAppliedStates(prev => ({...prev, [buttonKey]: true}));
    } catch (error: any) {
      toast({ title: "Action Failed", description: "Could not execute suggested file operation.", variant: "destructive" });
    }
    setLoadingStates(prev => ({...prev, [buttonKey]: false}));
  }, [performFileOperation, getFileSystemNode, showConfirmationDialog, toast, setLoadingStates, setActionAppliedStates]);


  return {
    undoStack,
    setUndoStack,
    confirmationDialog,
    setConfirmationDialog,
    performFileOperation,
    executeUndo,
    showConfirmationDialog,
    closeConfirmationDialog,
    handleApplyCodeToEditor,
    handleCreateFileFromSuggestion,
    handleExecuteFileOperationSuggestion,
  };
}

    