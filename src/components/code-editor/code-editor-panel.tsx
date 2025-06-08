
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useIde } from '@/contexts/ide-context';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'; // Added ScrollBar
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XIcon, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    <div className="flex-1 flex flex-col bg-background h-full relative">
      {openedFiles.size > 0 && (
        <Tabs value={activeFilePath || ""} onValueChange={setActiveFilePath} className="flex flex-col h-full">
          <div className="border-b border-border">
            <ScrollArea> {/* Removed orientation and pb-0 class */}
              <TabsList className="bg-background border-none p-0 m-0 h-auto rounded-none">
                {Array.from(openedFiles.entries()).map(([path, file]) => {
                  const isFileUnsavedInThisTab = file.content !== getFileSystemNode(path)?.content;
                  return (
                    <TabsTrigger 
                      key={path} 
                      value={path} 
                      className="pl-3 pr-8 py-2.5 text-sm relative data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none group" // Changed px-3 to pl-3 pr-8
                      title={path}
                    >
                      {file.name}
                      {isFileUnsavedInThisTab && <span className="ml-1.5 text-amber-500 text-xs">•</span>}
                      <Button 
                        asChild
                        variant="ghost" 
                        size="icon" 
                        className="ml-2 h-5 w-5 absolute top-1/2 right-2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 data-[state=active]:opacity-60 data-[state=active]:hover:opacity-100" // Changed right-1 to right-2, removed hover:bg-muted/50
                        onClick={(e) => { 
                          e.stopPropagation();
                          if (isFileUnsavedInThisTab) {
                            if (!window.confirm("You have unsaved changes in this tab. Are you sure you want to close it?")) {
                              return;
                            }
                          }
                          closeFile(path); 
                        }}
                        aria-label={`Close tab ${file.name}`}
                      >
                        <span>
                          <XIcon className="h-3.5 w-3.5" />
                        </span>
                      </Button>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <ScrollBar orientation="horizontal" /> {/* Explicitly added horizontal scrollbar */}
            </ScrollArea>
          </div>
          
          {activeFilePath && openedFiles.has(activeFilePath) && (
             <TabsContent value={activeFilePath} className="flex-1 flex flex-col p-0 m-0 h-full overflow-hidden">
                <ScrollArea className="flex-1 h-full">
                  <Textarea
                    value={currentContent}
                    onChange={handleContentChange}
                    className="w-full h-full p-4 font-code text-sm bg-background border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                    placeholder="Select a file to view its content or start typing..."
                    spellCheck="false"
                  />
                </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      )}
       {activeFilePath && hasUnsavedChanges && !isSaving && (
        <Button
          onClick={handleSave}
          className="absolute bottom-6 right-6 z-20 rounded-full shadow-lg h-10 w-10 p-0 flex items-center justify-center bg-primary hover:bg-primary/90"
          title="Save File (Ctrl+S)"
        >
          <Save className="h-5 w-5" />
          <span className="sr-only">Save File</span>
        </Button>
      )}
      {isSaving && (
         <div className="absolute bottom-6 right-6 z-20 rounded-full shadow-lg h-10 w-10 p-0 flex items-center justify-center bg-primary/80">
            <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
             <span className="sr-only">Saving...</span>
         </div>
      )}
    </div>
  );
}
