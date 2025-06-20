import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2, Edit, Trash2, FolderPlus, Move, AlertTriangle, Check, X, File, Folder, Undo2 } from 'lucide-react';
import { ActionButton } from './ActionButton';
import type { FileOperationDisplayProps } from '@/components/ai-assistant/types';

export const FileOperationDisplay: React.FC<FileOperationDisplayProps> = ({
  msg,
  isLoading,
  activeFilePath,
  currentCode,
  getFileSystemNode,
  handleFileOperation,
  copiedStates,
  actionAppliedStates,
  loadingStates,
  expandedCodePreviews,
  toggleCodePreview,
  forceReplaceState,
  setForceReplaceState,
  handleCopyCode,
  updateAttachedFiles,
  setChatHistory,
  undoStack,
  executeUndo,
}) => {
  const messageId = (msg as any).id;
  const messageContent = (msg as any).content;
  const operationData = (msg as any).fileOperationData;
  
  // State management for operations
  const [operationCompleted, setOperationCompleted] = useState(false);
  const [operationResult, setOperationResult] = useState<any>(null);
  const [originalState, setOriginalState] = useState<any>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  if (!operationData) {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap">{messageContent}</p>
      </div>
    );
  }

  const getOperationIcon = (operation: string, fileType?: string) => {
    switch (operation) {
      case 'create': 
        return fileType === 'folder' ? FolderPlus : FilePlus2;
      case 'rename': return Edit;
      case 'delete': return Trash2;
      case 'move': return Move;
      case 'list': return Folder;
      default: return FilePlus2;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'create': return 'text-green-600 dark:text-green-400';
      case 'rename': return 'text-blue-600 dark:text-blue-400';
      case 'delete': return 'text-red-600 dark:text-red-400';
      case 'move': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-primary';
    }
  };

  const getOperationTitle = (operation: string, fileType?: string, isModify?: boolean) => {
    switch (operation) {
      case 'create': 
        return fileType === 'folder' ? 'Folder Creation' : 'File Creation';
      case 'rename': 
        return isModify ? 'File Modification' : 'Rename Operation';
      case 'delete': return 'Delete Operation';
      case 'move': return 'Move Operation';
      case 'list': return 'List Contents';
      default: return 'File Operation';
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
    // Update the chat history to show the operation was cancelled
    if (setChatHistory) {
      setChatHistory(prev => prev.map(message => 
        message.id === messageId 
          ? { ...message, content: `${messageContent}\n\n✅ Operation cancelled successfully. You can request a different action if needed.` }
          : message
      ));
    }
    
    // Show toast notification
    const operationName = operationData.operation === 'create' ? 'File creation' : 
                         operationData.operation === 'rename' ? 'Rename operation' :
                         operationData.operation === 'move' ? 'Move operation' :
                         operationData.operation === 'delete' ? 'Delete operation' : 'Operation';
    
    // You could add a toast here if available in props
    console.log(`${operationName} cancelled by user`);
  };

  const handleExecuteOperation = async (buttonKey: string) => {
    if (operationCompleted || isCancelled) return;

    // Store original state for undo
    const originalStateData = {
      operation: operationData.operation,
      targetPath: operationData.targetPath,
      originalName: operationData.targetPath?.split('/').pop(),
      destinationPath: operationData.destinationPath,
      newName: operationData.newName,
      timestamp: Date.now()
    };
    setOriginalState(originalStateData);

    // Fix the parameters for create operations
    let operationParams: any = {
      targetPath: operationData.targetPath,
      newName: operationData.newName,
      content: operationData.content,
      fileType: operationData.fileType,
      destinationPath: operationData.destinationPath, // For move operations
    };

    // Special handling for create operations
    if (operationData.operation === 'create') {
      // For create operations, we need to separate parent path and filename
      const fullPath = operationData.targetPath || '/';
      const fileName = operationData.newName;
      
      // If targetPath looks like a full file path (e.g., "/news_scraper.py"), extract parent
      let parentPath = '/';
      let actualFileName = fileName;
      
      if (fullPath.includes('/') && fullPath !== '/' && !fileName) {
        // Extract filename from targetPath and use parent as parentPath
        const pathParts = fullPath.split('/');
        actualFileName = pathParts.pop() || 'new_file';
        parentPath = pathParts.join('/') || '/';
      } else {
        // Normal case where we have separate parent path and filename
        parentPath = fullPath === '/' ? '/' : fullPath;
        actualFileName = fileName || 'new_file';
      }
      
      operationParams = {
        parentPath: parentPath,
        fileName: actualFileName,
        fileType: operationData.fileType || 'file',
        content: operationData.content || '', // Ensure content is always passed
        openInIDE: true
      };
      
      console.log('Create operation params:', operationParams); // Debug log
    }

    const result = await handleFileOperation(operationData.operation, operationParams);
    
    console.log('File operation result:', result); // Debug log
    
    if (result?.success) {
      setOperationCompleted(true);
      setOperationResult(result);
      console.log(`Successfully executed ${operationData.operation}:`, result.message);
      
      // Update attached files if needed
      if (updateAttachedFiles) {
        updateAttachedFiles(prev => {
          let updated = [...prev];
          
          if (operationData.operation === 'rename' && operationData.targetPath) {
            // Update the renamed file in attached files
            const oldPath = operationData.targetPath;
            const pathParts = oldPath.split('/');
            pathParts[pathParts.length - 1] = operationData.newName || pathParts[pathParts.length - 1];
            const newPath = pathParts.join('/');
            
            updated = updated.map(file => 
              file.path === oldPath 
                ? { ...file, path: newPath, name: operationData.newName || file.name }
                : file
            );
          } else if (operationData.operation === 'move' && operationData.targetPath && operationData.destinationPath) {
            // Update the moved file in attached files
            const oldPath = operationData.targetPath;
            const fileName = oldPath.split('/').pop() || '';
            const newPath = operationData.destinationPath === '/' ? `/${fileName}` : `${operationData.destinationPath}/${fileName}`;
            
            updated = updated.map(file => 
              file.path === oldPath 
                ? { ...file, path: newPath }
                : file
            );
          } else if (operationData.operation === 'delete' && operationData.targetPath) {
            // Remove deleted file from attached files
            updated = updated.filter(file => file.path !== operationData.targetPath);
          } else if (operationData.operation === 'create') {
            // Add newly created file to attached files
            const fileName = operationParams.fileName;
            const parentPath = operationParams.parentPath || '/';
            const newPath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;
            
            if (operationParams.fileType === 'file') {
              updated.push({
                path: newPath,
                name: fileName,
                type: 'file',
                content: operationParams.content || ''
              });
            }
          }
          
          return updated;
        });
      }
    } else {
      console.error(`Failed to execute ${operationData.operation}:`, result?.message);
    }
  };

  const handleUndo = async () => {
    if (!originalState || !operationCompleted) return;

    let undoOperation: {
      operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
      targetPath?: string;
      newName?: string;
      destinationPath?: string;
    };
    
    switch (originalState.operation) {
      case 'create':
        // Undo create by deleting the created item
        undoOperation = {
          operation: 'delete',
          targetPath: originalState.targetPath === '/' 
            ? `/${originalState.newName}` 
            : `${originalState.targetPath}/${originalState.newName}`
        };
        break;
        
      case 'delete':
        // Cannot undo delete operations
        console.warn('Delete operations cannot be undone');
        return;
        
      case 'rename':
        // Undo rename by renaming back to original name
        const renamedPath = originalState.targetPath.replace(/\/[^\/]+$/, `/${originalState.newName}`);
        undoOperation = {
          operation: 'rename',
          targetPath: renamedPath,
          newName: originalState.originalName
        };
        break;
        
      case 'move':
        // Undo move by moving back to original location
        const fileName = originalState.targetPath.split('/').pop();
        const movedPath = originalState.destinationPath === '/' 
          ? `/${fileName}` 
          : `${originalState.destinationPath}/${fileName}`;
        const originalDir = originalState.targetPath.substring(0, originalState.targetPath.lastIndexOf('/')) || '/';
        undoOperation = {
          operation: 'move',
          targetPath: movedPath,
          destinationPath: originalDir
        };
        break;
        
      default:
        console.warn(`Undo not supported for operation: ${originalState.operation}`);
        return;
    }

    const result = await handleFileOperation(undoOperation.operation, undoOperation);
    
    if (result?.success) {
      setOperationCompleted(false);
      setOperationResult(null);
      setOriginalState(null);
      
      // Revert attached files changes
      if (updateAttachedFiles) {
        updateAttachedFiles(prev => {
          let updated = [...prev];
          
          if (originalState.operation === 'create') {
            // Remove the created item
            const createdPath = originalState.targetPath === '/' 
              ? `/${originalState.newName}` 
              : `${originalState.targetPath}/${originalState.newName}`;
            updated = updated.filter(file => file.path !== createdPath);
          } else if (originalState.operation === 'rename') {
            // Revert the rename
            const renamedPath = originalState.targetPath.replace(/\/[^\/]+$/, `/${originalState.newName}`);
            updated = updated.map(file => 
              file.path === renamedPath 
                ? { ...file, path: originalState.targetPath, name: originalState.originalName }
                : file
            );
          } else if (originalState.operation === 'move') {
            // Revert the move
            const fileName = originalState.targetPath.split('/').pop();
            const movedPath = originalState.destinationPath === '/' 
              ? `/${fileName}` 
              : `${originalState.destinationPath}/${fileName}`;
            updated = updated.map(file => 
              file.path === movedPath 
                ? { ...file, path: originalState.targetPath }
                : file
            );
          }
          
          return updated;
        });
      }
      
      console.log(`Successfully undid ${originalState.operation} operation`);
    } else {
      console.error(`Failed to undo ${originalState.operation}:`, result?.message);
    }
  };

  const OperationIcon = getOperationIcon(operationData.operation, operationData.fileType);
  const isDangerous = operationData.operation === 'delete';
  const isFolder = operationData.fileType === 'folder';
  const isModify = operationData.operation === 'rename' && operationData.newName === operationData.targetPath?.split('/').pop();

  // Don't show anything if cancelled
  if (isCancelled) {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap">{messageContent}</p>
        <div className="text-sm text-green-600 dark:text-green-400">✅ Operation cancelled successfully. You can request a different action if needed.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap">{messageContent}</p>
      
      <Card className={`${isDangerous ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/30' : operationCompleted ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/30' : 'bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30'} max-w-md`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            {operationCompleted ? (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <OperationIcon className={`h-4 w-4 ${getOperationColor(operationData.operation)}`} />
            )}
            <span className="text-sm font-medium">
              {operationCompleted ? 
                `${getOperationTitle(operationData.operation, operationData.fileType, isModify)} Completed` :
                getOperationTitle(operationData.operation, operationData.fileType, isModify)
              }
            </span>
            {isDangerous && !operationCompleted && (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
          </div>

          {/* Operation Details */}
          <div className="mb-3 p-2 bg-background/50 rounded border">
            <div className="space-y-1.5 text-xs">
              {operationData.operation === 'create' && (
                <>
                  <div className="flex items-center gap-2">
                    <strong>Action:</strong> 
                    <span className="flex items-center gap-1">
                      {isFolder ? <Folder className="h-3 w-3" /> : <File className="h-3 w-3" />}
                      Create new {operationData.fileType || 'file'}
                    </span>
                  </div>
                  {operationData.newName && (
                    <div><strong>Name:</strong> {operationData.newName}</div>
                  )}
                  <div><strong>Location:</strong> {operationData.targetPath || '/'}</div>
                  {operationData.content && !isFolder && (
                    <div><strong>Content:</strong> {operationData.content.split('\n').length} lines</div>
                  )}
                </>
              )}
              
              {operationData.operation === 'rename' && (
                <>
                  <div><strong>Current:</strong> {operationData.targetPath?.split('/').pop() || 'Unknown'}</div>
                  {operationData.newName !== operationData.targetPath?.split('/').pop() ? (
                    <div><strong>New Name:</strong> {operationData.newName}</div>
                  ) : (
                    <div><strong>Action:</strong> Modify file content</div>
                  )}
                  <div><strong>Location:</strong> {operationData.targetPath?.split('/').slice(0, -1).join('/') || '/'}</div>
                  {operationData.content && operationData.newName === operationData.targetPath?.split('/').pop() && (
                    <div><strong>Current Size:</strong> {operationData.content.split('\n').length} lines</div>
                  )}
                </>
              )}
              
              {operationData.operation === 'delete' && (
                <>
                  <div><strong>Target:</strong> {operationData.targetPath}</div>
                  {!operationCompleted && (
                    <div className="text-red-600 dark:text-red-400 text-xs">
                      ⚠️ This action cannot be undone
                    </div>
                  )}
                </>
              )}
              
              {operationData.operation === 'move' && (
                <>
                  <div><strong>From:</strong> {operationData.targetPath}</div>
                  <div><strong>To:</strong> {operationData.destinationPath || operationData.newName || 'New location'}</div>
                </>
              )}
            </div>
          </div>

          {/* Reasoning/Message */}
          {operationData.message && !operationCompleted && (
            <div className="mb-3 p-2 bg-primary/5 rounded border border-primary/20 text-xs text-primary/90">
              {operationData.message}
            </div>
          )}

          {/* Action Buttons */}
          {!operationCompleted && (
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleCancel}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              
              <ActionButton
                onClick={() => handleExecuteOperation(`${messageId}-execute`)}
                isLoading={loadingStates[`${messageId}-execute`]}
                isApplied={actionAppliedStates[`${messageId}-execute`]}
                disabled={isLoading}
                icon={OperationIcon}
                buttonKey={`${messageId}-execute`}
                size="sm"
                variant={isDangerous ? "destructive" : "default"}
                className="h-7"
              >
                {isDangerous ? 'Delete' : isModify ? 'Modify' : 'Confirm'}
              </ActionButton>
            </div>
          )}

          {/* Undo Button */}
          {operationCompleted && operationData.operation !== 'delete' && (
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleUndo}
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Undo
              </Button>
            </div>
          )}

          {/* Alternative Options for Create Operation */}
          {operationData.operation === 'create' && !isFolder && !operationCompleted && (
            <div className="mt-3 pt-2 border-t border-primary/20">
              <div className="text-xs text-primary/70 mb-2">
                Alternative Options:
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    // Create a file creation dialog with current content for different location
                    const fileName = operationData.newName || 'new_file';
                    const content = operationData.content || '';
                    
                    if (setChatHistory) {
                      setChatHistory(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        type: 'fileOperationExecution',
                        content: `Specify a custom location for "${fileName}":`,
                        fileOperationData: {
                          operation: 'create',
                          success: false,
                          targetPath: '/', // Default to root, user can specify
                          newName: fileName,
                          content: content,
                          message: `Please specify where you'd like to create "${fileName}". You can say something like "create in src/", "put it in the components folder", or "save to scripts/".`,
                          requiresConfirmation: true,
                          confirmationMessage: `Create "${fileName}" in a custom location?`,
                          fileType: 'file',
                        },
                      }]);
                    }
                  }}
                >
                  Custom Location
                </Button>
                {activeFilePath && (
            <Button
              variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
              onClick={() => {
                      // Merge with current file instead of creating new one
                      const content = operationData.content || '';
                      if (setChatHistory) {
                        setChatHistory(prev => [...prev, {
                          id: Date.now().toString(),
                          role: 'assistant',
                          type: 'generatedCode',
                          content: `I'll merge the code with your current file instead:`,
                          code: content,
                          targetPath: activeFilePath,
                          isNewFile: false,
                        }]);
                      }
                    }}
                  >
                    Merge with Current
            </Button>
                )}
              </div>
            </div>
          )}

          {/* Success Status */}
          {operationCompleted && operationResult && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/30 rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs text-green-700 dark:text-green-300">
                  {isFolder ? 'Folder' : 'File'} {operationData.operation}d successfully
                  {operationData.operation === 'move' && operationData.destinationPath && (
                    ` to ${operationData.destinationPath}`
                  )}
                  {operationData.operation === 'rename' && operationData.newName && (
                    ` to ${operationData.newName}`
                  )}
                </span>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
