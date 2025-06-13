
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Brain, MessageSquarePlus } from 'lucide-react';

interface AiAssistantHeaderProps {
  onNewChat: () => void;
}

export const AiAssistantHeader: React.FC<AiAssistantHeaderProps> = ({ onNewChat }) => {
  return (
    <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Brain className="w-6 h-6 text-primary" />
        <h2 className="text-lg font-headline font-semibold">AI Assistant</h2>
      </div>
      <Button variant="ghost" size="icon" onClick={onNewChat} title="Start New Chat">
        <MessageSquarePlus className="w-4 h-4" />
        <span className="sr-only">New Chat</span>
      </Button>
    </div>
  );
};

    