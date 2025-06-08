
"use client"; 

import { useEffect, useState } from 'react';
import { Sidebar, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { CodeEditorPanel } from "@/components/code-editor/code-editor-panel";
import { AiAssistantPanel } from "@/components/ai-assistant/ai-assistant-panel";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIde } from '@/contexts/ide-context';
import { Button } from '@/components/ui/button';
import { Bot, TerminalSquare, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DownloadProjectModal } from '@/components/download-project-modal';
import { downloadWorkspaceAsZip } from '@/lib/workspace-utils';
import { useToast } from '@/hooks/use-toast';

export default function IdePage() {
  const [isClient, setIsClient] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(true); 
  const [showTerminalPanel, setShowTerminalPanel] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const { fileSystem, isBusy: isIdeBusy } = useIde();
  const { toast } = useToast();


  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isIdeBusy) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <p className="text-muted-foreground">Loading IDE...</p>
        </div>
    );
  }

  const toggleAiPanel = () => setShowAiPanel(prev => !prev);
  const toggleTerminalPanel = () => setShowTerminalPanel(prev => !prev);

  const handleProjectDownload = async (projectName: string) => {
    if (!projectName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Project name cannot be empty.",
      });
      return;
    }
    setShowDownloadModal(false);
    toast({ title: "Preparing download...", description: "Your project is being zipped and will download shortly." });
    try {
      await downloadWorkspaceAsZip(fileSystem, projectName.trim());
      toast({ title: "Download Started!", description: `${projectName.trim()}.zip is downloading.` });
    } catch (error) {
      console.error("Failed to download workspace:", error);
      const errorMessage = error instanceof Error ? error.message : "Could not create the zip file.";
      toast({ variant: "destructive", title: "Download Failed", description: errorMessage });
    }
  };

  // Calculate default sizes for panels based on visibility
  const editorPanelSize = showAiPanel ? 65 : 100;
  const aiPanelSize = showAiPanel ? 35 : 0;
  
  const topSectionSize = showTerminalPanel ? 70 : 100;
  const terminalPanelSize = showTerminalPanel ? 30 : 0;


  return (
    <div className="flex h-full w-full relative">
      <Sidebar collapsible="icon" side="left" variant="sidebar" className="min-w-[250px] max-w-[400px] data-[collapsible=icon]:min-w-[var(--sidebar-width-icon)] data-[collapsible=icon]:max-w-[var(--sidebar-width-icon)]">
        <FileExplorer />
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
      
      {/* Global toggle buttons in bottom left corner */}
      <div className="absolute bottom-4 left-4 z-50 flex flex-row gap-2">
        <Button
          size="icon"
          onClick={toggleAiPanel}
          title={showAiPanel ? "Hide AI Assistant" : "Show AI Assistant"}
          className={cn(
            "rounded-md shadow-lg transition-colors duration-150 ease-in-out",
            showAiPanel
              ? "bg-accent text-accent-foreground hover:bg-accent/90" 
              : "bg-card text-card-foreground hover:bg-muted border border-border" 
          )}
        >
          <Bot className="h-5 w-5"/>
           <span className="sr-only">{showAiPanel ? "Hide AI Assistant" : "Show AI Assistant"}</span>
        </Button>
        <Button
          size="icon"
          onClick={toggleTerminalPanel}
          title={showTerminalPanel ? "Hide Terminal" : "Show Terminal"}
          className={cn(
            "rounded-md shadow-lg transition-colors duration-150 ease-in-out",
            showTerminalPanel
              ? "bg-accent text-accent-foreground hover:bg-accent/90"
              : "bg-card text-card-foreground hover:bg-muted border border-border"
          )}
        >
          <TerminalSquare className="h-5 w-5"/>
          <span className="sr-only">{showTerminalPanel ? "Hide Terminal" : "Show Terminal"}</span>
        </Button>
        <Button
          size="icon"
          onClick={() => setShowDownloadModal(true)}
          title="Download Workspace"
          className={cn(
            "rounded-md shadow-lg transition-colors duration-150 ease-in-out",
            "bg-card text-card-foreground hover:bg-muted border border-border"
          )}
        >
          <Download className="h-5 w-5"/>
          <span className="sr-only">Download Workspace</span>
        </Button>
      </div>
      {showDownloadModal && (
        <DownloadProjectModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          onSubmitProjectName={handleProjectDownload}
        />
      )}
    </div>
  );
}
