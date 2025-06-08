
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useIde } from '@/contexts/ide-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XIcon, Save, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function CodeEditorPanel() {
  const { activeFilePath, openedFiles, setActiveFilePath, closeFile, updateFileContent, getFileSystemNode } = useIde();
  const [currentContent, setCurrentContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [debouncedContent, setDebouncedContent] = useState("");

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      const fileNode = openedFiles.get(activeFilePath);
      // Initialize currentContent and debouncedContent from fileNode if they are different
      if (fileNode?.content !== currentContent) {
        setCurrentContent(fileNode?.content || "");
        setDebouncedContent(fileNode?.content || "");
      }
      setHasUnsavedChanges(false); // Reset on tab switch
    } else if (!activeFilePath && openedFiles.size > 0) {
      setActiveFilePath(Array.from(openedFiles.keys())[0]);
    } else if (openedFiles.size === 0) {
      setCurrentContent("");
      setDebouncedContent("");
      setHasUnsavedChanges(false);
    }
  // Only re-run if activeFilePath or openedFiles map itself changes, not its content here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath, openedFiles, setActiveFilePath]); 

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentContent(newText); // Update UI immediately
    if (activeFilePath) {
      const originalContent = getFileSystemNode(activeFilePath)?.content; // Check against persisted FS content
      setHasUnsavedChanges(newText !== originalContent);
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

  const isFileActuallySaved = activeFilePath && !hasUnsavedChanges && !isSaving && openedFiles.get(activeFilePath)?.content === getFileSystemNode(activeFilePath)?.content;

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
            <ScrollArea orientation="horizontal" className="pb-0">
              <TabsList className="bg-background border-none p-0 m-0 h-auto rounded-none">
                {Array.from(openedFiles.entries()).map(([path, file]) => {
                  const isFileUnsavedInTab = file.content !== getFileSystemNode(path)?.content;
                  return (
                    <TabsTrigger 
                      key={path} 
                      value={path} 
                      className="px-3 py-2.5 text-sm relative data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none group"
                      title={path}
                    >
                      {file.name}
                      {isFileUnsavedInTab && <span className="ml-1.5 text-amber-500 text-xs">•</span>}
                      <Button 
                        asChild
                        variant="ghost" 
                        size="icon" 
                        className="ml-2 h-5 w-5 absolute top-1/2 right-1 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 hover:bg-muted/50 data-[state=active]:opacity-60 data-[state=active]:hover:opacity-100"
                        onClick={(e) => { 
                          e.stopPropagation();
                          if (isFileUnsavedInTab) {
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
            </ScrollArea>
          </div>
          
          {activeFilePath && openedFiles.has(activeFilePath) && (
             <TabsContent value={activeFilePath} className="flex-1 flex flex-col p-0 m-0 h-full overflow-hidden">
                <ScrollArea className="flex-1">
                  <Textarea
                    value={currentContent} // Directly use currentContent for textarea value
                    onChange={handleContentChange}
                    className="w-full h-full min-h-[calc(100vh-150px)] p-4 font-code text-sm bg-background border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                    placeholder="Select a file to view its content or start typing..."
                    spellCheck="false"
                  />
                </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      )}
       {activeFilePath && hasUnsavedChanges && (
        <Button
          onClick={handleSave}
          size="icon" // Make it a proper icon button
          className="fixed bottom-6 right-6 z-20 rounded-full shadow-lg h-14 w-14 p-0 flex items-center justify-center"
          disabled={isSaving}
          title="Save File (Ctrl+S)"
        >
          {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
          <span className="sr-only">Save File</span>
        </Button>
      )}
      {activeFilePath && isFileActuallySaved && ( // Show green check only if truly saved and not in saving process
         <div
          className="fixed bottom-6 right-6 z-20 rounded-full shadow-lg h-14 w-14 p-0 bg-green-600 text-white flex items-center justify-center"
          title="File Saved"
        >
          <CheckCircle className="h-6 w-6" />
          <span className="sr-only">File Saved</span>
        </div>
      )}
    </div>
  );
}

    