
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Send, Loader2, User, BotIcon, ClipboardCopy, Check, RefreshCw, FileText, Wand2, SearchCode, MessageSquare, Code2, FilePlus2, Edit } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer } from '@/app/(ide)/actions';
import type { AiSuggestion, ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AiAssistantPanelProps {
  isVisible: boolean; 
  onToggleVisibility: () => void;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

const HintCard = ({ icon: Icon, title, description, onActivate }: { icon: React.ElementType, title: string, description: string, onActivate: () => void }) => (
  <Card 
    className="w-full p-3 hover:bg-accent/60 cursor-pointer transition-colors shadow-sm hover:shadow-md"
    onClick={onActivate}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onActivate(); }}
    role="button"
    aria-label={`Activate: ${title}`}
  >
    <CardHeader className="p-0 flex flex-row items-center gap-2.5">
      <Icon className="w-5 h-5 text-primary shrink-0" />
      <CardTitle className="text-sm font-medium m-0 p-0 leading-tight">{title}</CardTitle>
    </CardHeader>
    <CardContent className="p-0 pt-1.5">
      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
    </CardContent>
  </Card>
);


export function AiAssistantPanel({ isVisible, onToggleVisibility }: AiAssistantPanelProps) {
  const { activeFilePath, openedFiles, updateFileContent, getFileSystemNode, addNode, openFile } = useIde();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [actionAppliedStates, setActionAppliedStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();


  const currentCode = activeFilePath ? openedFiles.get(activeFilePath)?.content : undefined;
  const currentFileName = activeFilePath ? getFileSystemNode(activeFilePath)?.name : undefined;

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const setTemporaryButtonState = (key: string) => {
    setActionAppliedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setActionAppliedStates(prev => ({ ...prev, [key]: false }));
    }, 2500);
  };

  const handleApplyToEditor = (codeToApply: string, messageId: string, targetPath?: string) => {
    const path = targetPath || activeFilePath;
    const buttonKey = `${messageId}-apply-editor`;

    if (path) {
      updateFileContent(path, codeToApply);
      toast({ title: "Code Applied", description: `Changes applied to ${getFileSystemNode(path)?.name || 'the editor'}.`});
      setTemporaryButtonState(buttonKey);
    } else {
      toast({ variant: "destructive", title: "Error", description: "No active file selected to apply code."});
    }
  };

  const handleCreateFileAndInsert = async (suggestedFileName: string, code: string, messageId: string) => {
    setIsLoading(true);
    const buttonKey = `${messageId}-create-file`;
    let parentDirNode = activeFilePath ? getFileSystemNode(activeFilePath) : null;
    let parentIdForNewNode: string | null = null;
    let baseDirForNewNode = "/";

    if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'file') {
        const pathParts = parentDirNode.path.split('/');
        pathParts.pop(); 
        baseDirForNewNode = pathParts.join('/') || '/';
        const actualParentDirNode = getFileSystemNode(baseDirForNewNode);
        if (actualParentDirNode && !Array.isArray(actualParentDirNode) && actualParentDirNode.type === 'folder') {
            parentIdForNewNode = actualParentDirNode.id;
        } else { 
            parentIdForNewNode = null;
            baseDirForNewNode = "/";
        }

    } else if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'folder') {
        parentIdForNewNode = parentDirNode.id;
        baseDirForNewNode = parentDirNode.path;
    }

    const newNode = addNode(parentIdForNewNode, suggestedFileName, 'file', baseDirForNewNode);

    if (newNode) {
      openFile(newNode.path);
      updateFileContent(newNode.path, code);
      toast({ title: "File Created", description: `"${newNode.name}" created and code inserted.`});
      setTemporaryButtonState(buttonKey);
    } else {
      toast({ variant: "destructive", title: "Error", description: `Could not create file "${suggestedFileName}". It might already exist or the name is invalid.`});
    }
    setIsLoading(false);
  };


  const handleCopyCode = (codeToCopy: string, messageIdPlusAction: string) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [messageIdPlusAction]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [messageIdPlusAction]: false }));
      }, 2000);
    }).catch(err => {
      console.error("Failed to copy code:", err);
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy code to clipboard." });
    });
  };

  const handleNewChat = () => {
    setChatHistory([]);
    setPrompt("");
    textareaRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!prompt.trim()) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      type: 'text',
      content: prompt,
    };
    const currentChatHistory = [...chatHistory, userMessage];
    setChatHistory(currentChatHistory);
    const currentPromptValue = prompt;
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
      const lowerCasePrompt = currentPromptValue.toLowerCase();

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
          const result = await refactorCodeServer({ codeSnippet: currentCode, fileContext: `File: ${currentFileName || 'current file'}\n\n${currentCode}` });
          if (result.suggestion) {
            aiResponse = { 
              id: generateId(), 
              role: 'assistant', 
              type: 'refactorSuggestion', 
              content: "Here's a refactoring suggestion:", 
              suggestion: result.suggestion 
            };
          } else {
            aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: "No specific refactoring suggestions found for the current code." };
          }
        }
      } else if (lowerCasePrompt.includes("find example") || lowerCasePrompt.includes("show example") || lowerCasePrompt.includes("how to use")) {
        const queryMatch = currentPromptValue.match(/(?:find example|show example|how to use)\s*(?:of|for)?\s*([\w\s.<>(){}!"';:,[-]+)/i); 
        const query = queryMatch && queryMatch[1] ? queryMatch[1].trim() : currentPromptValue;
        const result = await findExamplesServer({ query });
         if (result.examples && result.examples.length > 0) {
            aiResponse = { id: generateId(), role: 'assistant', type: 'codeExamples', content: `Here are some examples for "${query}":`, examples: result.examples };
        } else {
            aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: `No examples found for "${query}".` };
        }
      } else { 
        let effectivePrompt = currentPromptValue;
        const historyForContext = currentChatHistory.slice(0, -1); 
        if (historyForContext.length > 0) {
            const lastMessages = historyForContext
                .slice(-3) 
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`)
                .join('\n\n');
            effectivePrompt = `${lastMessages}\n\nUser: ${currentPromptValue}`;
        }
        
        const result = await generateCodeServer({ 
            prompt: effectivePrompt, 
            currentFilePath: activeFilePath || undefined, 
            currentFileContent: currentCode 
        });

        if (result.isNewFile && result.suggestedFileName) {
            aiResponse = {
                id: generateId(),
                role: 'assistant',
                type: 'newFileSuggestion',
                content: `I've generated code for a new file. Suggested name: ${result.suggestedFileName}`,
                code: result.code,
                suggestedFileName: result.suggestedFileName
            };
        } else {
             aiResponse = { 
                id: generateId(), 
                role: 'assistant', 
                type: 'generatedCode', 
                content: "Here's the generated code:", 
                code: result.code 
            };
        }
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
    textareaRef.current?.focus();
  };


  return (
    <div className="w-full border-l border-border bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-headline font-semibold">AI Assistant</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={handleNewChat} title="Start New Chat">
          <RefreshCw className="w-4 h-4" />
          <span className="sr-only">New Chat</span>
        </Button>
      </div>
      
      {chatHistory.length === 0 && !isLoading ? (
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-3 overflow-y-auto">
          <MessageSquare className="w-12 h-12 text-primary opacity-70 mb-2" />
          <h3 className="text-lg font-semibold text-foreground">GenkiFlow AI Assistant</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Your intelligent coding partner. How can I assist you today? Try one of these, or type your own request below:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full max-w-md pt-3">
            <HintCard 
              icon={FileText} 
              title="Summarize Code" 
              description="Get a concise summary of the code in your active editor tab."
              onActivate={() => { setPrompt("Summarize the code in the current file."); textareaRef.current?.focus(); }}
            />
            <HintCard 
              icon={Code2} 
              title="Generate Code" 
              description="Describe any code you need (e.g., a function, a component, a script), and I'll generate it."
              onActivate={() => { setPrompt("Generate a Python function that takes a list of numbers and returns their sum."); textareaRef.current?.focus(); }}
            />
            <HintCard 
              icon={Wand2} 
              title="Refactor Code" 
              description="Suggest improvements for the code in your active editor tab."
              onActivate={() => { setPrompt("Refactor the current code for better readability and performance."); textareaRef.current?.focus(); }}
            />
            <HintCard 
              icon={SearchCode} 
              title="Find Examples" 
              description="Search the codebase for usage examples of functions or components."
              onActivate={() => { setPrompt("Find examples of how the Button component is used."); textareaRef.current?.focus(); }}
            />
          </div>
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-1">
          <div className="p-3 space-y-4">
            {chatHistory.map((msg) => {
              const applyEditorKey = `${msg.id}-apply-editor`;
              const createFileKey = `${msg.id}-create-file`;

              return (
                <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <Card className={cn("max-w-[85%] p-0 shadow-sm", msg.role === 'user' ? "bg-primary/20" : "bg-card/90")}>
                    <CardHeader className="p-3 pb-2 flex flex-row items-center gap-2">
                      {msg.role === 'assistant' && <BotIcon className="w-5 h-5 text-primary" />}
                      {msg.role === 'user' && <User className="w-5 h-5 text-primary" />}
                      <CardDescription className={cn("text-xs", msg.role === 'user' ? "text-primary-foreground/90" : "text-muted-foreground")}>
                        {msg.role === 'user' ? 'You' : 'AI Assistant'} {msg.type === 'loading' ? 'is thinking...' : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-sm">
                      {msg.type === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}
                      {msg.type === 'error' && <p className="text-destructive whitespace-pre-wrap">{msg.content}</p>}
                      
                      {(msg.type === 'generatedCode' || msg.type === 'newFileSuggestion') && msg.code && (
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
                          <div className="relative bg-muted p-2 rounded-md group">
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap max-h-60 font-code"><code>{msg.code}</code></pre>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyCode(msg.code!, `${msg.id}-code`)}
                              title={copiedStates[`${msg.id}-code`] ? "Copied!" : "Copy code"}
                            >
                              {copiedStates[`${msg.id}-code`] ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                          {msg.type === 'newFileSuggestion' && msg.suggestedFileName && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id)} 
                              disabled={isLoading || actionAppliedStates[createFileKey]}
                            >
                              {actionAppliedStates[createFileKey] ? (
                                <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                              ) : (
                                <><FilePlus2 className="mr-1.5 h-4 w-4" /> Create File & Insert</>
                              )}
                            </Button>
                          )}
                          {msg.type === 'generatedCode' && (
                             <Button 
                               size="sm" 
                               variant="outline" 
                               onClick={() => handleApplyToEditor(msg.code!, msg.id)} 
                               disabled={isLoading || !activeFilePath || actionAppliedStates[applyEditorKey]}
                             >
                               {actionAppliedStates[applyEditorKey] ? (
                                 <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                               ) : (
                                 <><Edit className="mr-1.5 h-4 w-4" /> {activeFilePath ? `Insert into ${currentFileName || 'Editor'}` : 'Insert (No file open)'}</>
                               )}
                             </Button>
                          )}
                        </div>
                      )}

                      {msg.type === 'refactorSuggestion' && msg.suggestion && (
                        <div className="space-y-3">
                          <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
                          <Card className="bg-muted/60 shadow-none">
                            <CardHeader className="p-2">
                              <CardDescription className="text-xs">{msg.suggestion.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-2 pt-0">
                              <div className="relative bg-background/70 p-1.5 rounded-md group mb-1.5">
                                <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap font-code"><code>{msg.suggestion.proposedCode}</code></pre>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleCopyCode(msg.suggestion!.proposedCode, `${msg.id}-suggestion`)}
                                  title={copiedStates[`${msg.id}-suggestion`] ? "Copied!" : "Copy code"}
                                >
                                  {copiedStates[`${msg.id}-suggestion`] ? <Check className="h-3 w-3 text-green-500" /> : <ClipboardCopy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <Button 
                                size="xs" 
                                variant="outline" 
                                className="mt-1" 
                                onClick={() => handleApplyToEditor(msg.suggestion!.proposedCode, msg.id)} 
                                disabled={isLoading || !activeFilePath || actionAppliedStates[applyEditorKey]}
                              >
                                {actionAppliedStates[applyEditorKey] ? (
                                  <><Check className="mr-1.5 h-3 w-3 text-green-500" /> Applied</>
                                ) : (
                                  <>{activeFilePath ? 'Apply to Editor' : 'Apply (No file open)'}</>
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                      {msg.type === 'refactorSuggestion' && !msg.suggestion && (
                           <p className="whitespace-pre-wrap">No specific refactoring suggestion found.</p>
                      )}


                      {msg.type === 'codeExamples' && msg.examples && (
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
                          {msg.examples.map((ex, i) => (
                            <div key={i} className="relative bg-muted p-2 rounded-md group">
                              <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap font-code"><code>{ex}</code></pre>
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
              );
            })}
             {isLoading && chatHistory.length === 0 && ( 
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Chat with AI Assistant..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="pr-12 min-h-[60px] bg-input resize-none rounded-lg focus:ring-1 focus:ring-primary"
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md bg-primary hover:bg-primary/90" 
            disabled={isLoading || !prompt.trim()}
            onClick={handleSendMessage}
            title="Send message"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

