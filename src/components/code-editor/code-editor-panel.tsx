
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
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isRefactoringContextMenu, setIsRefactoringContextMenu] = useState(false);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null); 

  const [activeFileHasUnsavedChanges, setActiveFileHasUnsavedChanges] = useState(false);
  const [unsavedFilesCount, setUnsavedFilesCount] = useState(0);

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const fileNode = openedFiles.get(activeFilePath);
      setCurrentContent(fileNode?.content || "");
    } else if (!activeFilePath && openedFiles.size > 0) {
      // If no active file path but files are open, set the first one as active
      const firstKey = Array.from(openedFiles.keys())[0];
      setActiveFilePath(firstKey);
      // Content will be set by the above block once activeFilePath updates
    } else if (openedFiles.size === 0) {
      setCurrentContent(""); // Clear content if no files are open
    }
  }, [activeFilePath, openedFiles, setActiveFilePath]);

  useEffect(() => {
    let currentActiveUnsaved = false;
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const activeFileNodeInEditor = openedFiles.get(activeFilePath); // Reflects live editor state
      const persistedNode = getFileSystemNode(activeFilePath); // Reflects "saved" state from fileSystem
      const persistedContent = (persistedNode && !Array.isArray(persistedNode) && persistedNode.type === 'file') ? persistedNode.content : undefined;
      
      // Unsaved if editor content (currentContent from activeFileNodeInEditor) differs from "saved" content in fileSystem
      if (activeFileNodeInEditor && activeFileNodeInEditor.content !== persistedContent) {
        currentActiveUnsaved = true;
      }
    }
    setActiveFileHasUnsavedChanges(currentActiveUnsaved);

    let count = 0;
    openedFiles.forEach((tabFileNode, path) => {
      // For the active file, its content on the openedFiles map is the source of truth for unsaved status calculation
      const contentToCheck = tabFileNode.content; 
      const persistedNode = getFileSystemNode(path);
      const persistedContentOfNode = (persistedNode && !Array.isArray(persistedNode) && persistedNode.type === 'file') ? persistedNode.content : undefined;
      if (contentToCheck !== persistedContentOfNode) {
        count++;
      }
    });
    setUnsavedFilesCount(count);
  }, [activeFilePath, openedFiles, getFileSystemNode]);


  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentContent(newText); // Update local state for immediate textarea reflection
    if (activeFilePath) {
      // Update content in openedFiles map but DO NOT trigger save/history yet
      // This is for live unsaved status calculation. Saving/history is handled by updateFileContent.
      const file = openedFiles.get(activeFilePath);
      if (file) {
        openedFiles.set(activeFilePath, { ...file, content: newText });
        // Trigger a re-check of unsaved status without creating a new map instance if not necessary
        // The dependency on 'openedFiles' in the unsaved check useEffect should handle this if 'openedFiles' itself changes.
        // To be safe, force a recalculation (or rely on the useEffect for openedFiles)
        setActiveFileHasUnsavedChanges(newText !== (getFileSystemNode(activeFilePath) as any)?.content);
        let count = 0;
        openedFiles.forEach((tabFileNode, path) => {
          const contentToEval = path === activeFilePath ? newText : tabFileNode.content;
          const persistedNode = getFileSystemNode(path);
          const persistedContentOfNode = (persistedNode && !Array.isArray(persistedNode) && persistedNode.type === 'file') ? persistedNode.content : undefined;
          if (contentToEval !== persistedContentOfNode) count++;
        });
        setUnsavedFilesCount(count);
      }
    }
  };

  const handleSave = useCallback(async () => {
    if (activeFilePath && activeFileHasUnsavedChanges) {
      setIsSaving(true);
      // currentContent from local state IS the latest.
      // updateFileContent also updates the 'content' on the openedFiles map entry.
      await updateFileContent(activeFilePath, currentContent); 
      setTimeout(() => {
        setIsSaving(false);
        // No toast for single save
      }, 300);
    }
  }, [activeFilePath, currentContent, activeFileHasUnsavedChanges, updateFileContent]);

  const handleSaveAll = useCallback(async () => {
    if (unsavedFilesCount === 0) return;
    setIsSaving(true);

    const savePromises: Promise<void>[] = [];

    openedFiles.forEach((tabFileNode, path) => {
      // Use the content from the tabFileNode as it's the most up-to-date for each tab
      const contentToSave = tabFileNode.content; 
      const persistedNode = getFileSystemNode(path);
      const persistedContentOfNode = (persistedNode && !Array.isArray(persistedNode) && persistedNode.type === 'file') ? persistedNode.content : undefined;
      
      if (contentToSave !== persistedContentOfNode && contentToSave !== undefined) {
        savePromises.push(updateFileContent(path, contentToSave));
      }
    });
    
    await Promise.all(savePromises);

    setTimeout(() => {
      setIsSaving(false);
      // No toast for save all
    }, 300); 
  }, [openedFiles, getFileSystemNode, updateFileContent, unsavedFilesCount]);


  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const saveKeyPressed = (isMac && event.metaKey && event.key === 's') || (!isMac && event.ctrlKey && event.key === 's');
      const undoKeyPressed = (isMac && event.metaKey && event.key === 'z' && !event.shiftKey) || (!isMac && event.ctrlKey && event.key === 'z' && !event.shiftKey);
      const redoKeyPressed = (isMac && event.metaKey && event.key === 'z' && event.shiftKey) || (!isMac && event.ctrlKey && event.key === 'y') || (!isMac && event.ctrlKey && event.key === 'z' && event.shiftKey);

      if (saveKeyPressed) {
        event.preventDefault();
        if (activeFileHasUnsavedChanges) {
          handleSave();
        } else if (unsavedFilesCount > 0 && !activeFileHasUnsavedChanges) {
           // If active is saved but others aren't, Ctrl+S could trigger Save All.
           // Or prioritize active file only. Current: only saves active IF unsaved.
           // For now, let Save All button handle this scenario explicitly.
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
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    // The DropdownMenuTrigger is not directly used to open, so we toggle manually.
    // However, it's better to control DropdownMenu's open prop directly.
    setContextMenuOpen(true); 
  };

  const handleContextMenuRefactor = async () => {
    if (!activeFilePath || !currentContent.trim() || isRefactoringContextMenu) return;

    setIsRefactoringContextMenu(true);
    setContextMenuOpen(false); 

    try {
      const activeNode = getFileSystemNode(activeFilePath);
      const fileNameForContext = (activeNode && !Array.isArray(activeNode)) ? activeNode.name : activeFilePath;

      const result = await refactorCodeServer({
        codeSnippet: currentContent, 
        fileContext: `File: ${fileNameForContext}`,
      });

      if (result.suggestion && result.suggestion.proposedCode) {
        await updateFileContent(activeFilePath, result.suggestion.proposedCode);
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

  const showSaveButton = activeFileHasUnsavedChanges && unsavedFilesCount > 1;
  const showSaveAllButton = unsavedFilesCount > 0 && !isSaving;


  return (
    <div className="flex flex-col bg-background h-full">
      {openedFiles.size > 0 && (
        <Tabs value={activeFilePath || ""} onValueChange={setActiveFilePath} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="border-b border-border">
            <ScrollArea className="w-full whitespace-nowrap editor-tabs-scroll-area">
              <TabsList className="bg-background border-none p-0 m-0 h-auto rounded-none inline-flex">
                {Array.from(openedFiles.entries()).map(([path, file]) => {
                  const persistedNode = getFileSystemNode(path);
                  const persistedContent = (persistedNode && !Array.isArray(persistedNode) && persistedNode.type === 'file') ? persistedNode.content : undefined;
                  const isFileUnsavedInThisTab = file.content !== persistedContent;
                  return (
                    <TabsTrigger
                      key={path}
                      value={path}
                      className="pl-3 pr-8 py-2.5 text-sm relative data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none group justify-start"
                      title={path}
                    >
                      {isFileUnsavedInThisTab && <span className="mr-1.5 text-amber-500 text-xs shrink-0">•</span>}
                      <span className="truncate">
                        {(file && file.name) ? file.name : path.substring(path.lastIndexOf('/') + 1)}
                      </span>
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
                          const contentForThisTab = openedFiles.get(path)?.content; // Use content from openedFiles map
                          const persistedNodeForThisTab = getFileSystemNode(path);
                          const persistedContentForThisTab = (persistedNodeForThisTab && !Array.isArray(persistedNodeForThisTab) && persistedNodeForThisTab.type === 'file') ? persistedNodeForThisTab.content : undefined;
                          
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
                             const contentForThisTab = openedFiles.get(path)?.content;
                             const persistedNodeForThisTab = getFileSystemNode(path);
                             const persistedContentForThisTab = (persistedNodeForThisTab && !Array.isArray(persistedNodeForThisTab) && persistedNodeForThisTab.type === 'file') ? persistedNodeForThisTab.content : undefined;
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
                 {/* Invisible trigger, positioned by onContextMenu handler */}
                <button className="fixed opacity-0 pointer-events-none" style={{top:contextMenuPosition.y, left:contextMenuPosition.x, width:0, height:0}} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56"
              onCloseAutoFocus={(e) => e.preventDefault()} 
              // Position manually if needed, though Radix usually handles it well if trigger is visible
              // style={{ position: 'fixed', top: contextMenuPosition.y, left: contextMenuPosition.x }}
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
                className="flex-1 flex flex-col p-0 m-0 overflow-hidden min-h-0"
              >
                <ScrollArea className="flex-1 min-h-0">
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
            {showSaveButton && (
              <Button 
                variant="ghost"
                size="sm" 
                onClick={handleSave} 
                className="h-auto px-2 py-0.5 text-xs text-muted-foreground hover:bg-transparent hover:text-primary"
                title="Save Current File (Ctrl+S)"
              >
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            )}
            {showSaveAllButton && (
               <Button 
                variant="ghost"
                size="sm" 
                onClick={handleSaveAll} 
                className="h-auto px-2 py-0.5 text-xs text-muted-foreground hover:bg-transparent hover:text-primary"
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

