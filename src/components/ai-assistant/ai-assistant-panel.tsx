
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain, Send, Loader2, User, BotIcon, MessageSquarePlus, Paperclip, XCircle, Pin, AlertTriangle, Cpu, FolderOpen, FileText } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer, enhancedGenerateCodeServer, validateCodeServer, analyzeCodeUsageServer, executeActualFileOperationServer, executeActualTerminalCommandServer, smartCodePlacementServer, suggestFilenameServer, intelligentCodeMergerServer, smartFolderOperationsServer } from '@/app/(ide)/actions';
import { generateSimplifiedFileSystemTree, analyzeFileSystemStructure } from '@/ai/tools/file-system-tree-generator';
import type { FileSystemNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { TooltipProvider } from "@/components/ui/tooltip";

import { HintCard } from './hint-card';
import { ChatMessageItem } from './chat-message-item';
import type { AttachedFileUIData, UndoOperation, ConfirmationDialogData, ChatMessage, FilenameSuggestionDataForPanel } from './types';
import { generateId, isFullFileReplacement } from './ai-assistant-utils';


interface AiAssistantPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

const MAX_ATTACHED_FILES = 4;
const MAX_UNDO_OPERATIONS = 10;


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
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogData>({
    isOpen: false,
    title: '',
    message: '',
    operation: () => {},
    isDangerous: false
  });
  const { toast } = useToast();

  const [attachedFiles, setAttachedFiles] = useState<AttachedFileUIData[]>([]);
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);

  const [expandedCodePreviews, setExpandedCodePreviews] = useState<Record<string, boolean>>({});
  const [forceReplaceState, setForceReplaceState] = useState<Record<string, boolean>>({});


  const currentCode = activeFilePath ? openedFiles.get(activeFilePath)?.content : undefined;
  const currentFileNode = activeFilePath ? getFileSystemNode(activeFilePath) : undefined;
  const currentFileName = (currentFileNode && !Array.isArray(currentFileNode)) ? currentFileNode.name : undefined;
  const currentItemType = (currentFileNode && !Array.isArray(currentFileNode)) ? currentFileNode.type : 'file';


  const addToUndoStack = (operation: UndoOperation) => {
    setUndoStack(prev => {
      const newStack = [operation, ...prev];
      return newStack.slice(0, MAX_UNDO_OPERATIONS);
    });
  };

  const executeUndo = async (operation: UndoOperation) => {
    try {
      let undoSuccess = false;
      let feedbackMessage = "";

      switch (operation.type) {
        case 'delete':
          const parentPath = operation.data.parentPath || '/';
          const parentNode = parentPath === '/' ? null : getFileSystemNode(parentPath);
          const parentId = parentNode && !Array.isArray(parentNode) ? parentNode.id : null;
          
          const restoredNode = addNode(parentId, operation.data.name, operation.data.type, parentPath);
          if (restoredNode && operation.data.content && operation.data.type === 'file') {
            updateFileContent(restoredNode.path, operation.data.content);
          }
          if(restoredNode) {
            undoSuccess = true;
            feedbackMessage = `✅ Undo successful: Restored ${operation.data.name}.`;
            toast({
              title: "Undo Successful",
              description: `Restored ${operation.data.name}`,
            });
          } else {
            feedbackMessage = `❌ Undo failed: Could not restore ${operation.data.name}.`;
            toast({ title: "Undo Failed", description: `Could not restore ${operation.data.name}.`, variant: "destructive"});
          }
          break;
          
        case 'rename':
          const nodeToRenameBack = getFileSystemNode(operation.data.newPath);
          if (nodeToRenameBack && !Array.isArray(nodeToRenameBack)) {
            renameNode(nodeToRenameBack.id, operation.data.originalName);
            undoSuccess = true;
            feedbackMessage = `✅ Undo successful: Restored name to '${operation.data.originalName}'.`;
            toast({
              title: "Undo Successful", 
              description: `Renamed back to ${operation.data.originalName}`,
            });
          } else {
            feedbackMessage = `❌ Undo failed: Could not find item at ${operation.data.newPath} to rename back.`;
            toast({ title: "Undo Failed", description: `Could not find item at ${operation.data.newPath} to rename back. Please check console for details.`, variant: "destructive"});
            console.warn("Undo rename: node not found at newPath", operation.data.newPath);
          }
          break;
          
        case 'move':
          const nodeToMoveBack = getFileSystemNode(operation.data.newPath);
          const originalParent = getFileSystemNode(operation.data.originalParentPath);
          if (nodeToMoveBack && !Array.isArray(nodeToMoveBack) && originalParent && !Array.isArray(originalParent)) {
            moveNode(nodeToMoveBack.id, originalParent.id);
            undoSuccess = true;
            feedbackMessage = `✅ Undo successful: Moved ${operation.data.name} back to its original location.`;
            toast({
              title: "Undo Successful",
              description: `Moved back to original location`,
            });
          } else {
            feedbackMessage = `❌ Undo failed: Could not move ${operation.data.name} back. Source or original parent not found.`;
            toast({ title: "Undo Failed", description: `Could not move back. Source or original parent not found.`, variant: "destructive"});
          }
          break;
          
        case 'create':
          const nodeToDelete = getFileSystemNode(operation.data.path);
          if (nodeToDelete && !Array.isArray(nodeToDelete)) {
            deleteNode(nodeToDelete.id);
            undoSuccess = true;
            feedbackMessage = `✅ Undo successful: Removed created ${operation.data.name}.`;
            toast({
              title: "Undo Successful",
              description: `Removed created ${operation.data.name}`,
            });
          } else {
            feedbackMessage = `❌ Undo failed: Could not find created item ${operation.data.name} to remove.`;
            toast({ title: "Undo Failed", description: `Could not find created item ${operation.data.name} to remove.`, variant: "destructive"});
          }
          break;
      }

      if (feedbackMessage) {
        setChatHistory(prevHistory => [
          ...prevHistory,
          {
            id: generateId(),
            role: 'assistant',
            type: 'text',
            content: feedbackMessage
          }
        ]);
      }

    } catch (error) {
      toast({
        title: "Undo Failed",
        description: "Could not undo. Please check console for details.",
        variant: "destructive"
      });
      console.error("AI Assistant: Undo operation failed.", error);
       setChatHistory(prevHistory => [
          ...prevHistory,
          {
            id: generateId(),
            role: 'assistant',
            type: 'error',
            content: `❌ Undo operation encountered an error. Please check console for details.`
          }
        ]);
    }
  };

  const showConfirmationDialog = (title: string, message: string, operation: () => void, isDangerous: boolean = false) => {
    setConfirmationDialog({
      isOpen: true,
      title,
      message,
      operation,
      isDangerous
    });
  };

  const closeConfirmationDialog = () => {
    setConfirmationDialog({
      isOpen: false,
      title: '',
      message: '',
      operation: () => {},
      isDangerous: false
    });
  };

  const findNodeByPath = (targetPath: string): FileSystemNode | null => {
    const cleanPath = targetPath.trim().replace(/\/+/g, '/');
    let node = getFileSystemNode(cleanPath);
    
    if (node && !Array.isArray(node)) {
      return node;
    }
    
    const variations = [
      cleanPath.startsWith('/') ? cleanPath.slice(1) : '/' + cleanPath,
      cleanPath.replace(/^\//, ''),
      '/' + cleanPath.replace(/^\//, ''),
    ];
    
    for (const variation of variations) {
      node = getFileSystemNode(variation);
      if (node && !Array.isArray(node)) {
        return node;
      }
    }
    
    const allFiles = flattenFileSystemForSearch(fileSystem);
    const fileName = cleanPath.split('/').pop();
    
    const foundFile = allFiles.find(f => {
      return fileName && (f.label === fileName || 
                   f.value.endsWith('/' + fileName) ||
                   f.value === fileName ||
                   f.label.includes(fileName));
    });
    
    if (foundFile) {
      node = getFileSystemNode(foundFile.value);
      if (node && !Array.isArray(node)) {
        return node;
      }
    }
    
    return null;
  };

  const flattenFileSystemForSearch = useCallback((nodes: FileSystemNode[], basePath: string = ''): { label: string, value: string, path: string, type: 'file' | 'folder' }[] => {
    let list: { label: string, value: string, path: string, type: 'file' | 'folder' }[] = [];
    nodes.forEach(node => {
      const displayPath = (basePath ? `${basePath}/` : '') + node.name;
      list.push({ label: displayPath, value: node.path, path: node.path, type: node.type });
      if (node.type === 'folder' && node.children) {
        list = list.concat(flattenFileSystemForSearch(node.children, displayPath));
      }
    });
    return list;
  }, []);

  const allFilesForSelector = useMemo(() => flattenFileSystemForSearch(fileSystem).sort((a,b) => a.label.localeCompare(b.label)), [fileSystem, flattenFileSystemForSearch]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const handleApplyToEditor = async (codeToApply: string, messageId: string, buttonKey: string, targetPath?: string, insertionContext?: string, forceReplace = false) => {
    const path = targetPath || activeFilePath;

    if (path) {
      const targetNode = getFileSystemNode(path);
      if (targetNode && !Array.isArray(targetNode)) {
        setLoadingStates(prev => ({ ...prev, [buttonKey]: true }));
        const existingContent = openedFiles.get(path)?.content || targetNode.content || '';
        const fileName = targetNode.name;
        const fileExtension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
        try {
          if (forceReplace || isFullFileReplacement(codeToApply)) {
            updateFileContent(path, codeToApply);
            toast({ title: 'Code Applied', description: `Full content replaced in ${fileName}.` });
            setLoadingStates(prev => ({ ...prev, [buttonKey]: false }));
            setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
            setForceReplaceState(prev => ({ ...prev, [buttonKey]: false }));
            return;
          }

          const mergerResult = await intelligentCodeMergerServer({
            existingContent,
            generatedContent: codeToApply,
            fileName,
            fileExtension,
            userInstruction: insertionContext || 'Generated code insertion',
            insertionContext: insertionContext || 'AI assistant code application',
          });
          // Check if the merger actually did something meaningful or if it looks like a full replace.
          // This is a heuristic.
          if (!mergerResult.mergedContent.includes(codeToApply.trim().slice(0, 20))) {
             setForceReplaceState(prev => ({ ...prev, [buttonKey]: true }));
          } else {
             setForceReplaceState(prev => ({ ...prev, [buttonKey]: false }));
          }

          updateFileContent(path, mergerResult.mergedContent);
          toast({ title: 'Code Merged', description: mergerResult.summary });
          setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
        } catch (error: any) {
          console.error("AI Assistant: Error applying/merging code.", error);
          // Fallback to simple replacement if merge fails
          updateFileContent(path, codeToApply); 
          toast({ title: 'Code Applied (Fallback)', description: `Changes applied to ${fileName}. Merge error, please check console for details.` });
          setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
          setForceReplaceState(prev => ({ ...prev, [buttonKey]: false })); // Reset force on fallback
        }
        setLoadingStates(prev => ({ ...prev, [buttonKey]: false }));
      }
    } else {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Please open or select a file.' });
      console.error("AI Assistant: No active file for handleApplyToEditor.");
      setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false })); // Ensure button is not stuck in applied state
    }
  };


  const handleCreateFileAndInsert = async (suggestedFileName: string, code: string, messageId: string, buttonKey: string) => {
    setLoadingStates(prev => ({ ...prev, [buttonKey]: true }));

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
            parentIdForNewNode = null; // Adding to root if parent dir is somehow not a folder or not found
            baseDirForNewNode = "/";
        }

    } else if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'folder') {
        parentIdForNewNode = parentDirNode.id;
        baseDirForNewNode = parentDirNode.path;
    }
    // If no activeFilePath, parentIdForNewNode remains null, baseDirForNewNode remains "/" -> add to root.

    const newNode = addNode(parentIdForNewNode, suggestedFileName, 'file', baseDirForNewNode);

    if (newNode) {
      openFile(newNode.path, newNode);
      updateFileContent(newNode.path, code);
      toast({ title: "File Created", description: `"${newNode.name}" created with generated code.`});
      setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
    } else {
      toast({ variant: "destructive", title: "File Creation Failed", description: `Could not create "${suggestedFileName}". Please check console for details.`});
      console.error(`AI Assistant: Failed to create file ${suggestedFileName}`);
    }
    setLoadingStates(prev => ({ ...prev, [buttonKey]: false }));
  };


  const handleCopyCode = (codeToCopy: string, messageIdPlusAction: string) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [messageIdPlusAction]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [messageIdPlusAction]: false }));
      }, 2000);
    }).catch(err => {
      console.error("AI Assistant: Clipboard copy failed", err);
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy code. Please check console for details." });
    });
  };

  const handleNewChat = () => {
    setChatHistory([]);
    setPrompt("");
    setAttachedFiles([]);
    setActionAppliedStates({});
    setLoadingStates({});
    setExpandedCodePreviews({});
    setForceReplaceState({});
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
      const targetItemType = firstAttachedFile ? firstAttachedFile.type : (activeFilePath ? currentItemType : 'file');

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
        let fileToDelete = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
        
        if (!fileToDelete) {
            const potentialTargetName = currentPromptValue.split(" ").pop(); 
            if (potentialTargetName) {
                const foundNode = findNodeByPath(potentialTargetName) || findNodeByPath(`/${potentialTargetName}`);
                if (foundNode) fileToDelete = foundNode.path;
            }
        }
        
        if (fileToDelete) {
          const nodeToDelete = getFileSystemNode(fileToDelete);
          if (!nodeToDelete || Array.isArray(nodeToDelete)) {
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'error',
              content: `❌ File or folder "${fileToDelete}" not found.`
            };
          } else {
            const result = await handleFileOperation('delete', { targetPath: fileToDelete });
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'fileOperationExecution',
              content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Delete operation failed. Please check console for details.'}`,
              fileOperationData: {
                operation: 'delete',
                success: result?.success || false,
                targetPath: fileToDelete,
                message: result?.message || 'Operation completed.',
                requiresConfirmation: false, // Confirmation handled by handleFileOperation itself
              }
            };
            if (result?.success) {
              setAttachedFiles(prev => prev.filter(f => f.path !== fileToDelete));
            }
          }
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify which file or folder to delete, or attach it." };
        }
      } else if (lowerCasePrompt.includes("rename")) {
        const itemToRename = firstAttachedFile ? firstAttachedFile.path : activeFilePath;
        const newNameMatch = currentPromptValue.match(/rename.*?(?:to|as)\s+([^\s."']+)/i); 
        let newName = newNameMatch ? newNameMatch[1] : null;
        
        if (itemToRename) {
          const nodeToRename = getFileSystemNode(itemToRename);
          const currentItemTypeForSuggestion = nodeToRename && !Array.isArray(nodeToRename) ? nodeToRename.type : 'file';

          if (newName) { 
            const result = await handleFileOperation('rename', { targetPath: itemToRename, newName });
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'fileOperationExecution',
              content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Rename operation failed. Please check console for details.'}`,
              fileOperationData: {
                operation: 'rename',
                success: result?.success || false,
                targetPath: itemToRename,
                newName,
                newPath: result?.success ? itemToRename.replace(/\/([^\/]+)$/, `/${newName}`) : undefined, // Approximate new path
                message: result?.message || 'Operation completed.',
                requiresConfirmation: false,
              }
            };
          } else { 
            try {
              const itemNode = getFileSystemNode(itemToRename);
              const itemContent = itemNode && !Array.isArray(itemNode) && itemNode.type === 'file' ? (itemNode.content || '') : `This is a ${currentItemTypeForSuggestion}. User wants to rename it based on context: ${currentPromptValue}`;
              const currentItemNameForSuggestion = itemNode && !Array.isArray(itemNode) ? itemNode.name : '';
              const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
              
              const suggestionResult = await suggestFilenameServer({
                fileContent: itemContent, 
                currentFileName: currentItemNameForSuggestion,
                fileType: currentItemTypeForSuggestion, 
                context: currentPromptValue,
                projectStructure: fileSystemTree,
              });

              if (suggestionResult.success && suggestionResult.topSuggestion) {
                aiResponse = {
                  id: generateId(),
                  role: 'assistant',
                  type: 'filenameSuggestion',
                  content: `🤖 **AI Analysis Complete!** I've analyzed the ${currentItemTypeForSuggestion} "${currentItemNameForSuggestion}".`,
                  targetPath: itemToRename,
                  filenameSuggestionData: {
                    ...suggestionResult,
                    suggestions: suggestionResult.suggestions.slice(0, 3),
                    currentFileName: currentItemNameForSuggestion,
                    targetPath: itemToRename,
                    itemType: currentItemTypeForSuggestion,
                  } as FilenameSuggestionDataForPanel
                };
              } else {
                aiResponse = { 
                  id: generateId(), 
                  role: 'assistant', 
                  type: 'error', 
                  content: "Failed to generate name suggestions. Please specify the new name manually." 
                };
              }
            } catch (error: any) {
              console.error('AI Assistant: Filename suggestion error:', error);
              aiResponse = { 
                id: generateId(), 
                role: 'assistant', 
                type: 'error', 
                content: "Error generating name suggestions. Please specify the new name manually. Check console for details." 
              };
            }
          }
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify which item to rename or attach it." };
        }
      } else if (lowerCasePrompt.includes("move") && (lowerCasePrompt.includes("to") || lowerCasePrompt.includes("into"))) {
        const fileToMove = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
        const destinationMatch = currentPromptValue.match(/move.*?(?:to|into)\s+([^\s]+)/i);
        const destinationHint = destinationMatch ? destinationMatch[1] : null;
        
        if (fileToMove) {
          try {
            const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
            const smartResult = await smartFolderOperationsServer({
              operation: 'move',
              targetPath: fileToMove,
              userInstruction: currentPromptValue,
              destinationHint: destinationHint || undefined,
              fileSystemTree,
            });

            if (smartResult.success) {
              if (smartResult.canExecuteDirectly && smartResult.topSuggestion) {
                const result = await handleFileOperation('move', { 
                  targetPath: fileToMove, 
                  destinationPath: smartResult.topSuggestion.folderPath 
                });
                
                aiResponse = {
                  id: generateId(),
                  role: 'assistant',
                  type: 'fileOperationExecution',
                  content: result?.success 
                    ? `✅ Successfully moved to ${smartResult.topSuggestion.folderName}! ${smartResult.reasoning}`
                    : `❌ ${result?.message || 'Move operation failed. Please check console for details.'}`,
                  fileOperationData: {
                    operation: 'move',
                    success: result?.success || false,
                    targetPath: fileToMove,
                    destinationPath: smartResult.topSuggestion.folderPath,
                    message: result?.message || 'Operation completed.',
                    requiresConfirmation: false,
                  }
                };
              } else {
                aiResponse = {
                  id: generateId(),
                  role: 'assistant',
                  type: 'smartFolderOperation',
                  content: smartResult.needsUserConfirmation && smartResult.confirmationPrompt 
                    ? smartResult.confirmationPrompt
                    : `I found ${smartResult.suggestions.length} potential destinations. Please choose one:`,
                  smartFolderOperationData: {
                    ...smartResult,
                    targetPath: fileToMove,
                  },
                };
              }
            } else {
              throw new Error('Smart folder operation failed');
            }
          } catch (error: any) {
            console.error('AI Assistant: Smart move operation failed:', error);
            if (destinationHint) {
              const result = await handleFileOperation('move', { targetPath: fileToMove, destinationPath: destinationHint });
              aiResponse = {
                id: generateId(),
                role: 'assistant',
                type: 'fileOperationExecution',
                content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Move operation failed. Please check console for details.'}`,
                fileOperationData: {
                  operation: 'move',
                  success: result?.success || false,
                  targetPath: fileToMove,
                  destinationPath: destinationHint,
                  message: result?.message || 'Operation completed.',
                  requiresConfirmation: false,
                }
              };
            } else {
              aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Could not determine destination. Please be more specific." };
            }
          }
        } else {
          aiResponse = { id: generateId(), role: 'assistant', type: 'error', content: "Please specify the file to move or attach a file." };
        }
      } else if (lowerCasePrompt.includes("list") && (lowerCasePrompt.includes("files") || lowerCasePrompt.includes("untitled"))) {
        const files = flattenFileSystemForSearch(fileSystem);
        const untitledFiles = files.filter(f => f.label.toLowerCase().includes('untitled'));
        const filesList = lowerCasePrompt.includes("untitled") ? untitledFiles : files;
        
        aiResponse = {
          id: generateId(),
          role: 'assistant',
          type: 'fileOperationExecution',
          content: `Found ${filesList.length} ${lowerCasePrompt.includes("untitled") ? 'untitled ' : ''}items:\n\n${filesList.map(f => `• ${f.label}`).join('\n')}`,
          fileOperationData: {
            operation: 'list',
            success: true,
            filesFound: filesList.map(f => f.label),
            message: `Found ${filesList.length} items.`,
            requiresConfirmation: false,
          }
        };
      } else {
        const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
        const projectAnalysis = analyzeFileSystemStructure(fileSystem);
        
        const historyForContext = currentChatHistory.slice(0, -1); // Exclude the current user message being processed
        const chatHistoryForAI = historyForContext.slice(-6).map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content), // Ensure content is string
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

          const smartPlacement = await analyzeCodeForSmartPlacement(result.code, currentPromptValue);

          if (result.isNewFile && result.suggestedFileName) {
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'smartCodePlacement', // Use smart placement for new files too
              content: `${result.explanation || 'I\'ve generated code for a new file.'} Based on your codebase analysis, I found ${smartPlacement.analysis.totalRelevantFiles} relevant files where this code could be added.`,
              code: result.code,
              suggestedFileName: result.suggestedFileName,
              explanation: result.explanation,
              fileOperationSuggestion: result.fileOperationSuggestion ? {
                ...result.fileOperationSuggestion,
                targetPath: result.fileOperationSuggestion.targetPath || undefined,
                newName: result.fileOperationSuggestion.newName || undefined,
                fileType: result.fileOperationSuggestion.fileType as 'file' | 'folder' | undefined,
              } : undefined,
              alternativeOptions: result.alternativeOptions?.map(option => ({
                ...option,
                targetPath: option.targetPath || undefined,
                suggestedFileName: option.suggestedFileName || undefined,
              })),
              codeQuality: result.codeQuality,
              smartPlacementData: {
                suggestedFiles: smartPlacement.suggestions,
                currentActiveFile: activeFilePath || undefined,
                codeToAdd: result.code,
                codeType: smartPlacement.codeType,
                analysis: smartPlacement.analysis,
              },
            };
          } else { // Code for existing file or general snippet
            const defaultTargetPath = currentAttachedFiles.length > 0 ? currentAttachedFiles[0].path : activeFilePath;
            const hasGoodSuggestions = smartPlacement.suggestions.length > 0 && smartPlacement.suggestions[0].confidence > 0.6;
            
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: hasGoodSuggestions ? 'smartCodePlacement' : 'enhancedCodeGeneration',
              content: hasGoodSuggestions 
                ? `${result.explanation || "Here's the generated code:"} I found ${smartPlacement.analysis.totalRelevantFiles} relevant files. The best match is ${smartPlacement.analysis.topSuggestion?.fileName} (${Math.round((smartPlacement.analysis.topSuggestion?.confidence || 0) * 100)}% confidence).`
                : result.explanation || "Here's the generated code:",
              code: result.code,
              targetPath: result.targetPath || defaultTargetPath || undefined,
              explanation: result.explanation,
              fileOperationSuggestion: result.fileOperationSuggestion ? {
                ...result.fileOperationSuggestion,
                targetPath: result.fileOperationSuggestion.targetPath || undefined,
                newName: result.fileOperationSuggestion.newName || undefined,
                fileType: result.fileOperationSuggestion.fileType as 'file' | 'folder' | undefined,
              } : undefined,
              alternativeOptions: result.alternativeOptions?.map(option => ({
                ...option,
                targetPath: option.targetPath || undefined,
                suggestedFileName: option.suggestedFileName || undefined,
              })),
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
        } catch (enhancedError: any) {
          console.error('AI Assistant: Enhanced code generation error. Falling back. Error:', enhancedError);
          
          let effectivePrompt = currentPromptValue;
          if (historyForContext.length > 0) {
            const lastMessages = historyForContext
              .slice(-3) // Take last 3 messages for context
              .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`)
              .join('\n\n');
            effectivePrompt = `${lastMessages}\n\nUser: ${currentPromptValue}`;
          }

          // Fallback to simpler generateCode if enhanced fails
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

    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      console.error("AI Assistant Error:", error);
      setChatHistory(prev => prev.filter(msg => msg.id !== loadingMessageId).concat({
        id: generateId(),
        role: 'assistant',
        type: 'error',
        content: `Sorry, an issue occurred. Please check the console for details. (Error: ${errorMessage.substring(0,100)})`
      }));
    }
    setIsLoading(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (filePath: string, itemType: 'file' | 'folder') => {
    if (attachedFiles.length >= MAX_ATTACHED_FILES) {
      toast({ variant: "destructive", title: "Attachment Limit Reached", description: `You can attach a maximum of ${MAX_ATTACHED_FILES} items.` });
      setFileSelectorOpen(false);
      return;
    }
    if (attachedFiles.some(f => f.path === filePath)) {
      toast({ variant: "default", title: "Already Attached", description: "This item is already attached." });
      setFileSelectorOpen(false);
      return;
    }

    const fileNode = getFileSystemNode(filePath);
    if (fileNode && !Array.isArray(fileNode)) {
      let attachedFile: AttachedFileUIData;
      
      if (itemType === 'folder') {
        const folderContent = generateFolderContext(fileNode); // Use helper
        attachedFile = {
          path: filePath,
          name: fileNode.name,
          content: folderContent,
          type: 'folder'
        };
        toast({ title: "Folder Attached", description: `Context from "${fileNode.name}" folder is now attached.` });
      } else {
        const openedFile = openedFiles.get(filePath);
        const contentToAttach = openedFile ? openedFile.content : fileNode.content;
        attachedFile = {
          path: filePath,
          name: fileNode.name,
          content: contentToAttach || '',
          type: 'file'
        };
        toast({ title: "File Attached", description: `Context from "${fileNode.name}" is now attached.` });
      }
      
      setAttachedFiles(prev => [...prev, attachedFile]);
    }
    setFileSelectorOpen(false);
    textareaRef.current?.focus();
  };

  const handleRemoveAttachedFile = (filePathToRemove: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== filePathToRemove));
  };

  const handleFileOperation = async (operation: 'create' | 'delete' | 'rename' | 'move' | 'list', operationData: any) => {
    if (operation === 'delete') {
      const targetNode = findNodeByPath(operationData.targetPath);
      const itemType = targetNode && !Array.isArray(targetNode) && targetNode.type === 'folder' ? 'folder' : 'file';
      const itemName = targetNode ? targetNode.name : operationData.targetPath.split('/').pop();
      
      showConfirmationDialog(
        `Delete ${itemType}`,
        `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        () => performFileOperation(operation, operationData),
        true
      );
      return { success: false, message: 'Waiting for user confirmation' }; // Return undefined or specific object
    }
    
    return performFileOperation(operation, operationData);
  };

  const performFileOperation = async (operation: 'create' | 'delete' | 'rename' | 'move' | 'list', operationData: any) => {
    try {
      let success = false;
      let message = '';
      let undoOperation: UndoOperation | null = null;

      switch (operation) {
        case 'delete':
          if (operationData.targetPath) {
            const nodeToDelete = findNodeByPath(operationData.targetPath);
            if (nodeToDelete) {
              undoOperation = {
                type: 'delete',
                data: {
                  name: nodeToDelete.name,
                  type: nodeToDelete.type,
                  content: nodeToDelete.type === 'file' ? (openedFiles.get(nodeToDelete.path)?.content || nodeToDelete.content || '') : '',
                  parentPath: nodeToDelete.path.substring(0, nodeToDelete.path.lastIndexOf('/')) || '/',
                  originalPath: nodeToDelete.path
                },
                timestamp: Date.now(),
                description: `Deleted ${nodeToDelete.name}`
              };
              if (openedFiles.has(nodeToDelete.path)) {
                closeFile(nodeToDelete.path);
                await new Promise(resolve => setTimeout(resolve, 100)); // Ensure closeFile processes
              }
              success = deleteNode(nodeToDelete.id);
              message = success ? `Successfully deleted ${nodeToDelete.name}.` : `Failed to delete ${nodeToDelete.name}. Please check console for details.`;
              if (success) {
                setAttachedFiles(prev => prev.filter(f => f.path !== nodeToDelete.path));
                if (undoOperation) addToUndoStack(undoOperation);
              } else { console.error(`AI Assistant: Delete operation for "${nodeToDelete.name}" failed.`, {operationData, nodeToDelete}); }
            } else {
              message = `Item not found: ${operationData.targetPath}`;
            }
          } else { message = "Target path is required for delete."; }
          break;

        case 'rename':
          if (operationData.targetPath && operationData.newName) {
            const nodeToRename = findNodeByPath(operationData.targetPath);
            if (nodeToRename) {
              const originalName = nodeToRename.name;
              const newPath = nodeToRename.path.replace(originalName, operationData.newName);
              undoOperation = {
                type: 'rename',
                data: { originalName, newName: operationData.newName, originalPath: nodeToRename.path, newPath },
                timestamp: Date.now(),
                description: `Renamed ${originalName} to ${operationData.newName}`
              };
              success = renameNode(nodeToRename.id, operationData.newName);
              message = success ? `Successfully renamed to ${operationData.newName}.` : `Failed to rename. Name might be invalid or already exist. Please check console for details.`;
              if (success) addToUndoStack(undoOperation); else { console.error(`AI Assistant: Rename for "${originalName}" to "${operationData.newName}" failed.`, {operationData, nodeToRename});}
            } else {
              message = `Item not found: ${operationData.targetPath}`;
            }
          } else {
            message = 'Target path and new name are required for rename.';
          }
          break;

        case 'move':
          if (operationData.targetPath && operationData.destinationPath) {
            const nodeToMove = findNodeByPath(operationData.targetPath);
            const destinationNode = findNodeByPath(operationData.destinationPath);
            if (nodeToMove && destinationNode) {
              if (destinationNode.type !== 'folder') {
                message = `Destination "${destinationNode.name}" is not a folder.`;
              } else {
                const originalParentPath = nodeToMove.path.substring(0, nodeToMove.path.lastIndexOf('/')) || '/';
                const newPath = (destinationNode.path === '/' ? '' : destinationNode.path) + '/' + nodeToMove.name;
                undoOperation = {
                  type: 'move',
                  data: { name: nodeToMove.name, originalPath: nodeToMove.path, newPath, originalParentPath, destinationPath: destinationNode.path },
                  timestamp: Date.now(),
                  description: `Moved ${nodeToMove.name} to ${destinationNode.name}`
                };
                try {
                  moveNode(nodeToMove.id, destinationNode.id);
                  success = true;
                  message = `Successfully moved ${nodeToMove.name} to ${destinationNode.name}.`;
                  if(undoOperation) addToUndoStack(undoOperation);
                } catch (error: any) {
                  console.error("AI Assistant: Move operation error.", error);
                  message = `Failed to move. Error: ${error.message || 'Unknown error'}`;
                }
              }
            } else {
              message = `Source or destination not found. Src: ${operationData.targetPath}, Dest: ${operationData.destinationPath}.`;
            }
          } else {
             message = 'Target and destination paths are required for move.';
          }
          break;

        case 'create':
          if (operationData.fileName && operationData.fileType) {
            const parentPath = operationData.parentPath || '/';
            const parentNode = parentPath === '/' ? null : getFileSystemNode(parentPath);
            const parentId = parentNode && !Array.isArray(parentNode) ? parentNode.id : null;
            const newNode = addNode(parentId, operationData.fileName, operationData.fileType, parentPath);
            if (newNode) {
              if (operationData.content && operationData.fileType === 'file') updateFileContent(newNode.path, operationData.content);
              if (operationData.openInIDE && operationData.fileType === 'file') openFile(newNode.path, newNode);
              success = true;
              message = `Successfully created ${operationData.fileType}: ${operationData.fileName}.`;
               undoOperation = {
                type: 'create',
                data: { name: newNode.name, path: newNode.path, type: newNode.type },
                timestamp: Date.now(),
                description: `Created ${newNode.type} ${newNode.name}`
              };
              if (undoOperation) addToUndoStack(undoOperation);
            } else {
              message = `Failed to create. Name invalid or already exists. Please check console for details.`;
            }
          } else {
            message = 'File name and type are required for creation.';
          }
          break;
        case 'list':
          const files = flattenFileSystemForSearch(fileSystem);
          success = true;
          message = `Found ${files.length} items in the project.`;
          break;
      }

      toast({ 
        title: success ? "Operation Successful" : "Action Failed", 
        description: message,
        variant: success ? "default" : "destructive"
      });
      if (!success && operation !== 'list') {
        console.error(`AI Assistant: File operation ${operation} failed. Msg: ${message}`, operationData);
      }

      if (success && operation === 'rename') {
        setAttachedFiles(prev => prev.map(f => {
          if (f.path === operationData.targetPath) {
            const newPath = operationData.targetPath.replace(/[^/]+$/, operationData.newName);
            return { ...f, path: newPath, name: operationData.newName };
          }
          return f;
        }));
      }

      return { success, message };

    } catch (error: any) {
      console.error(`AI Assistant: Error in ${operation} operation.`, error);
      toast({ 
        title: "Operation Error", 
        description: "Unexpected error. Please check console for details.",
        variant: "destructive"
      });
      return { success: false, message: "Operation failed: unexpected error." };
    }
  };

  const handleFileOperationSuggestionAction = async (
    operationType: 'create' | 'rename' | 'delete' | 'move',
    targetPath: string | undefined,
    newName: string | undefined,
    fileType: 'file' | 'folder' | undefined,
    buttonKey: string,
    destinationPath?: string
  ) => {
    setLoadingStates(prev => ({...prev, [buttonKey]: true}));
    try {
      let result;
      if (operationType === 'create' && newName && fileType) {
        result = await performFileOperation('create', { parentPath: targetPath || '/', fileName: newName, fileType, openInIDE: true });
      } else if (operationType === 'rename' && targetPath && newName) {
        result = await performFileOperation('rename', { targetPath, newName });
      } else if (operationType === 'delete' && targetPath) {
        result = await performFileOperation('delete', { targetPath });
      } else if (operationType === 'move' && targetPath && destinationPath) {
        result = await performFileOperation('move', {targetPath, destinationPath});
      }
       else {
        throw new Error("Invalid params for file op suggestion.");
      }

      if (result?.success) {
        setActionAppliedStates(prev => ({...prev, [buttonKey]: true}));
      }
    } catch (error: any) {
      console.error("AI Assistant: Error handling file op suggestion:", error);
      toast({ title: "Action Failed", description: "Could not execute suggested file operation. Please check console for details.", variant: "destructive" });
    }
    setLoadingStates(prev => ({...prev, [buttonKey]: false}));
  };

  const analyzeCodeForSmartPlacement = async (code: string, promptText: string) => {
    try {
      const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
      const openFilesForAnalysis = Array.from(openedFiles.entries()).map(([path, node]) => ({
        path,
        content: node.content || '',
        language: detectFileLanguage(path),
      }));

      const codeType = detectCodeType(code, promptText);
      const codeName = extractCodeName(code, codeType);
      const dependencies = extractDependencies(code);

      const placementResult = await smartCodePlacementServer({
        operation: 'evaluate',
        fileSystemTree,
        openFiles: openFilesForAnalysis,
        query: {
          type: codeType,
          name: codeName,
          description: promptText,
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
    } catch (error: any) {
      console.error('AI Assistant: Smart placement analysis error:', error);
      return {
        success: false,
        suggestions: [],
        codeType: 'general' as const,
        analysis: { totalRelevantFiles: 0 },
      };
    }
  };

  const toggleCodePreview = (msgId: string) => {
    setExpandedCodePreviews(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getFileOrFolderIcon = (itemType: 'file' | 'folder') => {
    if (itemType === 'folder') return <FolderOpen className="inline h-4 w-4 mr-1 text-primary shrink-0" />;
    return <FileText className="inline h-4 w-4 mr-1 text-primary shrink-0" />;
  };
  
  const getDisplayNameForAttachment = (label: string) => {
    const parts = label.split('/');
    return parts[parts.length - 1];
  };


  return (
    <TooltipProvider>
    <div className="w-full border-l border-border bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-headline font-semibold">AI Assistant</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={handleNewChat} title="Start New Chat">
          <MessageSquarePlus className="w-4 h-4" />
          <span className="sr-only">New Chat</span>
        </Button>
      </div>

      {chatHistory.length === 0 && !isLoading ? (
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-3 overflow-y-auto themed-scrollbar">
          <Cpu className="w-12 h-12 text-primary opacity-70 mb-2" />
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
              icon={BotIcon} // Changed from Code2
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
              icon={Pin} // Changed from SearchCode
              title="Find Examples"
              description="Search the codebase for usage examples of functions or components."
              onActivate={() => { setPrompt("Find examples of how the Button component is used."); textareaRef.current?.focus(); }}
            />
          </div>
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-1 themed-scrollbar">
          <div className="p-3 space-y-4">
            {chatHistory.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                isLoading={isLoading}
                activeFilePath={activeFilePath}
                currentCode={currentCode}
                openedFiles={openedFiles}
                fileSystem={fileSystem}
                getFileSystemNode={getFileSystemNode}
                handleCopyCode={handleCopyCode}
                copiedStates={copiedStates}
                handleApplyToEditor={handleApplyToEditor}
                actionAppliedStates={actionAppliedStates}
                loadingStates={loadingStates}
                handleCreateFileAndInsert={handleCreateFileAndInsert}
                handleFileOperationSuggestionAction={handleFileOperationSuggestionAction}
                undoStack={undoStack}
                executeUndo={executeUndo}
                setUndoStack={setUndoStack}
                handleFileOperation={handleFileOperation}
                setChatHistory={setChatHistory}
                toggleCodePreview={toggleCodePreview}
                expandedCodePreviews={expandedCodePreviews}
                forceReplaceState={forceReplaceState}
                setForceReplaceState={setForceReplaceState}
              />
            ))}
             {isLoading && chatHistory.length === 0 && ( // Show loader if loading and history is empty (first message)
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="p-4 border-t border-sidebar-border mt-auto space-y-2">
        <div className="w-full max-w-xl mx-auto">
          {attachedFiles.length > 0 && (
            <div className="w-full pb-0.5 pr-11 mb-2">
              <div className="grid grid-cols-2 gap-2">
                {attachedFiles.map(file => (
                  <div key={file.path} className="flex items-center justify-between text-xs bg-muted px-1 py-0.5 rounded-md">
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate min-w-0"> 
                      <span className="shrink-0">{getFileOrFolderIcon(file.type)}</span>
                      <span className="flex-1 truncate min-w-0" title={file.path}>{getDisplayNameForAttachment(file.name)}</span>
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
        <div className="flex items-end gap-2.5 w-full">
            <Textarea
              ref={textareaRef}
              placeholder="Chat with AI Assistant..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 min-h-[40px] max-h-[160px] bg-input resize-none rounded-lg border-none focus:border-[1px] focus:border-primary pl-2 pr-2 py-2 themed-scrollbar text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={2}
            />
            <div className="flex flex-col items-center gap-1 justify-end self-end">
              <Popover open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          title="Attach file or folder for context"
                      >
                          <Paperclip className="h-4 w-4 shrink-0" />
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 mb-1 themed-scrollbar" side="top" align="end">
                    <Command>
                      <CommandInput placeholder="Search files/folders to attach..." />
                      <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup heading="Workspace Items">
                          <ScrollArea className="h-[200px] themed-scrollbar">
                            {allFilesForSelector.map((item) => (
                              <CommandItem
                                key={item.value}
                                value={item.value}
                                onSelect={() => handleFileSelect(item.path, item.type)}
                                className="text-xs cursor-pointer flex items-center" 
                              >
                                <span className="shrink-0 mr-2">{getFileOrFolderIcon(item.type)}</span>
                                <span className="flex-1 truncate min-w-0">{getDisplayNameForAttachment(item.label)}</span>
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
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {confirmationDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={cn(
            "w-96 max-w-[90vw]",
            confirmationDialog.isDangerous 
              ? "border-red-200 bg-red-50/90 dark:border-red-800 dark:bg-red-950/90"
              : "border-border bg-background"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {confirmationDialog.isDangerous ? (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : (
                  <MessageSquarePlus className="h-5 w-5 text-primary" />
                )}
                <CardTitle className="text-lg">{confirmationDialog.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {confirmationDialog.message}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeConfirmationDialog}
                >
                  Cancel
                </Button>
                <Button
                  variant={confirmationDialog.isDangerous ? "destructive" : "default"}
                  size="sm"
                  onClick={() => {
                    confirmationDialog.operation();
                    closeConfirmationDialog();
                  }}
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
