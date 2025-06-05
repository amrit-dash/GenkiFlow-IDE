
"use client"; // This page uses client-side hooks from useSidebar and custom context

import { useEffect, useState } from 'react'; // Added useEffect, useState
import { Sidebar, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { CodeEditorPanel } from "@/components/code-editor/code-editor-panel";
import { AiAssistantPanel } from "@/components/ai-assistant/ai-assistant-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function IdePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // You can return a loading skeleton here if you prefer.
    // Returning null means this part won't be in the initial server-rendered HTML.
    // Example: return <div className="flex h-screen w-screen items-center justify-center"><p>Loading IDE...</p></div>;
    return null;
  }

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
            <AiAssistantPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </div>
  );
}
