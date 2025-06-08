
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"; // Keep Card for individual messages if complex
import { Sparkles, Send, Loader2, User, BotIcon, ClipboardCopy, Check } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer } from '@/app/(ide)/actions';
import type { AiSuggestion, ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AiAssistantPanelProps {
  isVisible: boolean; 
  onToggleVisibility: () => void;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

export function AiAssistantPanel({ isVisible, onToggleVisibility }: AiAssistantPanelProps) {
  const { activeFilePath, openedFiles, updateFileContent, getFileSystemNode } = useIde();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});


  const currentCode = activeFilePath ? openedFiles.get(activeFilePath)?.content : undefined;
  const currentFileName = activeFilePath ? getFileSystemNode(activeFilePath)?.name : "current file";

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const handleApplySuggestion = (suggestedCode: string) => {
    if (activeFilePath) {
      updateFileContent(activeFilePath, suggestedCode);
      // Optionally add a message to chat history confirming action
      setChatHistory(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        type: 'text',
        content: "Code has been applied to the editor."
      }]);
    } else {
       setChatHistory(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        type: 'error',
        content: "No active file to apply the code to."
      }]);
    }
  };

  const handleCopyCode = (codeToCopy: string, messageId: string) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [messageId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [messageId]: false }));
      }, 2000);
    }).catch(err => {
      console.error("Failed to copy code:", err);
      setChatHistory(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        type: 'error',
        content: "Failed to copy code to clipboard."
      }]);
    });
  };

  const handleSendMessage = async () => {
    if (!prompt.trim()) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      type: 'text',
      content: prompt,
    };
    setChatHistory(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    const loadingMessageId = generateId();
    setChatHistory(prev => [...prev, {
      id: loadingMessageId,
      role: 'assistant',
      type: 'loading',
      content: 'Thinking...'
    }]);

    try {
      let aiResponse: ChatMessage | null = null;
      const lowerCasePrompt = prompt.toLowerCase();

      if (lowerCasePrompt.includes("summarize") || lowerCasePrompt.includes("summary")) {
        if (!currentCode) {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "No active file or content to summarize." };
        } else {
          const result = await summarizeCodeSnippetServer({ codeSnippet: currentCode });
          aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: result.summary };
        }
      } else if (lowerCasePrompt.includes("refactor") || lowerCasePrompt.includes("improve this code")) {
        if (!currentCode) {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "No active file or content to refactor." };
        } else {
          const result = await refactorCodeServer({ codeSnippet: currentCode, fileContext: `File: ${currentFileName}\n\n${currentCode}` });
          if (result.suggestions && result.suggestions.length > 0) {
            aiResponse = { id: generateId(), role: 'assistant', type: 'refactorSuggestions', content: "Here are some refactoring suggestions:", suggestions: result.suggestions };
          } else {
            aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: "No refactoring suggestions found for the current code." };
          }
        }
      } else if (lowerCasePrompt.includes("find example") || lowerCasePrompt.includes("show example") || lowerCasePrompt.includes("how to use")) {
        // Extract query for findExamples. This is a simplistic approach.
        const queryMatch = prompt.match(/(?:find example|show example|how to use)\s*(?:of|for)?\s*([\w\s.-]+)/i);
        const query = queryMatch && queryMatch[1] ? queryMatch[1].trim() : prompt; // Fallback to full prompt
        const result = await findExamplesServer({ query });
         if (result.examples && result.examples.length > 0) {
            aiResponse = { id: generateId(), role: 'assistant', type: 'codeExamples', content: `Here are some examples for "${query}":`, examples: result.examples };
        } else {
            aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: `No examples found for "${query}".` };
        }
      } else { // Default to code generation
        const result = await generateCodeServer({ prompt: `${prompt}\n\nConsider the current file context if relevant:\nFile: ${currentFileName}\nCode:\n${currentCode || "No active file content."}` });
        aiResponse = { id: generateId(), role: 'assistant', type: 'generatedCode', content: "Here's the generated code:", code: result.code };
      }
      
      setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageId).concat(aiResponse!));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageId).concat({
        id: generateId(),
        role: 'assistant',
        type: 'error',
        content: errorMessage
      }));
    }
    setIsLoading(false);
  };


  return (
    <div className="w-full border-l border-border bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-headline font-semibold">AI Assistant</h2>
        </div>
      </div>
      
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-1">
        <div className="p-3 space-y-4">
          {chatHistory.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <Card className={cn("max-w-[85%] p-0", msg.role === 'user' ? "bg-primary/20" : "bg-card/80")}>
                <CardHeader className="p-3 pb-2 flex flex-row items-center gap-2">
                  {msg.role === 'assistant' && <BotIcon className="w-5 h-5 text-primary" />}
                  {msg.role === 'user' && <User className="w-5 h-5 text-primary" />}
                   <CardDescription className={cn("text-xs", msg.role === 'user' ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {msg.role === 'user' ? 'You' : 'AI Assistant'} {msg.type === 'loading' ? 'is typing...' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 text-sm">
                  {msg.type === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {msg.type === 'error' && <p className="text-destructive whitespace-pre-wrap">{msg.content}</p>}
                  
                  {msg.type === 'generatedCode' && msg.code && (
                    <div className="space-y-2">
                      <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
                      <div className="relative bg-muted p-2 rounded-md group">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap max-h-60"><code>{msg.code}</code></pre>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyCode(msg.code!, msg.id)}
                          title={copiedStates[msg.id] ? "Copied!" : "Copy code"}
                        >
                          {copiedStates[msg.id] ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleApplySuggestion(msg.code!)}>Insert into Editor</Button>
                    </div>
                  )}

                  {msg.type === 'refactorSuggestions' && msg.suggestions && (
                    <div className="space-y-3">
                       <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
                      {msg.suggestions.map((s, i) => (
                        <Card key={i} className="bg-muted/50">
                          <CardHeader className="p-2">
                            <CardDescription className="text-xs">{s.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="p-2 pt-0">
                            <div className="relative bg-background p-1.5 rounded-md group mb-1.5">
                              <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap"><code>{s.proposedCode}</code></pre>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleCopyCode(s.proposedCode, `${msg.id}-suggestion-${i}`)}
                                title={copiedStates[`${msg.id}-suggestion-${i}`] ? "Copied!" : "Copy code"}
                              >
                                {copiedStates[`${msg.id}-suggestion-${i}`] ? <Check className="h-3 w-3 text-green-500" /> : <ClipboardCopy className="h-3 w-3" />}
                              </Button>
                            </div>
                            <Button size="xs" variant="outline" className="mt-1" onClick={() => handleApplySuggestion(s.proposedCode)}>Apply Suggestion</Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {msg.type === 'codeExamples' && msg.examples && (
                     <div className="space-y-2">
                       <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
                      {msg.examples.map((ex, i) => (
                        <div key={i} className="relative bg-muted p-2 rounded-md group">
                          <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap"><code>{ex}</code></pre>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyCode(ex, `${msg.id}-example-${i}`)}
                            title={copiedStates[`${msg.id}-example-${i}`] ? "Copied!" : "Copy code"}
                           >
                            {copiedStates[`${msg.id}-example-${i}`] ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="relative">
          <Textarea
            placeholder="Chat with AI Assistant..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="pr-12 min-h-[60px] bg-input resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={1}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-2 bottom-2 h-8 w-8" 
            disabled={isLoading || !prompt.trim()}
            onClick={handleSendMessage}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
