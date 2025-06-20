import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import { Brain, CheckCircle2, Check, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmartFolderOperationDisplayProps } from '@/components/ai-assistant/types';

export const SmartFolderOperationDisplay: React.FC<SmartFolderOperationDisplayProps> = ({
  msg,
  isLoading,
  actionAppliedStates,
  handleFileOperation,
  setChatHistory,
  updateAttachedFiles,
}) => {
  // State management for operations
  const [completedOperations, setCompletedOperations] = useState<Record<string, any>>({});
  const [originalStates, setOriginalStates] = useState<Record<string, any>>({});
  const [isCancelled, setIsCancelled] = useState(false);

  const message = msg as any; // Type assertion for accessing properties

  if (!message.smartFolderOperationData) return <p>{message.content}</p>;

  const { operation, confidence, folderAnalysis, suggestions, targetPath, reasoning } = message.smartFolderOperationData;
  
  const handleCancel = () => {
    setIsCancelled(true);
    if (setChatHistory) {
      setChatHistory(prev => prev.map(m => 
        m.id === message.id 
          ? { ...m, content: `${message.content}\n\n⚠️ Operation cancelled by user.` }
          : m
      ));
    }
  };

  const handleSuggestionClick = async (suggestion: any, idx: number) => {
    const buttonKey = `${message.id}-folder-${idx}`;
    
    if (completedOperations[buttonKey] || isCancelled) return;

    // Store original state for undo
    const originalStateData = {
      operation,
      suggestion,
      targetPath,
      timestamp: Date.now()
    };
    setOriginalStates(prev => ({ ...prev, [buttonKey]: originalStateData }));

    let result;
    if (operation === 'move') {
      result = await handleFileOperation('move', { 
        targetPath, 
        destinationPath: suggestion.folderPath 
      });
    } else if (operation === 'rename') {
      result = await handleFileOperation('rename', { 
        targetPath, 
        newName: suggestion.folderName 
      });
    } else if (operation === 'delete') {
      result = await handleFileOperation('delete', { 
        targetPath: suggestion.folderPath 
      });
    }

    if (result?.success) {
      setCompletedOperations(prev => ({ ...prev, [buttonKey]: result }));
      
      // Update attached files if needed
      if (updateAttachedFiles) {
        updateAttachedFiles(prev => {
          let updated = [...prev];
          
          if (operation === 'rename' && targetPath) {
            const pathParts = targetPath.split('/');
            pathParts[pathParts.length - 1] = suggestion.folderName;
            const newPath = pathParts.join('/');
            
            updated = updated.map(file => 
              file.path === targetPath 
                ? { ...file, path: newPath, name: suggestion.folderName }
                : file
            );
          } else if (operation === 'move' && targetPath && suggestion.folderPath) {
            const fileName = targetPath.split('/').pop() || '';
            const newPath = suggestion.folderPath === '/' ? `/${fileName}` : `${suggestion.folderPath}/${fileName}`;
            
            updated = updated.map(file => 
              file.path === targetPath 
                ? { ...file, path: newPath }
                : file
            );
          } else if (operation === 'delete' && targetPath) {
            updated = updated.filter(file => file.path !== targetPath);
          }
          
          return updated;
        });
      }
    }
  };

  const handleUndo = async (buttonKey: string) => {
    const originalState = originalStates[buttonKey];
    if (!originalState || !completedOperations[buttonKey]) return;

    let undoOperation: {
      operation: 'create' | 'delete' | 'rename' | 'move' | 'list';
      targetPath?: string;
      newName?: string;
      destinationPath?: string;
    };

    switch (originalState.operation) {
      case 'rename':
        // Undo rename by renaming back to original name
        const renamedPath = targetPath.replace(/\/[^\/]+$/, `/${originalState.suggestion.folderName}`);
        const originalName = targetPath.split('/').pop();
        undoOperation = {
          operation: 'rename',
          targetPath: renamedPath,
          newName: originalName
        };
        break;
        
      case 'move':
        // Undo move by moving back to original location
        const fileName = targetPath.split('/').pop();
        const movedPath = originalState.suggestion.folderPath === '/' 
          ? `/${fileName}` 
          : `${originalState.suggestion.folderPath}/${fileName}`;
        const originalDir = targetPath.substring(0, targetPath.lastIndexOf('/')) || '/';
        undoOperation = {
          operation: 'move',
          targetPath: movedPath,
          destinationPath: originalDir
        };
        break;
        
      case 'delete':
        console.warn('Delete operations cannot be undone');
        return;
        
      default:
        console.warn(`Undo not supported for operation: ${originalState.operation}`);
        return;
    }

    const result = await handleFileOperation(undoOperation.operation, undoOperation);
    
    if (result?.success) {
      setCompletedOperations(prev => {
        const updated = { ...prev };
        delete updated[buttonKey];
        return updated;
      });
      setOriginalStates(prev => {
        const updated = { ...prev };
        delete updated[buttonKey];
        return updated;
      });
      
      // Revert attached files changes
      if (updateAttachedFiles) {
        updateAttachedFiles(prev => {
          let updated = [...prev];
          
          if (originalState.operation === 'rename') {
            const renamedPath = targetPath.replace(/\/[^\/]+$/, `/${originalState.suggestion.folderName}`);
            const originalName = targetPath.split('/').pop();
            updated = updated.map(file => 
              file.path === renamedPath 
                ? { ...file, path: targetPath, name: originalName }
                : file
            );
          } else if (originalState.operation === 'move') {
            const fileName = targetPath.split('/').pop();
            const movedPath = originalState.suggestion.folderPath === '/' 
              ? `/${fileName}` 
              : `${originalState.suggestion.folderPath}/${fileName}`;
            updated = updated.map(file => 
              file.path === movedPath 
                ? { ...file, path: targetPath }
                : file
            );
          }
          
          return updated;
        });
      }
    }
  };

  // Don't show anything if cancelled
  if (isCancelled) {
    return (
      <div className="space-y-2">
        <div className="whitespace-pre-wrap font-medium text-sm mb-2">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        <div className="text-sm text-muted-foreground">⚠️ Operation cancelled by user.</div>
      </div>
    );
  }

  const anyOperationCompleted = Object.keys(completedOperations).length > 0;

  return (
    <div className="space-y-3">
      <div className="whitespace-pre-wrap font-medium text-sm mb-2">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      <Card className={`${anyOperationCompleted ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/30' : 'bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30'}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            {anyOperationCompleted ? (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
            <Brain className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium text-primary dark:text-primary">
              Smart {operation.charAt(0).toUpperCase() + operation.slice(1)} Suggestions
              {anyOperationCompleted && ' - Completed'}
            </span>
            <span className="text-xs text-primary/80 dark:text-primary/90">
              ({Math.round(confidence * 100)}% confidence)
            </span>
          </div>
          
          {folderAnalysis && (
            <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
              <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                📁 Folder Analysis: {folderAnalysis.totalFiles} files, {folderAnalysis.languages.join(', ')}
              </div>
              <div className="text-xs text-primary/90 dark:text-primary/90">Purpose: {folderAnalysis.primaryPurpose}</div>
            </div>
          )}
          
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion: any, idx: number) => {
              const buttonKey = `${message.id}-folder-${idx}`;
              const isCompleted = !!completedOperations[buttonKey];
              const canUndo = isCompleted && operation !== 'delete';

              return (
                <div key={idx} className={`relative flex items-center justify-between p-2 rounded border transition-colors ${
                  isCompleted 
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/30'
                    : 'bg-card/80 dark:bg-card/50 border-border'
                } mb-2`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{suggestion.folderName}</span>
                      <span className={cn("text-xs px-2 py-1 rounded", 
                        isCompleted 
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary"
                      )}>
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{suggestion.reasoning}</div>
                    <div className="text-xs text-primary/90 dark:text-primary/90 mt-1">📂 {suggestion.folderPath}</div>
                    {isCompleted && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Operation completed successfully
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {isCompleted ? (
                      canUndo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Undo operation"
                          onClick={() => handleUndo(buttonKey)}
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      )
                    ) : (
                  <Button
                    variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title={`Use this ${operation === 'move' ? 'destination' : 'name'}`}
                        disabled={isLoading || anyOperationCompleted}
                        onClick={() => handleSuggestionClick(suggestion, idx)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cancel Button */}
          {!anyOperationCompleted && (
            <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleCancel}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          )}
          
          <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
            <div className="text-xs text-primary/90 dark:text-primary/90">
              🤖 {reasoning}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
