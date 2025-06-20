
import React from 'react';
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { BotIcon, User, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/components/ai-assistant/types';

interface ChatMessageWrapperProps {
  msg: ChatMessage;
  children: React.ReactNode;
}

export const ChatMessageWrapper: React.FC<ChatMessageWrapperProps> = ({ msg, children }) => {
  return (
    <div className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
      <Card className={cn("max-w-[85%] p-0 shadow-sm overflow-x-hidden", msg.role === 'user' ? "bg-primary/20" : "bg-card/90")}>
        <CardHeader className="p-3 pb-2 flex flex-row items-center gap-2">
          {msg.role === 'assistant' && <BotIcon className="w-5 h-5 text-primary" />}
          {msg.role === 'user' && <User className="w-5 h-5 text-primary" />}
          <CardDescription className={cn("text-xs flex-1", msg.role === 'user' ? "text-primary-foreground/90" : "text-muted-foreground")}>
            {msg.role === 'user' ? 'You' : 'AI Assistant'} {msg.type === 'loading' ? 'is thinking...' : ''}
          </CardDescription>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex items-center gap-1">
              <Paperclip className="w-3 h-3 text-primary/70" />
              <span className="text-xs text-primary/70">{msg.attachments.length}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm">
          {children}
        </CardContent>
      </Card>
    </div>
  );
};
