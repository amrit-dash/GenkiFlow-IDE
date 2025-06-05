
"use client";

import { useEffect, useState } from 'react';
import { useIde } from '@/contexts/ide-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XIcon, Save } from 'lucide-react';

export function CodeEditorPanel() {
  const { activeFilePath, openedFiles, setActiveFilePath, closeFile, updateFileContent } = useIde();
  const [currentContent, setCurrentContent] = useState<string>("");

  useEffect(() => {
    if (activeFilePath && openedFiles.has(activeFilePath)) {
      setCurrentContent(openedFiles.get(activeFilePath)?.content || "");
    } else if (!activeFilePath && openedFiles.size > 0) {
      // If active file is closed, open the first available tab
      setActiveFilePath(Array.from(openedFiles.keys())[0]);
    } else if (openedFiles.size === 0) {
      setCurrentContent(""); // Clear content if no files are open
    }
  }, [activeFilePath, openedFiles, setActiveFilePath]);

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentContent(event.target.value);
  };

  const handleSave = () => {
    if (activeFilePath) {
      updateFileContent(activeFilePath, currentContent);
      // Add a toast notification for save
      console.log(`File ${activeFilePath} saved.`);
    }
  };
  
  if (openedFiles.size === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4 h-full">
        <p className="text-muted-foreground">No files open. Select a file from the explorer.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {openedFiles.size > 0 && (
        <Tabs value={activeFilePath || ""} onValueChange={setActiveFilePath} className="flex flex-col h-full">
          <div className="border-b border-border">
            <ScrollArea orientation="horizontal" className="pb-0">
              <TabsList className="bg-background border-none p-0 m-0 h-auto rounded-none">
                {Array.from(openedFiles.entries()).map(([path, file]) => (
                  <TabsTrigger 
                    key={path} 
                    value={path} 
                    className="px-3 py-2.5 text-sm relative data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    {file.name}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="ml-2 h-5 w-5 absolute top-1/2 right-1 transform -translate-y-1/2 opacity-60 hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); closeFile(path); }}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </div>
          
          {activeFilePath && openedFiles.has(activeFilePath) && (
             <TabsContent value={activeFilePath} className="flex-1 flex flex-col p-0 m-0 h-full overflow-hidden">
                <div className="p-2 border-b border-border flex justify-end">
                    <Button onClick={handleSave} size="sm" variant="ghost">
                        <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                </div>
                <ScrollArea className="flex-1 p-1">
                  <Textarea
                    value={currentContent}
                    onChange={handleContentChange}
                    className="w-full h-full min-h-[calc(100vh-200px)] p-4 font-code text-sm bg-background border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                    placeholder="Select a file to view its content..."
                    spellCheck="false"
                  />
                </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
