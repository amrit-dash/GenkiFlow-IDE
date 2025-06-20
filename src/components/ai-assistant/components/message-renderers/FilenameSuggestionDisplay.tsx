import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, FileText, Lightbulb, Star, Undo2, File, Code, Folder } from 'lucide-react';
import { ActionButton } from './ActionButton';
import type { FilenameSuggestionDisplayProps } from '@/components/ai-assistant/types';

export const FilenameSuggestionDisplay: React.FC<FilenameSuggestionDisplayProps> = ({
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
}) => {
  const messageId = (msg as any).id;
  const messageContent = (msg as any).content;
  const suggestionData = (msg as any).filenameSuggestionData;
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  if (!suggestionData) {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap">{messageContent}</p>
      </div>
    );
  }

  // Helper function to get icon for strategy type
  const getStrategyIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'descriptive':
        return File;
      case 'functional':
        return Code;
      case 'conventional':
        return FileText;
      case 'contextual':
        return Folder;
      default:
        return File;
    }
  };

  const handleChooseName = async (selectedName: string, buttonKey: string) => {
    if (selectedOption) return;

    console.log('Starting operation:', {
      targetPath: suggestionData.targetPath,
      selectedName,
      currentFileName: suggestionData.currentFileName,
      itemType: suggestionData.itemType
    });

    setOriginalName(suggestionData.currentFileName);
    setSelectedOption(selectedName);

    let result;
    
    if (suggestionData.currentFileName) {
      // This is a rename operation for existing item
      if (!suggestionData.targetPath) {
        console.error('No target path for rename operation');
        setSelectedOption(null);
        setOriginalName(null);
        return;
      }
      
      setCurrentPath(suggestionData.targetPath);
      
      result = await handleFileOperation('rename', {
        targetPath: suggestionData.targetPath,
        newName: selectedName,
      });

      console.log('Rename result:', result);

      if (result?.success && updateAttachedFiles) {
        // Update attached files to reflect the name change
        const oldPath = suggestionData.targetPath;
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = selectedName;
        const newPath = pathParts.join('/');
        
        setCurrentPath(newPath);
        
        updateAttachedFiles(prev => 
          prev.map(file => 
            file.path === oldPath 
              ? { ...file, path: newPath, name: selectedName }
              : file
          )
        );
        
        console.log(`Successfully renamed ${oldPath} to ${newPath}`);
      }
    } else {
      // This is a create operation for new item
      const parentPath = suggestionData.targetPath || '/';
      const newItemPath = parentPath === '/' ? `/${selectedName}` : `${parentPath}/${selectedName}`;
      
      setCurrentPath(newItemPath);
      
      result = await handleFileOperation('create', {
        parentPath: parentPath,
        fileName: selectedName,
        fileType: suggestionData.itemType || 'file',
        content: suggestionData.itemType === 'folder' ? undefined : '',
        openInIDE: suggestionData.itemType === 'file'
      });

      console.log('Create result:', result);

      if (result?.success && updateAttachedFiles) {
        // Add the new item to attached files if it's a file
        if (suggestionData.itemType === 'file') {
          updateAttachedFiles(prev => [...prev, {
            path: newItemPath,
            name: selectedName,
            type: 'file',
            content: ''
          }]);
        }
        
        console.log(`Successfully created ${suggestionData.itemType}: ${newItemPath}`);
      }
    }

    if (!result?.success) {
      // Reset state if operation failed
      console.error('Operation failed, resetting state');
      setSelectedOption(null);
      setOriginalName(null);
      setCurrentPath(null);
    }
  };

  const handleUndo = async () => {
    if (!currentPath || !selectedOption) return;

    console.log('Starting undo operation:', {
      currentPath,
      originalName,
      selectedOption,
      isRename: !!originalName
    });
    
    let result;
    
    if (originalName) {
      // This was a rename operation - rename back to original
      result = await handleFileOperation('rename', {
        targetPath: currentPath,
        newName: originalName,
      });

      console.log('Undo rename result:', result);

      if (result?.success && updateAttachedFiles) {
        // Update attached files back to original name
        const pathParts = currentPath.split('/');
        pathParts[pathParts.length - 1] = originalName;
        const revertedPath = pathParts.join('/');
        
        updateAttachedFiles(prev => 
          prev.map(file => 
            file.path === currentPath 
              ? { ...file, path: revertedPath, name: originalName }
              : file
          )
        );
        
        console.log(`Successfully reverted ${currentPath} to ${revertedPath}`);
      }
    } else {
      // This was a create operation - delete the created item
      result = await handleFileOperation('delete', {
        targetPath: currentPath,
      });

      console.log('Undo create result:', result);

      if (result?.success && updateAttachedFiles) {
        // Remove the created item from attached files
        updateAttachedFiles(prev => 
          prev.filter(file => file.path !== currentPath)
        );
        
        console.log(`Successfully deleted created item: ${currentPath}`);
      }
    }

    setSelectedOption(null);
    setOriginalName(null);
    setCurrentPath(null);
  };

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap">{messageContent}</p>
      
      <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30 max-w-md">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary dark:text-primary">
              Choose a name for {suggestionData.currentFileName || 'this item'}
            </span>
          </div>

          {/* Current File Info */}
          {suggestionData.currentFileName && (
            <div className="mb-3 p-2 bg-background/50 rounded border">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">Current: {suggestionData.currentFileName}</span>
              </div>
              {suggestionData.analysis && (
                <div className="text-xs text-muted-foreground mt-1">
                  {suggestionData.analysis.detectedLanguage} • {suggestionData.analysis.codeType}
                  {suggestionData.analysis.mainFunctions.length > 0 && (
                    <span> • {suggestionData.analysis.mainFunctions.slice(0, 2).join(', ')}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Name Suggestions */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-primary/80 mb-2">
              Suggested Names:
            </div>
            
            {suggestionData.suggestions.slice(0, 3).map((suggestion: any, idx: number) => {
              const buttonKey = `${messageId}-name-${idx}`;
              const isTopChoice = idx === 0;
              const isSelected = selectedOption === suggestion.filename;
              const isDisabled = selectedOption && !isSelected;
              const StrategyIcon = isTopChoice ? Star : getStrategyIcon(suggestion.category);
              
              return (
                <div 
                  key={idx} 
                  className={`flex items-start justify-between p-2 rounded border transition-colors ${
                    isSelected 
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/30'
                      : isTopChoice 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-background/50 border-border'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {/* Filename row */}
                    <div className="flex items-center gap-2 mb-1">
                      {!isSelected && (
                        <StrategyIcon className={`h-3 w-3 flex-shrink-0 ${
                          isTopChoice ? 'text-primary fill-current' : 'text-muted-foreground'
                        }`} />
                      )}
                      {isSelected && (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                      )}
                      <span className={`text-sm font-medium ${
                        isSelected ? 'text-green-700 dark:text-green-300' :
                        isTopChoice ? 'text-primary' : 'text-foreground'
                      }`}>
                        {suggestion.filename}
                      </span>
                    </div>
                    
                    {/* Metadata row - aligned with filename */}
                    <div className="flex items-center gap-1.5 text-xs ml-5">
                      <span className="text-primary/70 capitalize">
                        {suggestion.category}
                      </span>
                      <span className="text-muted-foreground">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {isSelected ? (
                      <Button
                        onClick={handleUndo}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title="Undo rename"
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleChooseName(suggestion.filename, buttonKey)}
                        disabled={isDisabled || loadingStates[buttonKey]}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title="Use this name"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Keep Current Option */}
          {suggestionData.currentFileName && !selectedOption && (
            <div className="mt-3 pt-2 border-t border-primary/20">
              <div className="flex items-center justify-between p-2 bg-background/30 rounded border-dashed border-border">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Keep current name</div>
                    <div className="text-xs font-medium">{suggestionData.currentFileName}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    console.log('Keeping current name');
                  }}
                >
                  Keep
                </Button>
              </div>
            </div>
          )}

          {/* Success Status */}
          {selectedOption && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/30 rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  Renamed to: {selectedOption}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
