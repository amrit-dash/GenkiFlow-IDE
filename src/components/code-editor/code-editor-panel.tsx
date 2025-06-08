
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useIde } from '@/contexts/ide-context';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XIcon, Loader2, Save, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { refactorCodeServer } from '@/app/(ide)/actions';

export function CodeEditorPanel() {
  const { 
    activeFilePath, 
    openedFiles, 
    setActiveFilePath, 
    closeFile, 
    updateFileContent, 
    getFileSystemNode,
    undoContentChange,
    redoContentChange 
  } = useIde();
  
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [isRefactoringContextMenu, setIsRefactoringContextMenu] = useState(false);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null); 

  const [activeFileHasUnsavedChanges, setActiveFileHasUnsavedChanges] = useState(false);
  const [unsavedFilesCount, setUnsavedFilesCount] = useState(0);

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const fileNode = openedFiles.get(activeFilePath);
      setCurrentContent(fileNode?.content || "");
    } else if (!activeFilePath && openedFiles.size > 0) {
      const firstKey = Array.from(openedFiles.keys())[0];
      setActiveFilePath(firstKey);
      // Content will be set by the above block once activeFilePath updates
    } else if (openedFiles.size === 0) {
      setCurrentContent("");
    }
  }, [activeFilePath, openedFiles, setActiveFilePath]);

  useEffect(() => {
    let currentActiveUnsaved = false;
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const activeFileNode = openedFiles.get(activeFilePath); // Check against openedFiles for real-time editor content
      const persistedNode = getFileSystemNode(activeFilePath); // Check against fileSystem for "saved" state
      const persistedContent = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
      
      // Unsaved if editor content (currentContent) differs from "saved" content in fileSystem
      if (currentContent !== persistedContent) {
        currentActiveUnsaved = true;
      }
    }
    setActiveFileHasUnsavedChanges(currentActiveUnsaved);

    let count = 0;
    openedFiles.forEach((tabFileNode, path) => {
      const contentToCheck = (path === activeFilePath) ? currentContent : tabFileNode.content;
      const persistedNode = getFileSystemNode(path);
      const persistedContentOfNode = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
      if (contentToCheck !== persistedContentOfNode) {
        count++;
      }
    });
    setUnsavedFilesCount(count);
  }, [currentContent, activeFilePath, openedFiles, getFileSystemNode]);


  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentContent(newText);
    // To make live edits reflect immediately in the tab's "unsaved" state without waiting for save
    if (activeFilePath) {
        const activeFile = openedFiles.get(activeFilePath);
        if (activeFile) {
            openedFiles.set(activeFilePath, {...activeFile, content: newText });
            // This direct mutation of openedFiles might need a state setter if it doesn't trigger re-renders for unsaved count
        }
    }
  };

  const handleSave = useCallback(async () => {
    if (activeFilePath && activeFileHasUnsavedChanges) {
      setIsSaving(true);
      // currentContent already reflects the latest editor state.
      // updateFileContent will handle history.
      await updateFileContent(activeFilePath, currentContent); 
      setTimeout(() => {
        setIsSaving(false);
      }, 300);
    }
  }, [activeFilePath, currentContent, activeFileHasUnsavedChanges, updateFileContent]);

  const handleSaveAll = useCallback(async () => {
    if (unsavedFilesCount === 0) return;
    setIsSaving(true);

    const savePromises: Promise<void>[] = [];

    openedFiles.forEach((tabFileNode, path) => {
      const contentToSave = (path === activeFilePath) ? currentContent : tabFileNode.content;
      const persistedNode = getFileSystemNode(path);
      const persistedContentOfNode = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
      
      if (contentToSave !== persistedContentOfNode && contentToSave !== undefined) {
        savePromises.push(updateFileContent(path, contentToSave));
      }
    });
    
    await Promise.all(savePromises);

    setTimeout(() => {
      setIsSaving(false);
    }, 300); 
  }, [activeFilePath, currentContent, openedFiles, getFileSystemNode, updateFileContent, unsavedFilesCount]);


  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const saveKeyPressed = (isMac && event.metaKey && event.key === 's') || (!isMac && event.ctrlKey && event.key === 's');
      const undoKeyPressed = (isMac && event.metaKey && event.key === 'z' && !event.shiftKey) || (!isMac && event.ctrlKey && event.key === 'z' && !event.shiftKey);
      const redoKeyPressed = (isMac && event.metaKey && event.key === 'z' && event.shiftKey) || (!isMac && event.ctrlKey && event.key === 'y') || (!isMac && event.ctrlKey && event.key === 'z' && event.shiftKey); // Cmd+Shift+Z or Ctrl+Shift+Z for redo on some systems

      if (saveKeyPressed) {
        event.preventDefault();
        if (activeFileHasUnsavedChanges) {
          handleSave();
        } else if (unsavedFilesCount > 0) {
           // Optionally save all if active is saved but others aren't
           // handleSaveAll();
        }
      } else if (activeFilePath && undoKeyPressed) {
        event.preventDefault();
        undoContentChange(activeFilePath);
      } else if (activeFilePath && redoKeyPressed) {
        event.preventDefault();
        redoContentChange(activeFilePath);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleSave, activeFileHasUnsavedChanges, unsavedFilesCount, activeFilePath, undoContentChange, redoContentChange]);

  const handleTextareaContextMenu = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    if (dropdownTriggerRef.current) {
      setContextMenuOpen(true);
    }
  };

  const handleContextMenuRefactor = async () => {
    if (!activeFilePath || !currentContent.trim() || isRefactoringContextMenu) return;

    setIsRefactoringContextMenu(true);
    setContextMenuOpen(false); 

    try {
      const activeNode = getFileSystemNode(activeFilePath);
      const fileNameForContext = (activeNode && !Array.isArray(activeNode)) ? activeNode.name : activeFilePath;

      const result = await refactorCodeServer({
        codeSnippet: currentContent, // Send current editor content
        fileContext: `File: ${fileNameForContext}`,
      });

      if (result.suggestion && result.suggestion.proposedCode) {
        // Directly update content using updateFileContent for history management
        await updateFileContent(activeFilePath, result.suggestion.proposedCode);
        // currentContent will update via useEffect listening to openedFiles
        toast({
          title: "Refactor Applied",
          description: "Code refactored and applied to the editor.",
        });
      } else {
        toast({
          variant: "default",
          title: "No Refactoring Suggestion",
          description: "The AI did not find any specific refactoring for this code.",
        });
      }
    } catch (error: any) {
      console.error("Context menu refactor error:", error);
      toast({
        variant: "destructive",
        title: "Refactor Failed",
        description: error.message || "Could not refactor the code.",
      });
    }
    setIsRefactoringContextMenu(false);
  };


  if (openedFiles.size === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4 h-full">
        <p className="text-muted-foreground">No files open. Select a file from the explorer.</p>
      </div>
    );
  }

  let statusDisplay;
  if (isSaving) {
    statusDisplay = <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Saving...</>;
  } else if (unsavedFilesCount > 0) {
    statusDisplay = `${unsavedFilesCount} file${unsavedFilesCount > 1 ? 's' : ''} pending save`;
  } else {
    statusDisplay = "Saved";
  }

  return (
    <div className="flex flex-col bg-background h-full">
      {openedFiles.size > 0 && (
        <Tabs value={activeFilePath || ""} onValueChange={setActiveFilePath} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="border-b border-border">
            <ScrollArea className="w-full whitespace-nowrap editor-tabs-scroll-area">
              <TabsList className="bg-background border-none p-0 m-0 h-auto rounded-none inline-flex">
                {Array.from(openedFiles.entries()).map(([path, file]) => {
                  const persistedNode = getFileSystemNode(path);
                  const persistedContent = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
                  const isFileUnsavedInThisTab = file.content !== persistedContent;
                  return (
                    <TabsTrigger
                      key={path}
                      value={path}
                      className="pl-3 pr-8 py-2.5 text-sm relative data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none group"
                      title={path}
                    >
                      {(file && file.name) ? file.name : path.substring(path.lastIndexOf('/') + 1)}
                      {isFileUnsavedInThisTab && <span className="ml-1.5 text-amber-500 text-xs">•</span>}
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "inline-flex items-center justify-center transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "text-foreground hover:text-accent",
                          "p-0.5 h-auto w-auto",
                          "ml-2 absolute top-1/2 right-2 transform -translate-y-1/2",
                          "opacity-60 hover:opacity-100 focus-visible:opacity-100"
                        )}
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                          e.stopPropagation();
                          const contentForThisTab = path === activeFilePath ? currentContent : file.content;
                          const persistedContentForThisTab = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
                          if (contentForThisTab !== persistedContentForThisTab) {
                            if (!window.confirm("You have unsaved changes in this tab. Are you sure you want to close it?")) {
                              return;
                            }
                          }
                          closeFile(path);
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                           if (e.key === 'Enter' || e.key === ' ') {
                             e.stopPropagation();
                             const contentForThisTab = path === activeFilePath ? currentContent : file.content;
                             const persistedContentForThisTab = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
                             if (contentForThisTab !== persistedContentForThisTab) {
                               if (!window.confirm("You have unsaved changes in this tab. Are you sure you want to close it?")) {
                                 return;
                               }
                             }
                             closeFile(path);
                           }
                        }}
                        aria-label={`Close tab ${file?.name}`}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <ScrollBar orientation="horizontal" className="invisible-scrollbar" />
            </ScrollArea>
          </div>
            
          <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
            <DropdownMenuTrigger ref={dropdownTriggerRef} asChild>
                <button className="fixed opacity-0 pointer-events-none" style={{top:0, left:0, width:0, height:0}} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56"
              onCloseAutoFocus={(e) => e.preventDefault()} 
            >
              <DropdownMenuItem
                onClick={handleContextMenuRefactor}
                disabled={!activeFilePath || isRefactoringContextMenu || !currentContent.trim()}
              >
                {isRefactoringContextMenu ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                <span>Refactor Code</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {activeFilePath && openedFiles.has(activeFilePath) && (
             <TabsContent
                value={activeFilePath}
                className="flex-1 relative p-0 m-0 overflow-hidden min-h-0"
              >
                <ScrollArea className="absolute inset-0 w-full h-full">
                  <Textarea
                    value={currentContent}
                    onChange={handleContentChange}
                    onContextMenu={handleTextareaContextMenu}
                    className="w-full h-full p-4 font-code text-sm bg-background border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                    placeholder="Select a file to view its content or start typing..."
                    spellCheck="false"
                  />
                </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      )}
       <div className="h-8 px-3 py-1.5 border-t border-border text-xs text-muted-foreground flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {statusDisplay}
          </div>
          <div className="flex items-center gap-2">
            {activeFileHasUnsavedChanges && !isSaving && (
              <Button 
                variant="ghost"
                size="sm" 
                onClick={handleSave} 
                className="h-auto px-2 py-0.5 text-xs hover:bg-accent hover:text-accent-foreground"
                title="Save Current File (Ctrl+S)"
              >
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            )}
            {unsavedFilesCount > 0 && !isSaving && ( // Show Save All if any file (even non-active) is unsaved
               <Button 
                variant="ghost"
                size="sm" 
                onClick={handleSaveAll} 
                className="h-auto px-2 py-0.5 text-xs hover:bg-accent hover:text-accent-foreground"
                title="Save All Pending Files"
              >
                <Save className="h-3 w-3 mr-1" /> Save All
              </Button>
            )}
          </div>
       </div>
    </div>
  );
}
