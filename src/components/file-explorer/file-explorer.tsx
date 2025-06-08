
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { useIde } from '@/contexts/ide-context';
import { FileTreeItem } from './file-tree-item';
import { Workflow, PlusCircle, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FileExplorer() {
  const { fileSystem, addNode, setNodeToAutoRenameId } = useIde();

  const handleAddRootFile = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newNode = addNode(null, "UntitledFile", 'file', '/');
    if (newNode) {
      setNodeToAutoRenameId(newNode.id);
    }
  };

  const handleAddRootFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newNode = addNode(null, "NewFolder", 'folder', '/');
    if (newNode) {
      setNodeToAutoRenameId(newNode.id);
    }
  };

  return (
    <>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
            <Workflow className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-headline font-semibold">GenkiFlow IDE</h2>
           </div>
           <div className="flex items-center gap-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sidebar-foreground hover:text-primary" 
              onClick={handleAddRootFile} 
              title="Add File to Root"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sidebar-foreground hover:text-primary" 
              onClick={handleAddRootFolder} 
              title="Add Folder to Root"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
           </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          {fileSystem.length > 0 ? (
            <SidebarMenu className="p-2">
              {fileSystem.map((node) => (
                <SidebarMenuItem key={node.id} className="p-0">
                  <FileTreeItem node={node} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          ) : (
            <div className="p-4 pt-6 text-center text-sm text-muted-foreground">
              <p>File explorer is empty.</p>
              <p className="mt-2">Click <PlusCircle className="inline h-3.5 w-3.5 align-middle"/> or <FolderPlus className="inline h-3.5 w-3.5 align-middle"/> above to add items.</p>
            </div>
          )}
        </ScrollArea>
      </SidebarContent>
    </>
  );
}
    
