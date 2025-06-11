
"use client"; 

import { useEffect, useState } from 'react';
import { Sidebar, SidebarInset, SidebarRail, SidebarFooter } from "@/components/ui/sidebar"; // Added SidebarFooter
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { CodeEditorPanel } from "@/components/code-editor/code-editor-panel";
import { AiAssistantPanel } from "@/components/ai-assistant/ai-assistant-panel";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIde } from '@/contexts/ide-context';
import { Loader2 } from 'lucide-react';
import { ManageWorkspaceModal } from '@/components/manage-workspace-modal';
import { GlobalControls } from '@/components/global-controls'; // New import

export default function IdePage() {
  const [isClient, setIsClient] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(true); 
  const [showTerminalPanel, setShowTerminalPanel] = useState(false);
  const [showManageWorkspaceModal, setShowManageWorkspaceModal] = useState(false);
  const { isBusy: isIdeBusy } = useIde();


  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isIdeBusy) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin mr-3 text-primary" /> 
            <p className="text-muted-foreground">Loading IDE...</p>
        </div>
    );
  }

  const toggleAiPanel = () => setShowAiPanel(prev => !prev);
  const toggleTerminalPanel = () => setShowTerminalPanel(prev => !prev);

  // Calculate default sizes for panels based on visibility
  const editorPanelSize = showAiPanel ? 65 : 100;
  const aiPanelSize = showAiPanel ? 35 : 0;
  
  const topSectionSize = showTerminalPanel ? 70 : 100;
  const terminalPanelSize = showTerminalPanel ? 30 : 0;


  return (
    <div className="flex h-full w-full relative">
      <Sidebar 
        collapsible="icon" 
        side="left" 
        variant="sidebar" 
        className="min-w-[250px] max-w-[400px] data-[collapsible=icon]:min-w-[var(--sidebar-width-icon)] data-[collapsible=icon]:max-w-[var(--sidebar-width-icon)] flex flex-col" // Added flex flex-col to allow footer to stick to bottom
      >
        <FileExplorer /> {/* FileExplorer should take up available space */}
        {/* Global toggle buttons moved here, inside SidebarFooter */}
        <SidebarFooter className="p-0 border-t-0 mt-auto"> {/* Override default padding of SidebarFooter and remove its top border, mt-auto pushes it down */}
            <GlobalControls 
                showAiPanel={showAiPanel}
                toggleAiPanel={toggleAiPanel}
                showTerminalPanel={showTerminalPanel}
                toggleTerminalPanel={toggleTerminalPanel}
                onManageWorkspace={() => setShowManageWorkspaceModal(true)}
            />
        </SidebarFooter>
      </Sidebar>
      <SidebarRail /> 
      
      <SidebarInset className="flex-1 overflow-hidden p-0 m-0 data-[variant=inset]:min-h-full">
        <ResizablePanelGroup direction="vertical" className="h-full w-full">
          <ResizablePanel defaultSize={topSectionSize} minSize={showTerminalPanel ? 30 : 100}>
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
              <ResizablePanel defaultSize={editorPanelSize} minSize={showAiPanel ? 30 : 100}>
                <CodeEditorPanel />
              </ResizablePanel>
              {showAiPanel && <ResizableHandle withHandle />}
              {showAiPanel && (
                <ResizablePanel defaultSize={aiPanelSize} minSize={25} maxSize={50} className="min-w-[300px]">
                  <AiAssistantPanel isVisible={showAiPanel} onToggleVisibility={toggleAiPanel} />
                </ResizablePanel>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
          
          {showTerminalPanel && <ResizableHandle withHandle />}
          
          {showTerminalPanel && (
            <ResizablePanel defaultSize={terminalPanelSize} minSize={10} maxSize={70}>
              <TerminalPanel isVisible={showTerminalPanel} onToggleVisibility={toggleTerminalPanel} />
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </SidebarInset>
      
      {/* Manage Workspace Modal remains the same */}
      {showManageWorkspaceModal && (
        <ManageWorkspaceModal
          isOpen={showManageWorkspaceModal}
          onClose={() => setShowManageWorkspaceModal(false)}
        />
      )}
    </div>
  );
}
