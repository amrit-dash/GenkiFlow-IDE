
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useIde } from '@/contexts/ide-context';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XIcon, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function CodeEditorPanel() {
  const { activeFilePath, openedFiles, setActiveFilePath, closeFile, updateFileContent, getFileSystemNode } = useIde();
  const [currentContent, setCurrentContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const fileNode = openedFiles.get(activeFilePath);
      if (fileNode?.content !== currentContent) {
        setCurrentContent(fileNode?.content || "");
      }
      const persistedNode = getFileSystemNode(activeFilePath);
      setHasUnsavedChanges(fileNode?.content !== persistedNode?.content);
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
        const persistedFile = getFileSystemNode(activeFilePath);
        if (fileInTab?.content !== currentContent) {
            setCurrentContent(fileInTab?.content || "");
        }
        setHasUnsavedChanges(fileInTab?.content !== persistedFile?.content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedFiles.get(activeFilePath)?.content, activeFilePath, getFileSystemNode]);


  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentContent(newText);
    if (activeFilePath) {
      const originalPersistedContent = getFileSystemNode(activeFilePath)?.content;
      setHasUnsavedChanges(newText !== originalPersistedContent);
    }
  };

  const handleSave = useCallback(() => {
    if (activeFilePath && hasUnsavedChanges) {
      setIsSaving(true);
      updateFileContent(activeFilePath, currentContent);
      setHasUnsavedChanges(false);
      setTimeout(() => {
        setIsSaving(false);
        toast({
          title: "File Saved",
          description: `${getFileSystemNode(activeFilePath)?.name || 'File'} saved successfully.`,
          variant: "default",
        });
      }, 300);
    }
  }, [activeFilePath, currentContent, hasUnsavedChanges, updateFileContent, toast, getFileSystemNode]);

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


  if (openedFiles.size === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4 h-full">
        <p className="text-muted-foreground">No files open. Select a file from the explorer.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background h-full relative bg-red-500/30">
      {openedFiles.size > 0 && (
        <Tabs value={activeFilePath || ""} onValueChange={setActiveFilePath} className="flex-1 flex flex-col overflow-hidden min-h-0 bg-blue-500/30">
          <div className="border-b border-border">
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="bg-background border-none p-0 m-0 h-auto rounded-none inline-flex">
                {Array.from(openedFiles.entries()).map(([path, file]) => {
                  const isFileUnsavedInThisTab = file.content !== getFileSystemNode(path)?.content;
                  return (
                    <TabsTrigger
                      key={path}
                      value={path}
                      className="pl-3 pr-8 py-2.5 text-sm relative data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none group"
                      title={path}
                    >
                      {file.name}
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
                        aria-label={`Close tab ${file.name}`}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {activeFilePath && openedFiles.has(activeFilePath) && (
             <TabsContent
                value={activeFilePath}
                className="flex-1 flex flex-col p-0 m-0 overflow-hidden min-h-0 bg-green-500/30"
              >
                <ScrollArea className="flex-1 w-full min-h-0 bg-orange-500/30">
                  <Textarea
                    value={currentContent}
                    onChange={handleContentChange}
                    className="flex-1 w-full min-h-0 p-4 font-code text-sm bg-purple-500/30 border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
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
       </div>
       <div
          role="button"
          tabIndex={(activeFilePath && hasUnsavedChanges && !isSaving) ? 0 : -1}
          onClick={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSave();}}
          className={cn(
            "absolute bottom-10 right-6 z-20 rounded-full shadow-lg h-10 w-10 p-0 flex items-center justify-center cursor-pointer",
            "bg-primary hover:bg-primary/90",
            "transition-opacity duration-150 ease-in-out",
            (activeFilePath && hasUnsavedChanges && !isSaving) ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          title="Save File (Ctrl+S)"
          aria-hidden={!(activeFilePath && hasUnsavedChanges && !isSaving)}
        >
          <Save className="h-5 w-5 text-primary-foreground" />
          <span className="sr-only">Save File</span>
        </div>
      {isSaving && (
         <div className="absolute bottom-10 right-6 z-20 rounded-full shadow-lg h-10 w-10 p-0 flex items-center justify-center bg-primary/80">
            <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
             <span className="sr-only">Saving...</span>
         </div>
      )}
    </div>
  );
}
