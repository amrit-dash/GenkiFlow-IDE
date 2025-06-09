"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain, Send, Loader2, User, BotIcon, ClipboardCopy, Check, RefreshCw, FileText, Wand2, SearchCode, MessageSquare, Code2, FilePlus2, Edit, RotateCcw, Paperclip, XCircle, Pin, TerminalSquare } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer, enhancedGenerateCodeServer, validateCodeServer, analyzeCodeUsageServer, trackOperationProgressServer, executeActualFileOperationServer, executeActualTerminalCommandServer, smartCodePlacementServer, suggestFilenameServer, smartContentInsertionServer } from '@/app/(ide)/actions';
import { generateSimplifiedFileSystemTree, analyzeFileSystemStructure } from '@/ai/tools/file-system-tree-generator';
import type { AiSuggestion, ChatMessage, FileSystemNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import ReactMarkdown from 'react-markdown';

interface AiAssistantPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

interface AttachedFileUIData {
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
    closeFile,
    fileSystem,
    deleteNode,
    renameNode,
    moveNode
  } = useIde();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [actionAppliedStates, setActionAppliedStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const [attachedFiles, setAttachedFiles] = useState<AttachedFileUIData[]>([]);
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);

  const currentCode = activeFilePath ? openedFiles.get(activeFilePath)?.content : undefined;
  const currentFileNode = activeFilePath ? getFileSystemNode(activeFilePath) : undefined;
  const currentFileName = (currentFileNode && !Array.isArray(currentFileNode)) ? currentFileNode.name : undefined;

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

  const handleApplyToEditor = async (codeToApply: string, messageId: string, buttonKey: string, targetPath?: string, insertionContext?: string) => {
    const path = targetPath || activeFilePath;

    if (path) {
      const targetNode = getFileSystemNode(path);
      if (targetNode && !Array.isArray(targetNode)) {
        const existingContent = openedFiles.get(path)?.content || targetNode.content || '';
        
        try {
          // Use smart content insertion to merge the new code with existing content
          const insertionResult = await smartContentInsertionServer({
            existingContent,
            newContent: codeToApply,
            filePath: path,
            insertionContext: insertionContext || 'Generated code insertion',
          });

          if (insertionResult.success) {
            updateFileContent(path, insertionResult.mergedContent);
            const targetFileName = targetNode.name;
            toast({ 
              title: "Code Applied Intelligently", 
              description: `${insertionResult.insertionPoint} in ${targetFileName}. ${insertionResult.reasoning}`
            });
            if (!actionAppliedStates[buttonKey]) {
              setButtonAppliedState(buttonKey);
            }
          } else {
            // Fallback to simple replacement if smart insertion fails
            updateFileContent(path, codeToApply);
            toast({ 
              title: "Code Applied", 
              description: `Changes applied to ${targetNode.name} (fallback mode).`,
              variant: "destructive"
            });
            if (!actionAppliedStates[buttonKey]) {
              setButtonAppliedState(buttonKey);
            }
          }
        } catch (error) {
          console.error('Smart insertion failed:', error);
          // Fallback to simple replacement
          updateFileContent(path, codeToApply);
          toast({ 
            title: "Code Applied", 
            description: `Changes applied to ${targetNode.name} (fallback mode).`,
            variant: "destructive"
          });
          if (!actionAppliedStates[buttonKey]) {
            setButtonAppliedState(buttonKey);
          }
        }
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
    // Do not clear attachments for follow-up
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
              targetPath: firstAttachedFile?.path! || activeFilePath!
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
      } else if (lowerCasePrompt.includes("find usage") || lowerCasePrompt.includes("where is") || lowerCasePrompt.includes("how is") && lowerCasePrompt.includes("used")) {
        // Usage analysis
        const symbolMatch = currentPromptValue.match(/(?:find usage|where is|how is)\s+(?:of\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/i);
        const symbolName = symbolMatch ? symbolMatch[1] : currentPromptValue.split(' ').find(word => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word));
        
        if (symbolName) {
          const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
          const result = await analyzeCodeUsageServer({
            symbolName,
            searchScope: 'workspace',
            currentFilePath: activeFilePath || undefined,
            includeDefinitions: true,
            includeReferences: true,
            fileSystemTree,
          });
          
          aiResponse = {
            id: generateId(),
            role: 'assistant',
            type: 'usageAnalysis',
            content: `Here's the usage analysis for "${symbolName}":`,
            usageAnalysisData: result,
          };
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify a valid symbol name to analyze (e.g., 'find usage of Button' or 'where is useState used')." };
        }
      } else if (lowerCasePrompt.includes("validate") || lowerCasePrompt.includes("check") && (lowerCasePrompt.includes("error") || lowerCasePrompt.includes("issue"))) {
        // Error validation
        const codeToValidate = firstAttachedFile ? firstAttachedFile.content : currentCode;
        const filePathForValidation = firstAttachedFile ? firstAttachedFile.path : activeFilePath;
        
        if (!codeToValidate || !filePathForValidation) {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "No active file or content to validate. Please open a file or attach one." };
        } else {
          const result = await validateCodeServer({
            code: codeToValidate,
            filePath: filePathForValidation,
            projectContext: `Project has ${analyzeFileSystemStructure(fileSystem).totalFiles} files`,
          });
          
          aiResponse = {
            id: generateId(),
            role: 'assistant',
            type: 'errorValidation',
            content: result.hasErrors ? 
              `Found ${result.errors.length} issue(s) in the code:` : 
              "Great! No errors found in the code.",
            errorValidationData: result,
          };
        }
      } else if (lowerCasePrompt.includes("delete") || lowerCasePrompt.includes("remove")) {
        // File deletion operations
        let fileToDelete = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
        
        // Handle specific file mentions in the prompt
        if (lowerCasePrompt.includes("untitled")) {
          // Find any file with "untitled" in the name
          const findUntitledFile = (nodes: FileSystemNode[]): FileSystemNode | null => {
            for (const node of nodes) {
              if (node.type === 'file' && node.name.toLowerCase().includes('untitled')) {
                return node;
              }
              if (node.type === 'folder' && node.children) {
                const found = findUntitledFile(node.children);
                if (found) return found;
              }
            }
            return null;
          };
          const untitledNode = findUntitledFile(fileSystem);
          if (untitledNode) {
            fileToDelete = untitledNode.path;
          }
        } else if (lowerCasePrompt.includes("sum_list")) {
          // Find sum_list.py file
          const findSumListFile = (nodes: FileSystemNode[]): FileSystemNode | null => {
            for (const node of nodes) {
              if (node.type === 'file' && node.name.includes('sum_list')) {
                return node;
              }
              if (node.type === 'folder' && node.children) {
                const found = findSumListFile(node.children);
                if (found) return found;
              }
            }
            return null;
          };
          const sumListNode = findSumListFile(fileSystem);
          if (sumListNode) {
            fileToDelete = sumListNode.path;
          }
        }
        
        if (fileToDelete) {
          // Check if file exists first
          const nodeToDelete = getFileSystemNode(fileToDelete);
          if (!nodeToDelete || Array.isArray(nodeToDelete)) {
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'error',
              content: `❌ File "${fileToDelete}" not found in the file system.`
            };
          } else {
            const result = await handleFileOperation('delete', { targetPath: fileToDelete });
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'fileOperationExecution',
              content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Delete operation failed'}`,
              fileOperationData: {
                operation: 'delete',
                success: result?.success || false,
                targetPath: fileToDelete,
                message: result?.message || 'Operation completed',
                requiresConfirmation: false,
              }
            };
          }
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify which file to delete or attach a file." };
        }
      } else if (lowerCasePrompt.includes("rename")) {
        // File rename operations
        const fileToRename = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
        const newNameMatch = currentPromptValue.match(/rename.*?(?:to|as)\s+([^\s]+)/i);
        const newName = newNameMatch ? newNameMatch[1] : null;
        
        if (fileToRename) {
          if (newName) {
            // Traditional rename with specified new name
            const result = await handleFileOperation('rename', { targetPath: fileToRename, newName });
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'fileOperationExecution',
              content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Rename operation failed'}`,
              fileOperationData: {
                operation: 'rename',
                success: result?.success || false,
                targetPath: fileToRename,
                newName,
                message: result?.message || 'Operation completed',
                requiresConfirmation: false,
              }
            };
          } else {
            // AI-powered filename suggestion
            try {
              const fileNode = getFileSystemNode(fileToRename);
              const fileContent = fileNode && !Array.isArray(fileNode) ? (fileNode.content || '') : '';
              const currentFileName = fileNode && !Array.isArray(fileNode) ? fileNode.name : '';
              const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
              
              const suggestionResult = await suggestFilenameServer({
                fileContent,
                currentFileName,
                context: currentPromptValue,
                projectStructure: fileSystemTree,
              });

              if (suggestionResult.success && suggestionResult.topSuggestion) {
                aiResponse = {
                  id: generateId(),
                  role: 'assistant',
                  type: 'filenameSuggestion',
                  content: `🤖 **AI Analysis Complete!** Based on the file content, I found ${suggestionResult.analysis.mainFunctions.length > 0 ? `functions: ${suggestionResult.analysis.mainFunctions.join(', ')}` : 'code patterns'} in ${suggestionResult.analysis.detectedLanguage}.\n\nHere are my **3 intelligent filename suggestions**:`,
                  targetPath: fileToRename,
                  filenameSuggestionData: {
                    ...suggestionResult,
                    suggestions: suggestionResult.suggestions.slice(0, 3), // Ensure exactly 3 suggestions
                    currentFileName,
                    targetPath: fileToRename,
                  }
                };
              } else {
                aiResponse = { 
                  id: generateId(), 
                  role: 'assistant', 
                  type: 'error', 
                  content: "Failed to analyze file content for filename suggestions. Please specify the new name manually." 
                };
              }
            } catch (error) {
              console.error('Filename suggestion error:', error);
              aiResponse = { 
                id: generateId(), 
                role: 'assistant', 
                type: 'error', 
                content: "Error generating filename suggestions. Please specify the new name manually." 
              };
            }
          }
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify which file to rename or attach a file." };
        }
      } else if (lowerCasePrompt.includes("move") && lowerCasePrompt.includes("to")) {
        // File move operations
        const fileToMove = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
        const destinationMatch = currentPromptValue.match(/move.*?to\s+([^\s]+)/i);
        const destination = destinationMatch ? destinationMatch[1] : null;
        
        if (fileToMove && destination) {
          const result = await handleFileOperation('move', { targetPath: fileToMove, destinationPath: destination });
          aiResponse = {
            id: generateId(),
            role: 'assistant',
            type: 'fileOperationExecution',
            content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Move operation failed'}`,
            fileOperationData: {
              operation: 'move',
              success: result?.success || false,
              targetPath: fileToMove,
              destinationPath: destination,
              message: result?.message || 'Operation completed',
              requiresConfirmation: false,
            }
          };
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify the file to move and destination. Example: 'move this file to /components'" };
        }
      } else if (lowerCasePrompt.includes("list") && (lowerCasePrompt.includes("files") || lowerCasePrompt.includes("untitled"))) {
        // List files operations
        const result = await handleFileOperation('list', {});
        const files = flattenFileSystem(fileSystem);
        const untitledFiles = files.filter(f => f.label.toLowerCase().includes('untitled'));
        
        const filesList = lowerCasePrompt.includes("untitled") ? untitledFiles : files;
        
        aiResponse = {
          id: generateId(),
          role: 'assistant',
          type: 'fileOperationExecution',
          content: `Found ${filesList.length} ${lowerCasePrompt.includes("untitled") ? 'untitled ' : ''}files:\n\n${filesList.map(f => `• ${f.label}`).join('\n')}`,
          fileOperationData: {
            operation: 'list',
            success: true,
            filesFound: filesList.map(f => f.label),
            message: `Found ${filesList.length} files`,
            requiresConfirmation: false,
          }
        };
      } else {
        // Use enhanced code generation with full context
        const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
        const projectAnalysis = analyzeFileSystemStructure(fileSystem);
        
        const historyForContext = currentChatHistory.slice(0, -1);
        const chatHistoryForAI = historyForContext.slice(-6).map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: new Date().toISOString(),
        }));

        try {
          const result = await enhancedGenerateCodeServer({
            prompt: currentPromptValue,
            currentFilePath: activeFilePath || undefined,
            currentFileContent: currentCode,
            currentFileName: currentFileName,
            attachedFiles: currentAttachedFiles.map(f => ({ path: f.path, content: f.content })),
            fileSystemTree,
            chatHistory: chatHistoryForAI,
            projectContext: {
              hasPackageJson: projectAnalysis.hasPackageJson,
              hasReadme: projectAnalysis.hasReadme,
              hasSrcFolder: projectAnalysis.hasSrcFolder,
              hasTestFolder: projectAnalysis.hasTestFolder,
              totalFiles: projectAnalysis.totalFiles,
              totalFolders: projectAnalysis.totalFolders,
            },
          });

          // Perform smart placement analysis for the generated code
          const smartPlacement = await analyzeCodeForSmartPlacement(result.code, currentPromptValue);

          if (result.isNewFile && result.suggestedFileName) {
            // For new files, still show smart placement options
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'smartCodePlacement',
              content: `${result.explanation || 'I\'ve generated code for a new file.'} Based on your codebase analysis, I found ${smartPlacement.analysis.totalRelevantFiles} relevant files where this code could be added.`,
              code: result.code,
              suggestedFileName: result.suggestedFileName,
              explanation: result.explanation,
              fileOperationSuggestion: result.fileOperationSuggestion,
              alternativeOptions: result.alternativeOptions,
              codeQuality: result.codeQuality,
              smartPlacementData: {
                suggestedFiles: smartPlacement.suggestions,
                currentActiveFile: activeFilePath || undefined,
                codeToAdd: result.code,
                codeType: smartPlacement.codeType,
                analysis: smartPlacement.analysis,
              },
            };
          } else {
            // For existing files, prioritize smart placement suggestions
            const defaultTargetPath = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
            const hasGoodSuggestions = smartPlacement.suggestions.length > 0 && smartPlacement.suggestions[0].confidence > 0.6;
            
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: hasGoodSuggestions ? 'smartCodePlacement' : 'enhancedCodeGeneration',
              content: hasGoodSuggestions 
                ? `${result.explanation || "Here's the generated code:"} I found ${smartPlacement.analysis.totalRelevantFiles} relevant files in your codebase. The best match is ${smartPlacement.analysis.topSuggestion?.fileName} (${Math.round((smartPlacement.analysis.topSuggestion?.confidence || 0) * 100)}% confidence).`
                : result.explanation || "Here's the generated code:",
              code: result.code,
              targetPath: result.targetPath || defaultTargetPath || undefined,
              explanation: result.explanation,
              fileOperationSuggestion: result.fileOperationSuggestion,
              alternativeOptions: result.alternativeOptions,
              codeQuality: result.codeQuality,
              smartPlacementData: hasGoodSuggestions ? {
                suggestedFiles: smartPlacement.suggestions,
                currentActiveFile: activeFilePath || undefined,
                codeToAdd: result.code,
                codeType: smartPlacement.codeType,
                analysis: smartPlacement.analysis,
              } : undefined,
            };
          }
        } catch (enhancedError) {
          // Fallback to regular code generation if enhanced fails
          console.warn('Enhanced code generation failed, falling back to regular generation:', enhancedError);
          
          let effectivePrompt = currentPromptValue;
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
            const defaultTargetPath = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'generatedCode',
              content: "Here's the generated code:",
              code: result.code,
              targetPath: result.targetPath! || defaultTargetPath!
            };
          }
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

  // File Operation Handlers
  const handleFileOperation = async (operation: 'create' | 'delete' | 'rename' | 'move' | 'list', operationData: any) => {
    const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
    
    try {
      const result = await executeActualFileOperationServer({
        operation,
        targetPath: operationData.targetPath,
        newName: operationData.newName,
        destinationPath: operationData.destinationPath,
        content: operationData.content,
        fileType: operationData.fileType,
        fileSystemTree,
        confirmed: true,
      });

      // Execute the actual operation through IDE context
      if (result.canExecute && result.readyForExecution) {
        let success = false;
        let message = '';

        switch (operation) {
          case 'delete':
            if (operationData.targetPath) {
              console.log('Attempting to delete file:', operationData.targetPath);
              let nodeToDelete = getFileSystemNode(operationData.targetPath);
              if (!nodeToDelete || Array.isArray(nodeToDelete)) {
                // Try without leading slash if present
                const altPath = operationData.targetPath.startsWith('/') ? operationData.targetPath.slice(1) : '/' + operationData.targetPath;
                nodeToDelete = getFileSystemNode(altPath);
                console.log('Tried alternate path:', altPath, 'Result:', nodeToDelete);
              }
              const allFiles = flattenFileSystem(fileSystem);
              console.log('All files in FS:', allFiles.map(f => ({ name: f.label, value: f.value })));
              if (nodeToDelete && !Array.isArray(nodeToDelete)) {
                if (openedFiles.has(operationData.targetPath)) {
                  closeFile(operationData.targetPath);
                }
                success = deleteNode(nodeToDelete.id);
                message = success 
                  ? `Successfully deleted ${nodeToDelete.name}` 
                  : `Failed to delete ${nodeToDelete.name}. The file may be in use or protected.`;
                if (!success) {
                  window.alert(message);
                }
              } else {
                success = false;
                message = `File not found at path: ${operationData.targetPath}. Available files: ${allFiles.map(f => f.value).join(', ')}`;
                console.log('File not found. Available files:', allFiles.map(f => f.value));
                window.alert(message);
              }
            } else {
              success = false;
              message = 'No target path specified for delete operation';
              window.alert(message);
            }
            break;

          case 'rename':
            if (operationData.targetPath && operationData.newName) {
              console.log('Attempting to rename file:', operationData.targetPath, 'to', operationData.newName);
              let nodeToRename = getFileSystemNode(operationData.targetPath);
              if (!nodeToRename || Array.isArray(nodeToRename)) {
                const altPath = operationData.targetPath.startsWith('/') ? operationData.targetPath.slice(1) : '/' + operationData.targetPath;
                nodeToRename = getFileSystemNode(altPath);
                console.log('Tried alternate path:', altPath, 'Result:', nodeToRename);
              }
              const allFiles = flattenFileSystem(fileSystem);
              console.log('All files in FS:', allFiles.map(f => ({ name: f.label, value: f.value })));
              if (nodeToRename && !Array.isArray(nodeToRename)) {
                success = renameNode(nodeToRename.id, operationData.newName);
                message = success 
                  ? `Successfully renamed to ${operationData.newName}` 
                  : `Failed to rename ${operationData.targetPath}`;
                if (!success) {
                  window.alert(message);
                }
              } else {
                success = false;
                message = `File not found at path: ${operationData.targetPath}. Available files: ${allFiles.map(f => f.value).join(', ')}`;
                console.log('File not found. Available files:', allFiles.map(f => f.value));
                window.alert(message);
              }
            } else {
              success = false;
              message = 'Target path and new name are required for rename operation';
              window.alert(message);
            }
            break;

          case 'move':
            if (operationData.targetPath && operationData.destinationPath) {
              const nodeToMove = getFileSystemNode(operationData.targetPath);
              const destinationNode = getFileSystemNode(operationData.destinationPath);
              if (nodeToMove && !Array.isArray(nodeToMove) && destinationNode && !Array.isArray(destinationNode)) {
                moveNode(nodeToMove.id, destinationNode.id);
                success = true;
                message = `Successfully moved ${operationData.targetPath} to ${operationData.destinationPath}`;
              } else {
                message = `Failed to move file - source or destination not found`;
              }
            }
            break;

          case 'create':
            if (operationData.fileName && operationData.fileType) {
              const parentPath = operationData.parentPath || '/';
              const parentNode = parentPath === '/' ? null : getFileSystemNode(parentPath);
              const parentId = parentNode && !Array.isArray(parentNode) ? parentNode.id : null;
              
              const newNode = addNode(parentId, operationData.fileName, operationData.fileType, parentPath);
              if (newNode) {
                if (operationData.content && operationData.fileType === 'file') {
                  updateFileContent(newNode.path, operationData.content);
                }
                if (operationData.openInIDE && operationData.fileType === 'file') {
                  openFile(newNode.path, newNode);
                }
                success = true;
                message = `Successfully created ${operationData.fileType}: ${operationData.fileName}`;
              } else {
                message = `Failed to create ${operationData.fileType}: ${operationData.fileName}`;
              }
            }
            break;

          case 'list':
            // Return list of files
            const files = flattenFileSystem(fileSystem);
            success = true;
            message = `Found ${files.length} files in the project`;
            break;
        }

        // Show toast notification
        toast({ 
          title: success ? "Operation Successful" : "Operation Failed", 
          description: message,
          variant: success ? "default" : "destructive"
        });

        return { success, message };
      }
    } catch (error) {
      console.error('File operation error:', error);
      toast({ 
        title: "Operation Failed", 
        description: "An error occurred while performing the file operation",
        variant: "destructive"
      });
      return { success: false, message: "Operation failed due to an error" };
    }
  };

  // Terminal Command Handler
  const handleTerminalCommand = async (command: string, context: string) => {
    try {
      const result = await executeActualTerminalCommandServer({
        command,
        context,
        requiresConfirmation: true,
        isBackground: false,
        confirmed: true,
      });

      // For now, just show the command result
      // In the future, this could integrate with the actual terminal component
      toast({ 
        title: "Terminal Command", 
        description: `Command "${command}" processed. Check terminal for output.`,
      });

      return result;
    } catch (error) {
      console.error('Terminal command error:', error);
      toast({ 
        title: "Command Failed", 
        description: "Failed to execute terminal command",
        variant: "destructive"
      });
      return { success: false, message: "Command execution failed" };
    }
  };

  // Smart Code Placement Analysis
  const analyzeCodeForSmartPlacement = async (code: string, prompt: string) => {
    try {
      const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
      const openFilesForAnalysis = Array.from(openedFiles.entries()).map(([path, node]) => ({
        path,
        content: node.content || '',
        language: detectFileLanguage(path),
      }));

      // Analyze the code to determine its type and characteristics
      const codeType = detectCodeType(code, prompt);
      const codeName = extractCodeName(code, codeType);
      const dependencies = extractDependencies(code);

      // Perform smart placement analysis
      const placementResult = await smartCodePlacementServer({
        operation: 'evaluate',
        fileSystemTree,
        openFiles: openFilesForAnalysis,
        query: {
          type: codeType,
          name: codeName,
          description: prompt,
          language: detectMainLanguage(code),
          dependencies,
        },
        currentFilePath: activeFilePath || undefined,
        codeToAdd: code,
      });

      return {
        success: placementResult.success,
        suggestions: placementResult.suggestions || [],
        codeType,
        analysis: {
          totalRelevantFiles: placementResult.suggestions?.length || 0,
          topSuggestion: placementResult.suggestions?.[0] ? {
            filePath: placementResult.suggestions[0].filePath,
            fileName: placementResult.suggestions[0].fileName,
            confidence: placementResult.suggestions[0].confidence,
          } : undefined,
        },
      };
    } catch (error) {
      console.error('Smart placement analysis error:', error);
      return {
        success: false,
        suggestions: [],
        codeType: 'general' as const,
        analysis: { totalRelevantFiles: 0 },
      };
    }
  };

  // Helper functions for code analysis
  const detectFileLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'TypeScript',
      'tsx': 'TypeScript',
      'js': 'JavaScript',
      'jsx': 'JavaScript',
      'py': 'Python',
      'cpp': 'C++',
      'java': 'Java',
    };
    return languageMap[ext || ''] || 'Unknown';
  };

  const detectCodeType = (code: string, prompt: string): 'function' | 'component' | 'class' | 'interface' | 'utility' | 'service' | 'hook' | 'general' => {
    const lowerCode = code.toLowerCase();
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('component') || lowerCode.includes('react') || lowerCode.includes('jsx') || lowerCode.includes('tsx')) {
      return 'component';
    }
    if (lowerPrompt.includes('hook') || lowerCode.includes('use') && lowerCode.includes('function')) {
      return 'hook';
    }
    if (lowerPrompt.includes('interface') || lowerCode.includes('interface')) {
      return 'interface';
    }
    if (lowerPrompt.includes('class') || lowerCode.includes('class ')) {
      return 'class';
    }
    if (lowerPrompt.includes('utility') || lowerPrompt.includes('util') || lowerPrompt.includes('helper')) {
      return 'utility';
    }
    if (lowerPrompt.includes('service') || lowerPrompt.includes('api')) {
      return 'service';
    }
    if (lowerCode.includes('function') || lowerCode.includes('=>') || lowerCode.includes('def ')) {
      return 'function';
    }
    
    return 'general';
  };

  const extractCodeName = (code: string, codeType: string): string | undefined => {
    // Extract function/component/class names from code
    const functionMatch = code.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*:\s*\(|def\s+(\w+)|class\s+(\w+))/);
    return functionMatch ? (functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4] || functionMatch[5]) : undefined;
  };

  const extractDependencies = (code: string): string[] => {
    const dependencies: string[] = [];
    
    // Extract import statements
    const importMatches = code.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        if (moduleMatch) {
          dependencies.push(moduleMatch[1]);
        }
      });
    }
    
    // Extract common React/JavaScript patterns
    if (code.includes('useState')) dependencies.push('react');
    if (code.includes('useEffect')) dependencies.push('react');
    if (code.includes('axios')) dependencies.push('axios');
    if (code.includes('lodash')) dependencies.push('lodash');
    
    return dependencies;
  };

  const detectMainLanguage = (code: string): string => {
    if (code.includes('import') && (code.includes('tsx') || code.includes('jsx') || code.includes('React'))) {
      return 'TypeScript';
    }
    if (code.includes('def ') || code.includes('import ') && code.includes('python')) {
      return 'Python';
    }
    if (code.includes('#include') || code.includes('std::')) {
      return 'C++';
    }
    
    return 'JavaScript';
  };

  return (
    <div className="w-full border-l border-border bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
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
            Your intelligent coding partner with project context awareness. I analyze your file structure, chat history, and provide enhanced suggestions.
            {attachedFiles.length > 0 ? ` Using ${attachedFiles.map(f=>f.name).join(', ')} as context.` : ` Attach up to ${MAX_ATTACHED_FILES} files for specific context.`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full max-w-md pt-3">
            <HintCard
              icon={FileText}
              title="Summarize Code"
              description="Get a summary of the code in your active editor tab or an attached file."
              onActivate={() => { setPrompt("Summarize the code."); textareaRef.current?.focus(); }}
            />
            <HintCard
              icon={Code2}
              title="Generate Code"
              description="Generate code with project context and smart file placement."
              onActivate={() => { setPrompt("Generate a Python function that takes a list of numbers and returns their sum."); textareaRef.current?.focus(); }}
            />
            <HintCard
              icon={Wand2}
              title="Refactor Code"
              description="Suggest code refactoring for your active editor tab or an attached file."
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

                      {(msg.type === 'generatedCode' || msg.type === 'newFileSuggestion' || msg.type === 'enhancedCodeGeneration') && msg.code && (
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
                          {(msg.type === 'generatedCode' || msg.type === 'enhancedCodeGeneration') && (
                             <div className="flex items-center gap-2">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={async () => await handleApplyToEditor(msg.code!, msg.id, applyGeneratedCodeKey, msg.targetPath, 'Generated code from AI assistant')}
                                 disabled={isLoading || (!msg.targetPath && !activeFilePath) || actionAppliedStates[applyGeneratedCodeKey]}
                               >
                                 {actionAppliedStates[applyGeneratedCodeKey] ? (
                                   <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                                 ) : (
                                   <><Edit className="mr-1.5 h-4 w-4" /> { (() => {
                                     const targetPath = msg.targetPath || activeFilePath;
                                     if (!targetPath) return 'Insert (No file open)';
                                     const targetNode = getFileSystemNode(targetPath);
                                     const fileName = (targetNode && !Array.isArray(targetNode)) ? targetNode.name : 'Editor';
                                     return `Insert into ${fileName}`;
                                   })()}</>
                                 )}
                               </Button>
                               {actionAppliedStates[applyGeneratedCodeKey] && (msg.targetPath || activeFilePath) && (
                                 <Button
                                   size="icon"
                                   variant="ghost"
                                   onClick={async () => await handleApplyToEditor(msg.code!, msg.id, applyGeneratedCodeKey, msg.targetPath, 'Generated code from AI assistant')}
                                   disabled={isLoading}
                                   title="Re-apply: Insert into Editor"
                                   className="h-7 w-7"
                                 >
                                   <RotateCcw className="h-4 w-4" />
                                 </Button>
                               )}
                             </div>
                          )}

                          {/* Enhanced Code Generation Features */}
                          {msg.type === 'enhancedCodeGeneration' && (
                            <div className="mt-3 space-y-2">
                              {/* File Operation Suggestion */}
                              {msg.fileOperationSuggestion && msg.fileOperationSuggestion.type !== 'none' && (
                                <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                                  <CardContent className="p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FilePlus2 className="h-4 w-4 text-blue-600" />
                                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                        File Operation Suggestion
                                      </span>
                                      <span className="text-xs text-blue-600 dark:text-blue-400">
                                        ({Math.round(msg.fileOperationSuggestion.confidence * 100)}% confidence)
                                      </span>
                                    </div>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">{msg.fileOperationSuggestion.reasoning}</p>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Alternative Options */}
                              {msg.alternativeOptions && msg.alternativeOptions.length > 0 && (
                                <Card className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                                  <CardContent className="p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <RotateCcw className="h-4 w-4 text-amber-600" />
                                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                        Alternative Options
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      {msg.alternativeOptions.slice(0, 2).map((option, idx) => (
                                        <div key={idx} className="text-xs text-amber-700 dark:text-amber-300">
                                          • {option.description}
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Code Quality Assessment */}
                              {msg.codeQuality && (
                                <Card className="bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
                                  <CardContent className="p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Check className="h-4 w-4 text-green-600" />
                                      <span className="text-xs font-medium text-green-700 dark:text-green-300">
                                        Code Quality
                                      </span>
                                      <span className="text-xs text-green-600 dark:text-green-400 capitalize">
                                        ({msg.codeQuality.estimatedComplexity} complexity)
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                      <div className={cn("flex items-center gap-1", msg.codeQuality.followsBestPractices ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300")}>
                                        {msg.codeQuality.followsBestPractices ? "✓" : "○"} Best Practices
                                      </div>
                                      <div className={cn("flex items-center gap-1", msg.codeQuality.isTypeScriptCompatible ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300")}>
                                        {msg.codeQuality.isTypeScriptCompatible ? "✓" : "○"} TypeScript
                                      </div>
                                      <div className={cn("flex items-center gap-1", msg.codeQuality.hasProperErrorHandling ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300")}>
                                        {msg.codeQuality.hasProperErrorHandling ? "✓" : "○"} Error Handling
                                      </div>
                                      <div className={cn("flex items-center gap-1", msg.codeQuality.isWellDocumented ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300")}>
                                        {msg.codeQuality.isWellDocumented ? "✓" : "○"} Documented
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Smart Code Placement Suggestions */}
                      {msg.type === 'smartCodePlacement' && msg.smartPlacementData && (
                        <div className="space-y-3 mt-3">
                          <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                  Smart Code Placement
                                </span>
                                <span className="text-xs text-blue-600 dark:text-blue-400 capitalize">
                                  ({msg.smartPlacementData.codeType})
                                </span>
                              </div>
                              
                              {msg.smartPlacementData.analysis.topSuggestion && (
                                <div className="mb-3 p-2 bg-blue-100/50 dark:bg-blue-900/20 rounded">
                                  <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                    🎯 Best Match: {msg.smartPlacementData.analysis.topSuggestion.fileName}
                                  </div>
                                  <div className="text-xs text-blue-700 dark:text-blue-300">
                                    Confidence: {Math.round(msg.smartPlacementData.analysis.topSuggestion.confidence * 100)}%
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
                                {/* Add to Suggested File Button */}
                                {msg.smartPlacementData.analysis.topSuggestion && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={async () => await handleApplyToEditor(
                                      msg.code!, 
                                      msg.id, 
                                      `${msg.id}-smart-suggested`,
                                      msg.smartPlacementData!.analysis.topSuggestion!.filePath,
                                      'Smart code placement suggestion'
                                    )}
                                    disabled={isLoading || actionAppliedStates[`${msg.id}-smart-suggested`]}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    {actionAppliedStates[`${msg.id}-smart-suggested`] ? (
                                      <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                                    ) : (
                                      <><FilePlus2 className="mr-1.5 h-4 w-4" /> Add to {msg.smartPlacementData.analysis.topSuggestion.fileName}</>
                                    )}
                                  </Button>
                                )}

                                {/* Add to Current File Button (Dynamic) */}
                                {activeFilePath && activeFilePath !== msg.smartPlacementData.analysis.topSuggestion?.filePath && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => await handleApplyToEditor(
                                      msg.code!, 
                                      msg.id, 
                                      `${msg.id}-smart-current`,
                                      activeFilePath,
                                      'Smart code placement to current file'
                                    )}
                                    disabled={isLoading || actionAppliedStates[`${msg.id}-smart-current`]}
                                  >
                                    {actionAppliedStates[`${msg.id}-smart-current`] ? (
                                      <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                                    ) : (
                                      <><Edit className="mr-1.5 h-4 w-4" /> Add to {(() => {
                                        const currentNode = getFileSystemNode(activeFilePath);
                                        return currentNode && !Array.isArray(currentNode) ? currentNode.name : 'Current File';
                                      })()}</>
                                    )}
                                  </Button>
                                )}

                                {/* Create New File Button */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateFileAndInsert(
                                    msg.suggestedFileName || `new-${msg.smartPlacementData!.codeType}.${detectMainLanguage(msg.code!).toLowerCase() === 'typescript' ? 'ts' : 'js'}`,
                                    msg.code!,
                                    msg.id,
                                    `${msg.id}-smart-new`
                                  )}
                                  disabled={isLoading || actionAppliedStates[`${msg.id}-smart-new`]}
                                >
                                  {actionAppliedStates[`${msg.id}-smart-new`] ? (
                                    <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Created</>
                                  ) : (
                                    <><FilePlus2 className="mr-1.5 h-4 w-4" /> Create New File</>
                                  )}
                                </Button>
                              </div>

                              {/* Alternative Suggestions */}
                              {msg.smartPlacementData.suggestedFiles.length > 1 && (
                                <div className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                                    Other Suggestions:
                                  </div>
                                  <div className="space-y-1">
                                    {msg.smartPlacementData.suggestedFiles.slice(1, 3).map((suggestion, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-xs">
                                        <span className="text-blue-600 dark:text-blue-400">
                                          {suggestion.fileName} ({Math.round(suggestion.confidence * 100)}%)
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-xs"
                                          onClick={async () => await handleApplyToEditor(
                                            msg.code!,
                                            msg.id,
                                            `${msg.id}-alt-${idx}`,
                                            suggestion.filePath,
                                            'Alternative smart placement suggestion'
                                          )}
                                          disabled={isLoading || actionAppliedStates[`${msg.id}-alt-${idx}`]}
                                        >
                                          {actionAppliedStates[`${msg.id}-alt-${idx}`] ? 'Applied' : 'Add'}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
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
                                  size="sm"
                                  variant="outline"
                                  className="mt-1"
                                  onClick={async () => await handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath, 'Refactoring suggestion')}
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
                                     onClick={async () => await handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath, 'Refactoring suggestion')}
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

                      {/* File Operation Execution Results */}
                      {msg.type === 'fileOperationExecution' && msg.fileOperationData && (
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <Card className={cn(
                            "border-2",
                            msg.fileOperationData.success 
                              ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                              : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                          )}>
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                {msg.fileOperationData.success ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium capitalize">
                                  {msg.fileOperationData.operation} Operation
                                </span>
                              </div>
                              
                              {msg.fileOperationData.targetPath && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  <strong>Target:</strong> {msg.fileOperationData.targetPath}
                                </div>
                              )}
                              
                              {msg.fileOperationData.newName && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  <strong>New Name:</strong> {msg.fileOperationData.newName}
                                </div>
                              )}
                              
                              {msg.fileOperationData.destinationPath && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  <strong>Destination:</strong> {msg.fileOperationData.destinationPath}
                                </div>
                              )}
                              
                              {msg.fileOperationData.filesFound && msg.fileOperationData.filesFound.length > 0 && (
                                <div className="text-xs">
                                  <strong>Files Found ({msg.fileOperationData.filesFound.length}):</strong>
                                  <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
                                    {msg.fileOperationData.filesFound.slice(0, 10).map((file, idx) => (
                                      <div key={idx} className="text-muted-foreground">• {file}</div>
                                    ))}
                                    {msg.fileOperationData.filesFound.length > 10 && (
                                      <div className="text-muted-foreground">
                                        ... and {msg.fileOperationData.filesFound.length - 10} more files
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Terminal Command Execution Results */}
                      {msg.type === 'terminalCommandExecution' && msg.terminalCommandData && (
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <Card className="bg-slate-50/50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-800">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <TerminalSquare className="h-4 w-4 text-slate-600" />
                                <span className="text-sm font-medium">Terminal Command</span>
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded",
                                  msg.terminalCommandData.status === 'completed' 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                    : msg.terminalCommandData.status === 'failed'
                                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                )}>
                                  {msg.terminalCommandData.status}
                                </span>
                              </div>
                              
                              <div className="text-xs font-mono bg-background/70 p-2 rounded mb-2">
                                $ {msg.terminalCommandData.command}
                              </div>
                              
                              {msg.terminalCommandData.output && (
                                <div className="text-xs">
                                  <strong>Output:</strong>
                                  <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">{msg.terminalCommandData.output}</pre>
                                </div>
                              )}
                              
                              {msg.terminalCommandData.error && (
                                <div className="text-xs text-red-600 dark:text-red-400">
                                  <strong>Error:</strong>
                                  <pre className="mt-1 whitespace-pre-wrap">{msg.terminalCommandData.error}</pre>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* AI-Powered Filename Suggestions */}
                      {msg.type === 'filenameSuggestion' && msg.filenameSuggestionData && (
                        <div className="space-y-3">
                          <div className="whitespace-pre-wrap font-medium text-sm mb-2">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          <Card className="bg-purple-50/50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="h-4 w-4 text-purple-600" />
                                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                  AI Filename Analysis
                                </span>
                                <span className="text-xs text-purple-600 dark:text-purple-400">
                                  {msg.filenameSuggestionData.analysis.detectedLanguage} • {msg.filenameSuggestionData.analysis.codeType}
                                </span>
                              </div>
                              {msg.filenameSuggestionData.analysis.mainFunctions.length > 0 && (
                                <div className="mb-3 p-2 bg-purple-100/50 dark:bg-purple-900/20 rounded">
                                  <div className="text-xs font-medium text-purple-800 dark:text-purple-200 mb-1">
                                    📝 Functions Found: {msg.filenameSuggestionData.analysis.mainFunctions.join(', ')}
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">
                                  Suggested Filenames:
                                </div>
                                {msg.filenameSuggestionData.suggestions.slice(0, 3).map((suggestion, idx) => {
                                  const buttonKey = `${msg.id}-rename-${idx}`;
                                  const isApplied = actionAppliedStates[buttonKey];
                                  const anyApplied = Object.keys(actionAppliedStates).some(k => k.startsWith(`${msg.id}-rename-`) && actionAppliedStates[k]);
                                  return (
                                    <div key={idx} className="relative flex items-center justify-between p-2 bg-white/60 dark:bg-slate-800/60 rounded border mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-sm font-medium">{suggestion.filename}</span>
                                          <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded">
                                            {Math.round(suggestion.confidence * 100)}%
                                          </span>
                                          <span className="text-xs text-muted-foreground capitalize">
                                            {suggestion.category}
                                          </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {suggestion.reasoning}
                                        </div>
                                      </div>
                                      <button
                                        className={`absolute bottom-2 right-2 rounded-full p-1 transition-colors ${isApplied ? 'bg-green-100 text-green-600' : 'bg-transparent text-muted-foreground hover:text-primary'} ${anyApplied && !isApplied ? 'opacity-50 pointer-events-none' : ''}`}
                                        title={isApplied ? 'Applied' : 'Apply this name'}
                                        disabled={isLoading || (anyApplied && !isApplied)}
                                        onClick={async () => {
                                          if (msg.filenameSuggestionData?.targetPath) {
                                            setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
                                            try {
                                              const result = await handleFileOperation('rename', {
                                                targetPath: msg.filenameSuggestionData.targetPath,
                                                newName: suggestion.filename
                                              });
                                              if (result?.success) {
                                                toast({
                                                  title: "File Renamed",
                                                  description: `Successfully renamed to "${suggestion.filename}"`,
                                                });
                                                // Keep as applied
                                              } else {
                                                toast({
                                                  title: "Rename Failed",
                                                  description: result?.message || 'Rename operation failed.',
                                                  variant: 'destructive',
                                                });
                                                setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false }));
                                              }
                                            } catch (error) {
                                              toast({
                                                title: "Rename Error",
                                                description: "An unexpected error occurred during rename.",
                                                variant: 'destructive',
                                              });
                                              setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false }));
                                            }
                                          }
                                        }}
                                      >
                                        {isApplied ? <Check className="h-5 w-5 text-green-600" /> : <Check className="h-5 w-5" />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-3 pt-2 border-t border-purple-200 dark:border-purple-800">
                                <div className="text-xs text-purple-600 dark:text-purple-400">
                                  💡 Current: {msg.filenameSuggestionData.currentFileName} → Suggested: {msg.filenameSuggestionData.topSuggestion?.filename}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
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

      <div className="p-4 border-t border-sidebar-border mt-auto space-y-2"> {/* Container */}
        <div className="w-full max-w-xl mx-auto"> {/* Centered container with max width */}
          {/* Row 1: Attachments Section */}
          {attachedFiles.length > 0 && (
            <div className="w-full pb-0.5 pr-11 mb-2"> {/* Full width container for attachments */}
              <div className="grid grid-cols-2 gap-2">
                {attachedFiles.map(file => (
                  <div key={file.path} className="flex items-center justify-between text-xs bg-muted px-1 py-0.5 rounded-md">
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate" title={file.path}>{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                      onClick={() => handleRemoveAttachedFile(file.path)}
                      title="Remove attachment"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Input Area */}
          <div className="flex items-end gap-2.5 w-full"> {/* Text area and button stack side by side */}
            <Textarea
              ref={textareaRef}
              placeholder="Chat with AI Assistant..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 min-h-[80px] bg-input resize-none rounded-lg border-none focus:border-[1px] focus:border-primary pl-2 pr-2 py-2 themed-scrollbar text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
            />
            {/* Button Stack */}
            <div className="flex flex-col items-center gap-1 justify-end">
              <Popover open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          title="Attach file for context"
                      >
                          <Paperclip className="h-3 w-3 shrink-0" />
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
                size="sm"
                className={cn(
                    "h-8 min-h-0 px-2 py-1 rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center",
                    (isLoading || (!prompt.trim() && attachedFiles.length === 0)) && "opacity-60"
                )}
                disabled={isLoading || (!prompt.trim() && attachedFiles.length === 0)}
                onClick={handleSendMessage}
                title="Send message"
                style={{ alignSelf: 'flex-end' }}
              >
                {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Send className="h-8 w-8" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

