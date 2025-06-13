
"use client";

import React from 'react';
import { Sparkles, Code2, MessageSquare, Wand2, FileText } from 'lucide-react';
import { HintCard } from '../hint-card'; // Assuming hint-card is one level up
import type { AttachedFileUIData } from '../types'; // Assuming types is one level up

interface ChatEmptyStateProps {
  setPrompt: (prompt: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  attachedFiles: AttachedFileUIData[]; // Add this prop
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ setPrompt, textareaRef, attachedFiles }) => {
  const commonPrompts = [
    {
      icon: Code2,
      title: "Generate Code",
      description: "Get a Python script for a web scraper.",
      prompt: "Generate a Python script for a web scraper that extracts titles from a news website.",
    },
    {
      icon: MessageSquare,
      title: "Explain Code",
      description: "Explain this complex regular expression to me.",
      prompt: "Explain the following regular expression: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/",
    },
    {
      icon: Wand2,
      title: "Refactor Code",
      description: "Suggest improvements for my active editor code.",
      prompt: "Refactor the code in my active editor tab for better readability and performance.",
    },
    {
      icon: FileText,
      title: "Summarize Document",
      description: "Give me a summary of the attached document.",
      prompt: "Summarize the key points of the attached document.",
    },
  ];

  const handleHintActivate = (promptText: string) => {
    setPrompt(promptText);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <Sparkles className="w-16 h-16 text-primary mb-4" />
      <h2 className="text-xl font-semibold mb-2 text-foreground">How can I help you today?</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Ask me to generate code, explain concepts, refactor snippets, or analyze your project.
        Attach files for more context.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {commonPrompts.map((hint, index) => {
          // Disable summarize document if no files are attached
          if (hint.title === "Summarize Document" && attachedFiles.length === 0) {
            return (
              <HintCard
                key={index}
                icon={hint.icon}
                title={hint.title}
                description="Attach a document first to use this feature."
                onActivate={() => { /* Do nothing or show a toast */ }}
              />
            );
          }
          return (
            <HintCard
              key={index}
              icon={hint.icon}
              title={hint.title}
              description={hint.description}
              onActivate={() => handleHintActivate(hint.prompt)}
            />
          );
        })}
      </div>
    </div>
  );
};
