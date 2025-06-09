
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Send, Loader2, User, BotIcon, ClipboardCopy, Check, RefreshCw, FileText, Wand2, SearchCode, MessageSquare, Code2, FilePlus2, Edit, RotateCcw, Paperclip, XCircle } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer } from '@/app/(ide)/actions';
import type { AiSuggestion, ChatMessage, FileSystemNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

interface AiAssistantPanelProps {
  isVisible: boolean; 
  onToggleVisibility: () => void;
}

interface AttachedFile {
  path: string;
  name: string;
  content: string;
}

const MAX_ATTACHED_FILES = 4;

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
  const { 
    activeFilePath, 
    openedFiles, 
    updateFileContent, 
    getFileSystemNode, 
    addNode, 
    openFile,
    fileSystem 
  } = useIde();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [actionAppliedStates, setActionAppliedStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);

  const currentCode = activeFilePath ? openedFiles.get(activeFilePath)?.content : undefined;
  const currentFileName = activeFilePath ? getFileSystemNode(activeFilePath)?.name : undefined;

  const flattenFileSystem = useCallback((nodes: FileSystemNode[], basePath: string = ''): { label: string, value: string, path: string }[] => {
    let list: { label: string, value: string, path: string }[] = [];
    nodes.forEach(node => {
      const displayPath = (basePath ? `${basePath}/` : '') + node.name;
      if (node.type === 'file') {
        list.push({ label: displayPath, value: node.path, path: node.path });
      }
      if (node.type === 'folder' && node.children) {
        list = list.concat(flattenFileSystem(node.children, displayPath));
      }
    });
    return list;
  }, []);

  const allFilesForSelector = useMemo(() => flattenFileSystem(fileSystem).sort((a,b) => a.label.localeCompare(b.label)), [fileSystem, flattenFileSystem]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const setButtonAppliedState = (key: string) => {
    setActionAppliedStates(prev => ({ ...prev, [key]: true }));
  };

  const handleApplyToEditor = (codeToApply: string, messageId: string, buttonKey: string, targetPath?: string) => {
    const path = targetPath || activeFilePath;

    if (path) {
      updateFileContent(path, codeToApply);
      toast({ title: "Code Applied", description: `Changes applied to ${getFileSystemNode(path)?.name || 'the editor'}.`});
      if (!actionAppliedStates[buttonKey]) { 
        setButtonAppliedState(buttonKey);
      }
    } else {
      toast({ variant: "destructive", title: "Error", description: "No active file selected to apply code."});
    }
  };

  const handleCreateFileAndInsert = async (suggestedFileName: string, code: string, messageId: string, buttonKey: string) => {
    setIsLoading(true);
    
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
      openFile(newNode.path, newNode); 
      updateFileContent(newNode.path, code);
      const toastResult = toast({ title: "File Created", description: `"${newNode.name}" created and code inserted.`});
      setTimeout(() => {
        toastResult.dismiss();
      }, 1000);
      if (!actionAppliedStates[buttonKey]) { 
        setButtonAppliedState(buttonKey);
      }
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
    setAttachedFiles([]);
    setActionAppliedStates({}); 
    textareaRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() && attachedFiles.length === 0) return;

    let userMessageContent = prompt;
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ');
      userMessageContent = `${prompt}\n\n(Context from attached file(s): ${fileNames})`;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      type: 'text',
      content: userMessageContent,
    };
    const currentChatHistory = [...chatHistory, userMessage];
    setChatHistory(currentChatHistory);
    const currentPromptValue = prompt;
    const currentAttachedFiles = [...attachedFiles]; 

    setPrompt("");
    // Do not clear attachments here for follow-up questions.
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
      
      const firstAttachedFile = currentAttachedFiles.length > 0 ? currentAttachedFiles[0] : null;

      if (lowerCasePrompt.includes("summarize") || lowerCasePrompt.includes("summary")) {
        const codeToSummarize = firstAttachedFile ? firstAttachedFile.content : currentCode;
        const fileNameForSummary = firstAttachedFile ? firstAttachedFile.name : currentFileName;
        if (!codeToSummarize) {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "No active file or content to summarize. Please open a file or attach one." };
        } else {
          const result = await summarizeCodeSnippetServer({ codeSnippet: codeToSummarize });
          aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: `Summary for ${fileNameForSummary || 'the code'}:\n\n${result.summary}` };
        }
      } else if (lowerCasePrompt.includes("refactor") || lowerCasePrompt.includes("improve this code")) {
        const codeToRefactor = firstAttachedFile ? firstAttachedFile.content : currentCode;
        const fileNameForRefactor = firstAttachedFile ? firstAttachedFile.name : currentFileName;
        if (!codeToRefactor) {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "No active file or content to refactor. Please open a file or attach one." };
        } else {
          const result = await refactorCodeServer({ codeSnippet: codeToRefactor, fileContext: `File: ${fileNameForRefactor || 'current file'}\n\n${codeToRefactor}` });
          if (result.suggestion) {
            aiResponse = { 
              id: generateId(), 
              role: 'assistant', 
              type: 'refactorSuggestion', 
              content: `Here's a refactoring suggestion for ${fileNameForRefactor || 'the code'}:`, 
              suggestion: result.suggestion,
              targetPath: firstAttachedFile?.path || activeFilePath 
            };
          } else {
            aiResponse = { id: generateId(), role: 'assistant', type: 'text', content: `No specific refactoring suggestions found for ${fileNameForRefactor || 'the code'}.` };
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
            currentFileContent: currentCode,
            attachedFiles: currentAttachedFiles.map(f => ({ path: f.path, content: f.content })) 
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
            const defaultTargetPath = currentAttachedFiles.length === 1 ? currentAttachedFiles[0].path : activeFilePath;
             aiResponse = { 
                id: generateId(), 
                role: 'assistant', 
                type: 'generatedCode', 
                content: "Here's the generated code:", 
                code: result.code,
                targetPath: result.targetPath || defaultTargetPath 
            };
        }
      }
      
      setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageId).concat(aiResponse!));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      console.error("AI Assistant Error:", error); 
      setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageId).concat({
        id: generateId(),
        role: 'assistant',
        type: 'error',
        content: `Sorry, I ran into an issue: ${errorMessage}`
      }));
    }
    setIsLoading(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (filePath: string) => {
    if (attachedFiles.length >= MAX_ATTACHED_FILES) {
      toast({ variant: "destructive", title: "Attachment Limit", description: `You can attach a maximum of ${MAX_ATTACHED_FILES} files.` });
      setFileSelectorOpen(false);
      return;
    }
    if (attachedFiles.some(f => f.path === filePath)) {
      toast({ variant: "default", title: "Already Attached", description: "This file is already attached." });
      setFileSelectorOpen(false);
      return;
    }

    const fileNode = getFileSystemNode(filePath);
    if (fileNode && !Array.isArray(fileNode) && fileNode.type === 'file') {
      const openedFile = openedFiles.get(filePath);
      const contentToAttach = openedFile ? openedFile.content : fileNode.content;
      setAttachedFiles(prev => [...prev, { path: filePath, name: fileNode.name, content: contentToAttach || '' }]);
    }
    setFileSelectorOpen(false);
    textareaRef.current?.focus();
  };

  const handleRemoveAttachedFile = (filePathToRemove: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== filePathToRemove));
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
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-3 overflow-y-auto themed-scrollbar">
          <MessageSquare className="w-12 h-12 text-primary opacity-70 mb-2" />
          <h3 className="text-lg font-semibold text-foreground">GenkiFlow AI Assistant</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Your intelligent coding partner. How can I assist you today? Try one of these, or type your own request below. 
            {attachedFiles.length > 0 ? ` Using ${attachedFiles.map(f=>f.name).join(', ')} as context.` : ` Attach up to ${MAX_ATTACHED_FILES} files for specific context.`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full max-w-md pt-3">
            <HintCard 
              icon={FileText} 
              title="Summarize Code" 
              description="Get a concise summary of the code in your active editor tab or an attached file."
              onActivate={() => { setPrompt("Summarize the code."); textareaRef.current?.focus(); }}
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
              description="Suggest improvements for the code in your active editor tab or an attached file."
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
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-1 themed-scrollbar">
          <div className="p-3 space-y-4">
            {chatHistory.map((msg) => {
              const applyEditorKey = `${msg.id}-apply-editor`;
              const createFileKey = `${msg.id}-create-file`;
              const applyGeneratedCodeKey = `${msg.id}-apply-generated`;

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
                          <div className="relative bg-muted p-2 rounded-md group themed-scrollbar">
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap max-h-60 font-code themed-scrollbar"><code>{msg.code}</code></pre>
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
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id, createFileKey)} 
                                disabled={isLoading || actionAppliedStates[createFileKey]}
                              >
                                {actionAppliedStates[createFileKey] ? (
                                  <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                                ) : (
                                  <><FilePlus2 className="mr-1.5 h-4 w-4" /> Create File & Insert</>
                                )}
                              </Button>
                              {actionAppliedStates[createFileKey] && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id, createFileKey)}
                                  disabled={isLoading}
                                  title="Re-apply: Create File & Insert"
                                  className="h-7 w-7"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                          {msg.type === 'generatedCode' && (
                             <div className="flex items-center gap-2">
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 onClick={() => handleApplyToEditor(msg.code!, msg.id, applyGeneratedCodeKey, msg.targetPath)} 
                                 disabled={isLoading || (!msg.targetPath && !activeFilePath) || actionAppliedStates[applyGeneratedCodeKey]}
                               >
                                 {actionAppliedStates[applyGeneratedCodeKey] ? (
                                   <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                                 ) : (
                                   <><Edit className="mr-1.5 h-4 w-4" /> { (msg.targetPath || activeFilePath) ? `Insert into ${getFileSystemNode(msg.targetPath || activeFilePath!)?.name || 'Editor'}` : 'Insert (No file open)'}</>
                                 )}
                               </Button>
                               {actionAppliedStates[applyGeneratedCodeKey] && (msg.targetPath || activeFilePath) && (
                                 <Button
                                   size="icon"
                                   variant="ghost"
                                   onClick={() => handleApplyToEditor(msg.code!, msg.id, applyGeneratedCodeKey, msg.targetPath)}
                                   disabled={isLoading}
                                   title="Re-apply: Insert into Editor"
                                   className="h-7 w-7"
                                 >
                                   <RotateCcw className="h-4 w-4" />
                                 </Button>
                               )}
                             </div>
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
                              <div className="relative bg-background/70 p-1.5 rounded-md group themed-scrollbar mb-1.5">
                                <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap font-code themed-scrollbar"><code>{msg.suggestion.proposedCode}</code></pre>
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
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="xs" 
                                  variant="outline" 
                                  className="mt-1" 
                                  onClick={() => handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath)} 
                                  disabled={isLoading || (!msg.targetPath && !activeFilePath) || actionAppliedStates[applyEditorKey]}
                                >
                                  {actionAppliedStates[applyEditorKey] ? (
                                    <><Check className="mr-1.5 h-3 w-3 text-green-500" /> Applied</>
                                  ) : (
                                    <>{(msg.targetPath || activeFilePath) ? 'Apply to Editor' : 'Apply (No file open)'}</>
                                  )}
                                </Button>
                                {actionAppliedStates[applyEditorKey] && (msg.targetPath || activeFilePath) && (
                                   <Button
                                     size="icon"
                                     variant="ghost"
                                     onClick={() => handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath)}
                                     disabled={isLoading}
                                     title="Re-apply: Apply to Editor"
                                     className="h-6 w-6 mt-1"
                                   >
                                     <RotateCcw className="h-3.5 w-3.5" />
                                   </Button>
                                )}
                              </div>
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
                            <div key={i} className="relative bg-muted p-2 rounded-md group themed-scrollbar">
                              <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap font-code themed-scrollbar"><code>{ex}</code></pre>
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

      <div className="p-4 border-t border-sidebar-border mt-auto space-y-2">
        {attachedFiles.length > 0 && (
           <div className="grid grid-cols-2 gap-1.5">
            {attachedFiles.map(file => (
              <div key={file.path} className="flex items-center justify-between text-xs bg-muted p-1.5 rounded-md">
                <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate" title={file.path}>{file.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => handleRemoveAttachedFile(file.path)} 
                  title="Remove attachment"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Chat with AI Assistant..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 min-h-[60px] bg-input resize-none rounded-lg focus:ring-1 focus:ring-primary pr-[70px] themed-scrollbar"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={1}
          />
          <div className="absolute bottom-2.5 right-2 flex items-center gap-1">
            <Popover open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  title="Attach file for context"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 mb-1 themed-scrollbar" side="top" align="end">
                <Command>
                  <CommandInput placeholder="Search files to attach..." />
                  <CommandList>
                    <CommandEmpty>No files found.</CommandEmpty>
                    <CommandGroup heading="Workspace Files">
                      <ScrollArea className="h-[200px] themed-scrollbar">
                        {allFilesForSelector.map((file) => (
                          <CommandItem
                            key={file.value}
                            value={file.value}
                            onSelect={() => handleFileSelect(file.path)}
                            className="text-xs cursor-pointer"
                          >
                            {file.label}
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button 
              type="submit" 
              size="icon" 
              className="h-7 w-7 rounded-md bg-primary hover:bg-primary/90" 
              disabled={isLoading || (!prompt.trim() && attachedFiles.length === 0)}
              onClick={handleSendMessage}
              title="Send message"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

