"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useIde } from '@/contexts/ide-context';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XIcon, Loader2, Save, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { refactorCodeServer } from '@/app/(ide)/actions';

export function CodeEditorPanel() {
  const { activeFilePath, openedFiles, setActiveFilePath, closeFile, updateFileContent, getFileSystemNode } = useIde();
  const [currentContent, setCurrentContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [isRefactoringContextMenu, setIsRefactoringContextMenu] = useState(false);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null); 

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const fileNode = openedFiles.get(activeFilePath);
      if (fileNode?.content !== currentContent) {
        setCurrentContent(fileNode?.content || "");
      }
      const persistedNode = getFileSystemNode(activeFilePath);
      const persistedContent = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
      setHasUnsavedChanges(fileNode?.content !== persistedContent);
    } else if (!activeFilePath && openedFiles.size > 0) {
      setActiveFilePath(Array.from(openedFiles.keys())[0]);
    } else if (openedFiles.size === 0) {
      setCurrentContent("");
      setHasUnsavedChanges(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath, openedFiles]); 

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
        const fileInTab = openedFiles.get(activeFilePath);
        const persistedFileNode = getFileSystemNode(activeFilePath);
        const persistedContent = (persistedFileNode && !Array.isArray(persistedFileNode)) ? persistedFileNode.content : undefined;
        setHasUnsavedChanges(fileInTab?.content !== persistedContent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFiles.get(activeFilePath)?.content, activeFilePath, getFileSystemNode]); 


  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentContent(newText);
    if (activeFilePath) {
      const persistedNode = getFileSystemNode(activeFilePath);
      const originalPersistedContent = (persistedNode && !Array.isArray(persistedNode)) ? persistedNode.content : undefined;
      setHasUnsavedChanges(newText !== originalPersistedContent);
    }
  };

  const handleSave = useCallback(() => {
    if (activeFilePath && hasUnsavedChanges) {
      setIsSaving(true);
      updateFileContent(activeFilePath, currentContent);
      setTimeout(() => {
        setIsSaving(false);
      }, 300);
    }
  }, [activeFilePath, currentContent, hasUnsavedChanges, updateFileContent]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSave]);

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
        codeSnippet: currentContent,
        fileContext: `File: ${fileNameForContext}`,
      });

      if (result.suggestion && result.suggestion.proposedCode) {
        setCurrentContent(result.suggestion.proposedCode); 
        updateFileContent(activeFilePath, result.suggestion.proposedCode);
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
                          if (isFileUnsavedInThisTab) {
                            if (!window.confirm("You have unsaved changes in this tab. Are you sure you want to close it?")) {
                              return;
                            }
                          }
                          closeFile(path);
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                           if (e.key === 'Enter' || e.key === ' ') {
                             e.stopPropagation();
                             if (isFileUnsavedInThisTab) {
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
       <div className="h-8 px-3 py-1.5 border-t border-border text-xs text-muted-foreground flex items-center shrink-0">
          <p>Ln: 1, Col: 1</p> 
          {activeFilePath && hasUnsavedChanges && !isSaving && (
            <button 
              onClick={handleSave} 
              className="ml-auto px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1"
              title="Save File (Ctrl+S)"
            >
              <Save className="h-3 w-3" /> Save
            </button>
          )}
          {isSaving && (
            <span className="ml-auto text-xs flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving...</span>
          )}
          {!hasUnsavedChanges && activeFilePath && !isSaving && (
            <span className="ml-auto text-xs text-muted-foreground/70">Saved</span>
          )}
       </div>
    </div>
  );
}
