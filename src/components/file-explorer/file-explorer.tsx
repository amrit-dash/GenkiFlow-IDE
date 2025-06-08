
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { useIde } from '@/contexts/ide-context';
import { FileTreeItem } from './file-tree-item';
import { Workflow } from 'lucide-react'; // Removed Settings import

export function FileExplorer() {
  const { fileSystem } = useIde();

  return (
    <>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
            <Workflow className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-headline font-semibold">GenkiFlow IDE</h2>
           </div>
           {/* Settings icon removed from here */}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarMenu className="p-2">
            {fileSystem.map((node) => (
              <SidebarMenuItem key={node.id} className="p-0">
                <FileTreeItem node={node} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
    </>
  );
}
