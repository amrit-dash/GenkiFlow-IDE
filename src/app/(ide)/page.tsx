"use client"; // This page uses client-side hooks from useSidebar and custom context

import { useState } from "react";
import { Sidebar, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { CodeEditorPanel } from "@/components/code-editor/code-editor-panel";
import { AiAssistantPanel } from "@/components/ai-assistant/ai-assistant-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function IdePage() {
  const [isAiAssistantVisible, setIsAiAssistantVisible] = useState(true);

  const handleToggleAiAssistant = () => {
    setIsAiAssistantVisible(!isAiAssistantVisible);
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar collapsible="icon" side="left" variant="sidebar" className="min-w-[250px] max-w-[400px] data-[collapsible=icon]:min-w-[var(--sidebar-width-icon)] data-[collapsible=icon]:max-w-[var(--sidebar-width-icon)]">
        <FileExplorer />
      </Sidebar>
      <SidebarRail /> 
      
      <SidebarInset className="flex-1 overflow-hidden p-0 m-0 data-[variant=inset]:min-h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={65} minSize={30}>
            <CodeEditorPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50} className="min-w-[300px]">
            <AiAssistantPanel 
              isVisible={isAiAssistantVisible} 
              onToggleVisibility={handleToggleAiAssistant} 
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </div>
  );
}
