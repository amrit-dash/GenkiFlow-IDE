
"use client"; 

import { useEffect, useState } from 'react';
import { Sidebar, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { CodeEditorPanel } from "@/components/code-editor/code-editor-panel";
import { AiAssistantPanel } from "@/components/ai-assistant/ai-assistant-panel";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function IdePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <p className="text-muted-foreground">Loading IDE...</p>
        </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <Sidebar collapsible="icon" side="left" variant="sidebar" className="min-w-[250px] max-w-[400px] data-[collapsible=icon]:min-w-[var(--sidebar-width-icon)] data-[collapsible=icon]:max-w-[var(--sidebar-width-icon)]">
        <FileExplorer />
      </Sidebar>
      <SidebarRail /> 
      
      <SidebarInset className="flex-1 overflow-hidden p-0 m-0 data-[variant=inset]:min-h-full">
        <ResizablePanelGroup direction="vertical" className="h-full w-full">
          {/* Top Panel: Editor and AI Assistant */}
          <ResizablePanel defaultSize={70} minSize={30}>
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
              <ResizablePanel defaultSize={65} minSize={30}>
                <CodeEditorPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={20} maxSize={60} className="min-w-[280px]">
                <AiAssistantPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Bottom Panel: Terminal */}
          <ResizablePanel defaultSize={30} minSize={10} maxSize={70} className="min-h-[100px]">
            <TerminalPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </div>
  );
}
