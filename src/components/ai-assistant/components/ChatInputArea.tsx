
"use client";

import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Paperclip, Send, X, Folder, FileText, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttachedFileUIData } from '../types';
import { getDisplayName } from '../ai-assistant-utils';

interface ChatInputAreaProps {
  prompt: string;
  setPrompt: (value: string) => void;
  isLoading: boolean;
  handleSendMessage: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  attachedFiles: AttachedFileUIData[];
  fileSelectorOpen: boolean;
  setFileSelectorOpen: (open: boolean) => void;
  allFilesForSelector: AttachedFileUIData[];
  handleFileSelect: (file: AttachedFileUIData) => void;
  handleRemoveAttachedFile: (path: string) => void;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  prompt,
  setPrompt,
  isLoading,
  handleSendMessage,
  textareaRef,
  attachedFiles,
  fileSelectorOpen,
  setFileSelectorOpen,
  allFilesForSelector,
  handleFileSelect,
  handleRemoveAttachedFile,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-3 border-t border-sidebar-border bg-sidebar">
      {attachedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachedFiles.map((file) => (
            <div
              key={file.path}
              className="flex items-center gap-1.5 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground/90 text-xs px-2 py-1 rounded-md"
            >
              {file.type === 'folder' ? <Folder className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
              <span className="truncate max-w-[120px]" title={file.path}>
                {getDisplayName(file.name)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 text-primary/70 hover:text-primary hover:bg-transparent"
                onClick={() => handleRemoveAttachedFile(file.path)}
                disabled={isLoading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message or ask for commands..."
          className="flex-1 resize-none bg-background border-border focus-visible:ring-primary focus-visible:ring-offset-0 min-h-[86px] h-[86px] max-h-[200px] text-sm themed-scrollbar"
          disabled={isLoading}
        />
        <div className="flex flex-col gap-1.5 shrink-0">
          <Popover open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 bg-background border-border hover:bg-accent"
                title="Attach File or Folder Context"
                disabled={isLoading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 mb-1" side="top" align="end">
              <Command>
                <CommandInput placeholder="Search files/folders..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <ScrollArea className="h-[200px] themed-scrollbar">
                    <CommandGroup>
                      {allFilesForSelector.map((file) => (
                        <CommandItem
                          key={file.path}
                          value={`${getDisplayName(file.name)} ${file.path}`}
                          onSelect={() => {
                            handleFileSelect(file);
                            setFileSelectorOpen(false);
                          }}
                          className="text-xs flex items-center gap-2"
                        >
                          {file.type === 'folder' ? <Folder className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                          <span className="truncate" title={file.path}>{getDisplayName(file.name)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </ScrollArea>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !prompt.trim()}
            size="icon"
            className="shrink-0 h-10 w-10"
            title="Send Message (Enter)"
          >
            {isLoading ? <CornerDownLeft className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
