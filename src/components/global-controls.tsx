
"use client";

import { Button } from "@/components/ui/button";
import { Bot, TerminalSquare, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggleButton } from '@/components/theme-toggle-button';

interface GlobalControlsProps {
  showAiPanel: boolean;
  toggleAiPanel: () => void;
  showTerminalPanel: boolean;
  toggleTerminalPanel: () => void;
  onManageWorkspace: () => void;
}

export function GlobalControls({
  showAiPanel,
  toggleAiPanel,
  showTerminalPanel,
  toggleTerminalPanel,
  onManageWorkspace,
}: GlobalControlsProps) {
  // This div will be hidden when the parent sidebar is in icon-only (collapsed) mode
  // by using the group-data variant from the Sidebar component.
  return (
    <div className="flex flex-row items-center justify-start gap-2 p-2 group-data-[collapsible=icon]:hidden">
      <Button
        size="icon"
        onClick={toggleAiPanel}
        title={showAiPanel ? "Hide AI Assistant" : "Show AI Assistant"}
        className={cn(
          "rounded-md shadow-lg transition-colors duration-150 ease-in-out h-8 w-8",
          showAiPanel
            ? "bg-accent text-accent-foreground hover:bg-accent/90"
            : "bg-card text-card-foreground hover:bg-muted border border-border"
        )}
      >
        <Bot className="h-4 w-4" />
        <span className="sr-only">{showAiPanel ? "Hide AI Assistant" : "Show AI Assistant"}</span>
      </Button>
      <Button
        size="icon"
        onClick={toggleTerminalPanel}
        title={showTerminalPanel ? "Hide Terminal" : "Show Terminal"}
        className={cn(
          "rounded-md shadow-lg transition-colors duration-150 ease-in-out h-8 w-8",
          showTerminalPanel
            ? "bg-accent text-accent-foreground hover:bg-accent/90"
            : "bg-card text-card-foreground hover:bg-muted border border-border"
        )}
      >
        <TerminalSquare className="h-4 w-4" />
        <span className="sr-only">{showTerminalPanel ? "Hide Terminal" : "Show Terminal"}</span>
      </Button>
      <Button
        size="icon"
        onClick={onManageWorkspace}
        title="Manage Workspace"
        className={cn(
          "rounded-md shadow-lg transition-colors duration-150 ease-in-out h-8 w-8",
          "bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Settings2 className="h-4 w-4" />
        <span className="sr-only">Manage Workspace</span>
      </Button>
      <ThemeToggleButton />
    </div>
  );
}
