
"use client";

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from 'lucide-react';
import { ChatMessageItem } from '../chat-message-item';
import { ChatEmptyState } from './ChatEmptyState';
import type { ChatHistoryDisplayProps } from '../types'; // Ensure this type includes all needed props

export const ChatHistoryDisplay: React.FC<ChatHistoryDisplayProps> = ({
  chatHistory,
  isLoading,
  scrollAreaRef,
  // Empty state props
  setPromptForEmptyState,
  textareaRefForEmptyState,
  attachedFilesForEmptyState,
  // ChatMessageItem props
  ...chatMessageItemProps
}) => {
  return (
    <>
      {chatHistory.length === 0 && !isLoading ? (
        <ChatEmptyState
          setPrompt={setPromptForEmptyState}
          textareaRef={textareaRefForEmptyState}
          attachedFiles={attachedFilesForEmptyState}
        />
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-1 themed-scrollbar">
          {/* Changed padding from p-3 to px-3 pt-3 pb-1 to reduce bottom gap */}
          <div className="px-3 pt-3 pb-1 space-y-4">
            {chatHistory.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                {...chatMessageItemProps} // Spread remaining props for ChatMessageItem
              />
            ))}
            {isLoading && chatHistory.length > 0 && ( // Show loader at bottom if history exists
              <div className="flex justify-center py-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {isLoading && chatHistory.length === 0 && ( // Centered loader for initial load
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </>
  );
};
