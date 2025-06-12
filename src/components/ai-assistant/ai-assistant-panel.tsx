
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain, Send, Loader2, User, BotIcon, ClipboardCopy, Check, RefreshCw, FileText, Wand2, SearchCode, MessageSquare, Code2, FilePlus2, Edit, RotateCcw, Paperclip, XCircle, Pin, TerminalSquare, Undo2, AlertTriangle, FolderOpen } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer, enhancedGenerateCodeServer, validateCodeServer, analyzeCodeUsageServer, trackOperationProgressServer, executeActualFileOperationServer, executeActualTerminalCommandServer, smartCodePlacementServer, suggestFilenameServer, smartContentInsertionServer, intelligentCodeMergerServer, smartFolderOperationsServer } from '@/app/(ide)/actions';
import { generateSimplifiedFileSystemTree, analyzeFileSystemStructure } from '@/ai/tools/file-system-tree-generator';
import type { AiSuggestion, ChatMessage, FileSystemNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import ReactMarkdown from 'react-markdown';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";


interface AiAssistantPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

interface AttachedFileUIData {
  path: string;
  name: string;
  content: string;
  type: 'file' | 'folder';
}

interface UndoOperation {
  type: 'delete' | 'rename' | 'move' | 'create';
  data: any;
  timestamp: number;
  description: string;
}

interface ConfirmationDialogData {
  isOpen: boolean;
  title: string;
  message: string;
  operation: () => void;
  isDangerous?: boolean;
}

const MAX_ATTACHED_FILES = 4;
const MAX_UNDO_OPERATIONS = 10;

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
      switch (operation.type) {
        case 'delete':
          const parentPath = operation.data.parentPath || '/';
          const parentNode = parentPath === '/' ? null : getFileSystemNode(parentPath);
          const parentId = parentNode && !Array.isArray(parentNode) ? parentNode.id : null;
          
          const restoredNode = addNode(parentId, operation.data.name, operation.data.type, parentPath);
          if (restoredNode && operation.data.content && operation.data.type === 'file') {
            updateFileContent(restoredNode.path, operation.data.content);
          }
          toast({
            title: "Undo Successful",
            description: `Restored ${operation.data.name}`,
          });
          break;
          
        case 'rename':
          const nodeToRenameBack = getFileSystemNode(operation.data.newPath);
          if (nodeToRenameBack && !Array.isArray(nodeToRenameBack)) {
            renameNode(nodeToRenameBack.id, operation.data.originalName);
            toast({
              title: "Undo Successful", 
              description: `Renamed back to ${operation.data.originalName}`,
            });
          }
          break;
          
        case 'move':
          const nodeToMoveBack = getFileSystemNode(operation.data.newPath);
          const originalParent = getFileSystemNode(operation.data.originalParentPath);
          if (nodeToMoveBack && !Array.isArray(nodeToMoveBack) && originalParent && !Array.isArray(originalParent)) {
            moveNode(nodeToMoveBack.id, originalParent.id);
            toast({
              title: "Undo Successful",
              description: `Moved back to original location`,
            });
          }
          break;
          
        case 'create':
          const nodeToDelete = getFileSystemNode(operation.data.path);
          if (nodeToDelete && !Array.isArray(nodeToDelete)) {
            deleteNode(nodeToDelete.id);
            toast({
              title: "Undo Successful",
              description: `Removed created ${operation.data.name}`,
            });
          }
          break;
      }
    } catch (error) {
      toast({
        title: "Undo Failed",
        description: "Could not undo. Check console.",
        variant: "destructive"
      });
      console.error("AI Assistant: Undo operation failed.", error);
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
    
    const allFiles = flattenFileSystem(fileSystem);
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

  const flattenFileSystem = useCallback((nodes: FileSystemNode[], basePath: string = ''): { label: string, value: string, path: string, type: 'file' | 'folder' }[] => {
    let list: { label: string, value: string, path: string, type: 'file' | 'folder' }[] = [];
    nodes.forEach(node => {
      const displayPath = (basePath ? `${basePath}/` : '') + node.name;
      list.push({ label: displayPath, value: node.path, path: node.path, type: node.type });
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

  const isFullFileReplacement = (code: string) => {
    const trimmed = code.trim();
    return (
      trimmed.startsWith('#') ||
      trimmed.startsWith('"""') ||
      /^def |^class |^import |^from /.test(trimmed)
    );
  };

  const [forceReplaceState, setForceReplaceState] = useState<Record<string, boolean>>({});

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
          const similarity = calculateCodeSimilarity(existingContent.trim(), codeToApply.trim());
          if (similarity >= 0.95) {
            updateFileContent(path, codeToApply);
            toast({ title: 'Code Applied', description: `Content updated in ${fileName} (${Math.round(similarity * 100)}% similarity).` });
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
          updateFileContent(path, codeToApply); 
          toast({ title: 'Code Applied (Fallback)', description: `Changes applied to ${fileName}. Merge error, see console.` });
          setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
          setForceReplaceState(prev => ({ ...prev, [buttonKey]: false }));
        }
        setLoadingStates(prev => ({ ...prev, [buttonKey]: false }));
      }
    } else {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Please open or select a file.' });
      console.error("AI Assistant: No active file for handleApplyToEditor.");
      setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false }));
    }
  };

  const calculateCodeSimilarity = (text1: string, text2: string): number => {
    if (!text1 && !text2) return 1;
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;

    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1;

    const jaroSimilarity = (s1: string, s2: string): number => {
      if (s1 === s2) return 1;
      
      const len1 = s1.length;
      const len2 = s2.length;
      const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
      
      if (matchWindow < 0) return 0;
      
      const s1Matches = new Array(len1).fill(false);
      const s2Matches = new Array(len2).fill(false);
      
      let matches = 0;
      
      for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, len2);
        
        for (let j = start; j < end; j++) {
          if (s2Matches[j] || s1[i] !== s2[j]) continue;
          s1Matches[i] = true;
          s2Matches[j] = true;
          matches++;
          break;
        }
      }
      
      if (matches === 0) return 0;
      
      let transpositions = 0;
      let k = 0;
      for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
      }
      
      const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
      
      let prefix = 0;
      for (let i = 0; i < Math.min(len1, len2, 4); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
      }
      
      return jaro + (0.1 * prefix * (1 - jaro));
    };

    const jaroSim = jaroSimilarity(norm1, norm2);
    const lengthSim = 1 - Math.abs(norm1.length - norm2.length) / Math.max(norm1.length, norm2.length);
    
    return Math.max(jaroSim * 0.8 + lengthSim * 0.2, jaroSim);
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
      toast({ title: "File Created", description: `"${newNode.name}" created with code.`});
      if (!actionAppliedStates[buttonKey]) {
        setButtonAppliedState(buttonKey);
      }
    } else {
      toast({ variant: "destructive", title: "File Creation Failed", description: `Could not create "${suggestedFileName}". Check console for details.`});
      console.error(`AI Assistant: Failed to create file ${suggestedFileName}`);
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
      console.error("AI Assistant: Clipboard copy failed", err);
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy. Check console." });
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
        
        // Attempt to find a file/folder based on prompt keywords if no attachment/active file
        if (!fileToDelete) {
            const potentialTargetName = currentPromptValue.split(" ").pop(); // crude
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
              content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Delete operation failed. Check console.'}`,
              fileOperationData: {
                operation: 'delete',
                success: result?.success || false,
                targetPath: fileToDelete,
                message: result?.message || 'Operation completed.',
                requiresConfirmation: false,
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
        const newNameMatch = currentPromptValue.match(/rename.*?(?:to|as)\s+([^\s]+)/i);
        let newName = newNameMatch ? newNameMatch[1] : null;
        
        if (itemToRename) {
          const nodeToRename = getFileSystemNode(itemToRename);
          const currentItemTypeForSuggestion = nodeToRename && !Array.isArray(nodeToRename) ? nodeToRename.type : 'file';

          if (newName) { // User provided a new name
            const result = await handleFileOperation('rename', { targetPath: itemToRename, newName });
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'fileOperationExecution',
              content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Rename operation failed. Check console.'}`,
              fileOperationData: {
                operation: 'rename',
                success: result?.success || false,
                targetPath: itemToRename,
                newName,
                message: result?.message || 'Operation completed.',
                requiresConfirmation: false,
              }
            };
          } else { // AI needs to suggest a name
            try {
              const itemNode = getFileSystemNode(itemToRename);
              const itemContent = itemNode && !Array.isArray(itemNode) && itemNode.type === 'file' ? (itemNode.content || '') : `This is a ${currentItemTypeForSuggestion}. User wants to rename it based on context: ${currentPromptValue}`;
              const currentItemNameForSuggestion = itemNode && !Array.isArray(itemNode) ? itemNode.name : '';
              const fileSystemTree = generateSimplifiedFileSystemTree(fileSystem, 4);
              
              const suggestionResult = await suggestFilenameServer({
                fileContent: itemContent, // For folders, this might be context or empty
                currentFileName: currentItemNameForSuggestion,
                fileType: currentItemTypeForSuggestion, // Pass file or folder type
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
                  }
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
                content: "Error generating name suggestions. Please specify the new name manually. Check console." 
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
                    : `❌ ${result?.message || 'Move operation failed. Check console.'}`,
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
                content: result?.success ? `✅ ${result.message}` : `❌ ${result?.message || 'Move operation failed. Check console.'}`,
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
        const files = flattenFileSystem(fileSystem);
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

          const smartPlacement = await analyzeCodeForSmartPlacement(result.code, currentPromptValue);

          if (result.isNewFile && result.suggestedFileName) {
            aiResponse = {
              id: generateId(),
              role: 'assistant',
              type: 'smartCodePlacement',
              content: `${result.explanation || 'I\'ve generated code for a new file.'} Based on your codebase analysis, I found ${smartPlacement.analysis.totalRelevantFiles} relevant files where this code could be added.`,
              code: result.code,
              suggestedFileName: result.suggestedFileName,
              explanation: result.explanation,
              fileOperationSuggestion: result.fileOperationSuggestion ? {
                ...result.fileOperationSuggestion,
                targetPath: result.fileOperationSuggestion.targetPath || undefined,
                newName: result.fileOperationSuggestion.newName || undefined,
                fileType: result.fileOperationSuggestion.fileType,
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
          } else {
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
                fileType: result.fileOperationSuggestion.fileType,
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
      toast({ variant: "destructive", title: "Attachment Limit", description: `Max ${MAX_ATTACHED_FILES} items.` });
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
        const folderContent = generateFolderContext(fileNode);
        attachedFile = {
          path: filePath,
          name: fileNode.name + '/',
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

  const countFilesInFolder = (folderNode: FileSystemNode): number => {
    if (!folderNode.children) return 0;
    
    let count = 0;
    const traverse = (nodes: FileSystemNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') {
          count++;
        } else if (node.type === 'folder' && node.children) {
          traverse(node.children);
        }
      });
    };
    
    traverse(node.children);
    return count;
  };

  const generateFolderContext = (folderNode: FileSystemNode): string => {
    if (!folderNode.children) return `Folder: ${folderNode.name}\nPath: ${folderNode.path}\n(Empty folder)`;

    let context = `Folder: ${folderNode.name}\n`;
    context += `Path: ${folderNode.path}\n`;
    context += `Total direct items: ${folderNode.children.length}\n\n`;
    
    context += "Direct Children:\n";
    folderNode.children.slice(0, 10).forEach(child => { // Limit to first 10 direct children for brevity
        context += `- ${child.name} (${child.type})\n`;
    });
    if (folderNode.children.length > 10) {
        context += `- ... and ${folderNode.children.length - 10} more items.\n`
    }
    
    return context;
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
      return { success: false, message: 'Waiting for user confirmation' };
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
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              success = deleteNode(nodeToDelete.id);
              message = success ? `Successfully deleted ${nodeToDelete.name}.` : `Failed to delete ${nodeToDelete.name}. Check console for details.`;
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
              message = success ? `Successfully renamed to ${operationData.newName}.` : `Failed to rename. Name might be invalid or already exist. Check console.`;
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
                  addToUndoStack(undoOperation);
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
              addToUndoStack(undoOperation);
            } else {
              message = `Failed to create. Name invalid or already exists. Check console.`;
            }
          } else {
            message = 'File name and type are required for creation.';
          }
          break;
        case 'list':
          const files = flattenFileSystem(fileSystem);
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
        description: "Unexpected error. Check console.",
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
      toast({ title: "Action Failed", description: "Could not execute suggested file operation. Check console.", variant: "destructive" });
    }
    setLoadingStates(prev => ({...prev, [buttonKey]: false}));
  };

  const handleTerminalCommand = async (command: string, context: string) => {
    try {
      const result = await executeActualTerminalCommandServer({
        command,
        context,
        requiresConfirmation: true,
        isBackground: false,
        confirmed: true, 
      });
      toast({ 
        title: "Terminal Command Sent", 
        description: `Command "${command}" processed. Check terminal.`,
      });
      return result;
    } catch (error: any) {
      console.error('AI Assistant: Terminal command error:', error);
      toast({ 
        title: "Terminal Command Failed", 
        description: "Failed to execute. Check console.",
        variant: "destructive"
      });
      return { success: false, message: "Command execution failed" };
    }
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

  const detectFileLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'TypeScript', 'tsx': 'TypeScript', 'js': 'JavaScript', 'jsx': 'JavaScript',
      'py': 'Python', 'cpp': 'C++', 'java': 'Java', 'html': 'HTML', 'css': 'CSS', 'md': 'Markdown', 'json': 'JSON'
    };
    return languageMap[ext || ''] || 'Unknown';
  };

  const detectCodeType = (code: string, promptText: string): 'function' | 'component' | 'class' | 'interface' | 'utility' | 'service' | 'hook' | 'general' => {
    const lowerCode = code.toLowerCase();
    const lowerPrompt = promptText.toLowerCase();
    if (lowerPrompt.includes('component') || lowerCode.includes('react') || /<\w+.*?>/.test(code) && (lowerCode.includes('jsx') || lowerCode.includes('tsx'))) return 'component';
    if (lowerPrompt.includes('hook') || lowerCode.includes('use') && (lowerCode.includes('function') || lowerCode.includes('=>'))) return 'hook';
    if (lowerPrompt.includes('interface') || lowerCode.includes('interface ')) return 'interface';
    if (lowerPrompt.includes('class') || lowerCode.includes('class ')) return 'class';
    if (lowerPrompt.includes('util') || lowerPrompt.includes('helper')) return 'utility';
    if (lowerPrompt.includes('service') || lowerPrompt.includes('api')) return 'service';
    if (lowerCode.includes('function') || lowerCode.includes('=>') || lowerCode.includes('def ')) return 'function';
    return 'general';
  };

  const extractCodeName = (code: string, codeType: string): string | undefined => {
    const functionMatch = code.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|let\s+(\w+)\s*=|var\s+(\w+)\s*=|def\s+(\w+)|class\s+(\w+))/);
    if (functionMatch) return functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4] || functionMatch[5] || functionMatch[6];
    if (codeType === 'component') {
      const componentNameMatch = code.match(/<(?:[A-Z]\w*)/); 
      if (componentNameMatch) return componentNameMatch[0].substring(1);
    }
    return undefined;
  };

  const extractDependencies = (code: string): string[] => {
    const dependencies: string[] = [];
    const importMatches = code.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) dependencies.push(match[1]);
    if (code.includes('useState') || code.includes('useEffect')) dependencies.push('react');
    if (code.includes('axios')) dependencies.push('axios');
    return Array.from(new Set(dependencies)); 
  };

  const detectMainLanguage = (code: string): string => {
    if (code.includes('import React') || code.includes('.tsx') || code.includes('.jsx')) return 'TypeScript'; 
    if (code.includes('def ') && code.includes(':') || code.includes('import ') && !code.includes('from')) return 'Python';
    if (code.includes('#include') || code.includes('std::')) return 'C++';
    if (code.includes('public class') || code.includes('System.out.println')) return 'Java';
    return 'JavaScript'; 
  };

  const getDynamicCodeQuality = (codeQuality: any, code: string) => {
    const language = detectMainLanguage(code);
    const functionCount = (code.match(/def |function |const .* = |class /g) || []).length;
    const getLanguageSpecific = () => {
      switch (language) {
        case 'Python': return { languageLabel: 'Pythonic', languageCheck: codeQuality.followsBestPractices && codeQuality.isWellDocumented, languageIcon: '🐍' };
        case 'TypeScript': return { languageLabel: 'TypeScript', languageCheck: codeQuality.isTypeScriptCompatible, languageIcon: '📘' };
        case 'JavaScript': return { languageLabel: 'Modern JS', languageCheck: codeQuality.followsBestPractices, languageIcon: '⚡' };
        default: return { languageLabel: 'Standards', languageCheck: codeQuality.followsBestPractices, languageIcon: '✨' };
      }
    };
    const languageSpecific = getLanguageSpecific();
    return {
      language, functionCount, languageSpecific,
      codeStandards: codeQuality.followsBestPractices && codeQuality.hasProperErrorHandling,
      complexity: codeQuality.estimatedComplexity,
      isWellRefactored: codeQuality.followsBestPractices && codeQuality.isWellDocumented,
    };
  };

  const toggleCodePreview = (msgId: string) => {
    setExpandedCodePreviews(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getFileOrFolderIcon = (label: string, itemType?: 'file' | 'folder') => {
    if (itemType === 'folder' || label.endsWith('/')) return <FolderOpen className="inline h-4 w-4 mr-1 text-primary" />;
    return <FileText className="inline h-4 w-4 mr-1 text-primary" />;
  };
  
  const getDisplayName = (label: string, itemType?: 'file' | 'folder') => {
    let name = label;
    if (itemType === 'folder' || label.endsWith('/')) {
      name = label.slice(0, -1); // Remove trailing slash for folders
    }
    return name.split('/').pop() || name; // Get last part of path
  };

  const cleanFolderName = (name: string): string => {
    let base = name.split('.')[0]; // Remove extension if any
    base = base.replace(/[-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
    return base.charAt(0).toUpperCase() + base.slice(1);
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="mb-1"
                            onClick={() => toggleCodePreview(msg.id)}
                          >
                            {expandedCodePreviews[msg.id] ? 'Hide Generated Code' : 'View Generated Code'}
                          </Button>
                          {expandedCodePreviews[msg.id] && (
                            <div className="relative bg-muted p-2 rounded-md group themed-scrollbar mt-1">
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
                          )}
                          {msg.type === 'newFileSuggestion' && msg.suggestedFileName && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id, createFileKey)}
                                disabled={isLoading || actionAppliedStates[createFileKey] || loadingStates[createFileKey]}
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
                                                                   disabled={isLoading || (!msg.targetPath && !activeFilePath) || actionAppliedStates[applyGeneratedCodeKey] || loadingStates[applyGeneratedCodeKey]}
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
                                   })()}
                                   {loadingStates[applyGeneratedCodeKey] && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                                   </>
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

                          {msg.type === 'enhancedCodeGeneration' && (
                            <div className="mt-3 space-y-2">
                              {msg.fileOperationSuggestion && msg.fileOperationSuggestion.type !== 'none' && (
                                <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                                  <CardContent className="p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FilePlus2 className="h-4 w-4 text-primary" />
                                      <span className="text-xs font-medium text-primary dark:text-primary">
                                        File Operation Suggestion
                                      </span>
                                      <span className="text-xs text-primary/80 dark:text-primary/90">
                                        ({Math.round(msg.fileOperationSuggestion.confidence * 100)}% confidence)
                                      </span>
                                    </div>
                                    <p className="text-xs text-primary/90 dark:text-primary/90">{msg.fileOperationSuggestion.reasoning}</p>
                                     <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="mt-2"
                                        onClick={() => handleFileOperationSuggestionAction(
                                            msg.fileOperationSuggestion!.type as 'create' | 'rename' | 'delete',
                                            msg.fileOperationSuggestion!.targetPath,
                                            msg.fileOperationSuggestion!.newName,
                                            msg.fileOperationSuggestion!.fileType,
                                            `${msg.id}-fos`,
                                            (msg.fileOperationSuggestion as any).destinationPath
                                        )}
                                        disabled={isLoading || actionAppliedStates[`${msg.id}-fos`] || loadingStates[`${msg.id}-fos`]}
                                        >
                                         {loadingStates[`${msg.id}-fos`] ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : 
                                          actionAppliedStates[`${msg.id}-fos`] ? <Check className="mr-1.5 h-4 w-4 text-green-500" /> : 
                                          <Wand2 className="mr-1.5 h-4 w-4" />
                                         }
                                         {actionAppliedStates[`${msg.id}-fos`] ? 'Applied' : `Execute: ${msg.fileOperationSuggestion.type}`}
                                     </Button>
                                  </CardContent>
                                </Card>
                              )}

                              {msg.alternativeOptions && msg.alternativeOptions.length > 0 && (
                                <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                                  <CardContent className="p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <RotateCcw className="h-4 w-4 text-primary" />
                                      <span className="text-xs font-medium text-primary dark:text-primary">
                                        Alternative Options
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      {msg.alternativeOptions.slice(0, 2).map((option, idx) => (
                                        <div key={idx} className="text-xs text-primary/90 dark:text-primary/90">
                                          • {option.description}
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {msg.codeQuality && msg.code && (() => {
                                const dynamicQuality = getDynamicCodeQuality(msg.codeQuality, msg.code);
                                return (
                                <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                                  <CardContent className="p-2">
                                      <div className="flex items-center gap-2 mb-2">
                                      <Check className="h-4 w-4 text-primary" />
                                      <span className="text-xs font-medium text-primary dark:text-primary">
                                        Code Quality
                                      </span>
                                      <span className="text-xs text-primary/80 dark:text-primary/90 capitalize">
                                          ({dynamicQuality.complexity} complexity)
                                      </span>
                                    </div>
                                      
                                      <div className="text-xs text-primary/90 dark:text-primary/90 mb-2 flex items-center gap-3">
                                        <span>{dynamicQuality.languageSpecific.languageIcon} {dynamicQuality.language}</span>
                                        <span>📊 {dynamicQuality.functionCount} function{dynamicQuality.functionCount !== 1 ? 's' : ''}</span>
                                      </div>
                                      
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <div className={cn("flex items-center gap-1", dynamicQuality.languageSpecific.languageCheck ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                                          {dynamicQuality.languageSpecific.languageCheck ? "✓" : "○"} {dynamicQuality.languageSpecific.languageLabel}
                                      </div>
                                        <div className={cn("flex items-center gap-1", dynamicQuality.codeStandards ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                                          {dynamicQuality.codeStandards ? "✓" : "○"} Code Standards
                                      </div>
                                        <div className={cn("flex items-center gap-1", dynamicQuality.isWellRefactored ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                                          {dynamicQuality.isWellRefactored ? "✓" : "○"} Well Refactored
                                      </div>
                                      <div className={cn("flex items-center gap-1", msg.codeQuality.isWellDocumented ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                                        {msg.codeQuality.isWellDocumented ? "✓" : "○"} Documented
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                                );
                              })()}
                            </div>
                              )}
                            </div>
                          )}

                      {msg.type === 'smartCodePlacement' && msg.smartPlacementData && (
                        <div className="space-y-3 mt-3">
                          <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-primary dark:text-primary">
                                  Smart Code Placement
                                </span>
                                <span className="text-xs text-primary/80 dark:text-primary/90 capitalize">
                                  ({msg.smartPlacementData.codeType})
                                </span>
                              </div>
                              
                              {msg.smartPlacementData.analysis.topSuggestion && (
                                <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
                                  <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                                    🎯 Best Match: {msg.smartPlacementData.analysis.topSuggestion.fileName}
                                  </div>
                                  <div className="text-xs text-primary/90 dark:text-primary/90">
                                    Confidence: {Math.round(msg.smartPlacementData.analysis.topSuggestion.confidence * 100)}%
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
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
                                    disabled={isLoading || actionAppliedStates[`${msg.id}-smart-suggested`] || loadingStates[`${msg.id}-smart-suggested`]}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                  >
                                    {actionAppliedStates[`${msg.id}-smart-suggested`] ? (
                                      <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                                    ) : (
                                      <><FilePlus2 className="mr-1.5 h-4 w-4" /> Add to {msg.smartPlacementData.analysis.topSuggestion.fileName}</>
                                    )}
                                  </Button>
                                )}

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
                                    disabled={isLoading || actionAppliedStates[`${msg.id}-smart-current`] || loadingStates[`${msg.id}-smart-current`]}
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

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateFileAndInsert(
                                    msg.suggestedFileName || `new-${msg.smartPlacementData!.codeType}.${detectMainLanguage(msg.code!).toLowerCase() === 'typescript' ? 'ts' : 'js'}`,
                                    msg.code!,
                                    msg.id,
                                    `${msg.id}-smart-new`
                                  )}
                                                                      disabled={isLoading || actionAppliedStates[`${msg.id}-smart-new`] || loadingStates[`${msg.id}-smart-new`]}
                                >
                                  {actionAppliedStates[`${msg.id}-smart-new`] ? (
                                    <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Created</>
                                  ) : (
                                    <><FilePlus2 className="mr-1.5 h-4 w-4" /> Create New File</>
                                  )}
                                </Button>
                              </div>

                              {msg.smartPlacementData.suggestedFiles.length > 1 && (
                                <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
                                  <div className="text-xs font-medium text-primary dark:text-primary mb-2">
                                    Other Suggestions:
                                  </div>
                                  <div className="space-y-1">
                                    {msg.smartPlacementData.suggestedFiles.slice(1, 3).map((suggestion, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-xs">
                                        <span className="text-primary/90 dark:text-primary/90">
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
                                          disabled={isLoading || actionAppliedStates[`${msg.id}-alt-${idx}`] || loadingStates[`${msg.id}-alt-${idx}`]}
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

                      {msg.type === 'fileOperationExecution' && msg.fileOperationData && (
                        <div className="space-y-2">
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <Card className={cn("border-2", msg.fileOperationData.success ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800")}>
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        {msg.fileOperationData.success ? <Check className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                                        <span className="text-sm font-medium capitalize">
                                            {msg.fileOperationData.operation} Operation
                                        </span>
                                        
                                        {msg.fileOperationData.operation === 'rename' && msg.fileOperationData.success && (
                                          <div className="ml-auto">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    const recentOp = undoStack.find(op => 
                                                        op.type === 'rename' && 
                                                        op.data.newPath === msg.fileOperationData?.targetPath && 
                                                        op.data.originalName === msg.fileOperationData?.newName
                                                    );
                                                    if (recentOp) { 
                                                        executeUndo(recentOp); 
                                                        setUndoStack(prev => prev.filter(op => op.timestamp !== recentOp.timestamp)); 
                                                    } else { 
                                                        toast({title: "Undo Failed", description: "Could not find matching rename operation to undo.", variant: "destructive"}); 
                                                        console.warn("Undo: Matching rename op not found for", msg.fileOperationData);
                                                    }
                                                }}
                                                title={`Undo rename to ${msg.fileOperationData.newName}`}
                                            >
                                                <Undo2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        )}
                                    </div>
                                    
                                    {msg.fileOperationData.targetPath && <div className="text-xs text-muted-foreground mb-1"><strong>Target:</strong> {msg.fileOperationData.targetPath}</div>}
                                    {msg.fileOperationData.newName && <div className="text-xs text-muted-foreground mb-1"><strong>New Name:</strong> {msg.fileOperationData.newName}</div>}
                                    {msg.fileOperationData.destinationPath && <div className="text-xs text-muted-foreground mb-1"><strong>Destination:</strong> {msg.fileOperationData.destinationPath}</div>}

                                    {msg.fileOperationData.filesFound && msg.fileOperationData.filesFound.length > 0 && (
                                        <div className="text-xs"><strong>Items Found ({msg.fileOperationData.filesFound.length}):</strong>
                                            <div className="mt-1 max-h-32 overflow-y-auto space-y-1 themed-scrollbar">
                                                {msg.fileOperationData.filesFound.slice(0, 10).map((file, idx) => (<div key={idx} className="text-muted-foreground">• {file}</div>))}
                                                {msg.fileOperationData.filesFound.length > 10 && (<div className="text-muted-foreground">... and {msg.fileOperationData.filesFound.length - 10} more</div>)}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                      )}

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

                      {msg.type === 'smartFolderOperation' && msg.smartFolderOperationData && (
                        <div className="space-y-3">
                          <div className="whitespace-pre-wrap font-medium text-sm mb-2">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          
                          <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-primary dark:text-primary">
                                  Smart {msg.smartFolderOperationData.operation.charAt(0).toUpperCase() + msg.smartFolderOperationData.operation.slice(1)} Suggestions
                                </span>
                                <span className="text-xs text-primary/80 dark:text-primary/90">
                                  ({Math.round(msg.smartFolderOperationData.confidence * 100)}% confidence)
                                </span>
                              </div>
                              
                              {msg.smartFolderOperationData.folderAnalysis && (
                                <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
                                  <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                                    📁 Folder Analysis: {msg.smartFolderOperationData.folderAnalysis.totalFiles} files, {msg.smartFolderOperationData.folderAnalysis.languages.join(', ')}
                                  </div>
                                  <div className="text-xs text-primary/90 dark:text-primary/90">
                                    Purpose: {msg.smartFolderOperationData.folderAnalysis.primaryPurpose}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                {msg.smartFolderOperationData.suggestions.slice(0, 3).map((suggestion, idx) => {
                                  const buttonKey = `${msg.id}-folder-${idx}`;
                                  const isApplied = actionAppliedStates[buttonKey];
                                  const anyApplied = Object.keys(actionAppliedStates).some(k => k.startsWith(`${msg.id}-folder-`) && actionAppliedStates[k]);
                                  return (
                                    <div key={idx} className="relative flex items-center justify-between p-2 bg-card/80 dark:bg-card/50 rounded border border-border mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-sm font-medium">{suggestion.folderName}</span>
                                          <span className={cn("text-xs px-2 py-1 rounded", "bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary")}>
                                            {Math.round(suggestion.confidence * 100)}%
                                          </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {suggestion.reasoning}
                                        </div>
                                        <div className="text-xs text-primary/90 dark:text-primary/90 mt-1">
                                          📂 {suggestion.folderPath}
                                        </div>
                                      </div>
                                      <button
                                        className={`absolute bottom-2 right-2 rounded-full p-1 transition-colors ${isApplied ? 'bg-green-100 text-green-600' : 'bg-transparent text-muted-foreground hover:text-primary'} ${anyApplied && !isApplied ? 'opacity-50 pointer-events-none' : ''}`}
                                        title={isApplied ? 'Applied' : `Use this ${msg.smartFolderOperationData?.operation === 'move' ? 'destination' : 'name'}`}
                                        disabled={isLoading || anyApplied}
                                        onClick={async () => {
                                          setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
                                          const opName = msg.smartFolderOperationData?.operation || 'Operation';
                                          const opNameCap = opName.charAt(0).toUpperCase() + opName.slice(1);
                                          
                                          try {
                                            let result: any;
                                            if (msg.smartFolderOperationData?.operation === 'move') {
                                              result = await handleFileOperation('move', {
                                                targetPath: msg.smartFolderOperationData?.targetPath,
                                                destinationPath: suggestion.folderPath
                                              });
                                            } else if (msg.smartFolderOperationData?.operation === 'rename') {
                                              result = await handleFileOperation('rename', {
                                                targetPath: msg.smartFolderOperationData?.targetPath,
                                                newName: suggestion.folderName
                                              });
                                            } else if (msg.smartFolderOperationData?.operation === 'delete') {
                                              result = await handleFileOperation('delete', {
                                                targetPath: suggestion.folderPath
                                              });
                                            }
                                            
                                            if (result?.success) {
                                              toast({
                                                title: `${opNameCap} Success`,
                                                description: result.message || `Successfully completed ${opName}`,
                                              });
                                            } else {
                                              toast({
                                                title: `${opNameCap} Failed`,
                                                description: result?.message || `${opNameCap} operation failed. Check console.`,
                                                variant: 'destructive',
                                              });
                                              console.error(`AI Assistant: Smart folder operation ${opName} failed.`, result);
                                              setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false }));
                                            }
                                          } catch (error: any) {
                                            toast({
                                              title: `${opNameCap} Error`,
                                              description: "An unexpected error occurred. Check console.",
                                              variant: 'destructive',
                                            });
                                            console.error(`AI Assistant: Smart folder operation ${opName} error.`, error);
                                            setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false }));
                                          }
                                        }}
                                      >
                                        {isApplied ? <Check className="h-5 w-5 text-green-600" /> : <Check className="h-5 w-5" />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
                                <div className="text-xs text-primary/90 dark:text-primary/90">
                                  🤖 {msg.smartFolderOperationData.reasoning}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                        {msg.type === 'filenameSuggestion' && msg.filenameSuggestionData && (
                        <div className="space-y-3">
                          <div className="whitespace-pre-wrap font-medium text-sm mb-2">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          
                          {msg.filenameSuggestionData.analysis.mainFunctions.length > 0 && (
                            <div className="p-2 bg-primary/10 dark:bg-primary/15 rounded border border-primary/20 dark:border-primary/30">
                              <div className="text-xs font-medium text-primary dark:text-primary">
                                📝 Functions Found: {msg.filenameSuggestionData.analysis.mainFunctions.join(', ')}
                              </div>
                            </div>
                          )}

                          <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-primary dark:text-primary">
                                  AI Filename Analysis
                                </span>
                              </div>
                              <div className="text-xs text-primary/90 dark:text-primary/90 mb-3">
                                {msg.filenameSuggestionData.analysis.detectedLanguage} • {msg.filenameSuggestionData.analysis.codeType}
                                {msg.filenameSuggestionData.itemType === 'folder' && " (Folder)"}
                              </div>
                              
                              <div className="space-y-2">
                                {msg.filenameSuggestionData.suggestions.slice(0, 3).map((suggestion, idx) => {
                                  const buttonKey = `${msg.id}-rename-${idx}`;
                                  const isApplied = actionAppliedStates[buttonKey];
                                  const anyApplied = Object.keys(actionAppliedStates).some(k => k.startsWith(`${msg.id}-rename-`) && actionAppliedStates[k]);
                                  
                                  let displayName = suggestion.filename;
                                  if (msg.filenameSuggestionData?.itemType === 'folder') {
                                    displayName = cleanFolderName(suggestion.filename);
                                  }

                                  return (
                                    <div key={idx} className="relative flex items-center justify-between p-2 bg-card/80 dark:bg-card/50 rounded border border-border mb-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex-1 truncate">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-medium truncate" title={suggestion.filename}>
                                                  {displayName}
                                                </span>
                                              <span className={cn("text-xs px-2 py-1 rounded", "bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary")}>
                                                {Math.round(suggestion.confidence * 100)}%
                                              </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 capitalize truncate" title={suggestion.reasoning}>
                                              {suggestion.category}: {suggestion.reasoning}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="start">
                                          <p>Full suggested name: {suggestion.filename}</p>
                                          <p>Reason: {suggestion.reasoning}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <button
                                        className={`absolute bottom-2 right-2 rounded-full p-1 transition-colors ${
                                          isApplied ? 'bg-green-100 text-green-600' : 'bg-transparent text-muted-foreground hover:text-primary'
                                        } ${anyApplied && !isApplied ? 'opacity-50 pointer-events-none' : ''}`}
                                        title={isApplied ? 'Applied' : `Apply name: ${displayName}`}
                                        disabled={isLoading || anyApplied}
                                        onClick={async () => {
                                          if (msg.filenameSuggestionData?.targetPath) {
                                            setActionAppliedStates(prev => ({ ...prev, [buttonKey]: true }));
                                            try {
                                              const nameToApply = msg.filenameSuggestionData.itemType === 'folder' 
                                                ? cleanFolderName(suggestion.filename)
                                                : suggestion.filename;

                                              const result = await handleFileOperation('rename', {
                                                targetPath: msg.filenameSuggestionData.targetPath,
                                                newName: nameToApply
                                              });
                                              if (result?.success) {
                                                toast({
                                                  title: "Item Renamed",
                                                  description: `Successfully renamed to \"${nameToApply}\"`,
                                                });
                                                // Mark all suggestions for this message as applied
                                                setActionAppliedStates(prev => {
                                                  const newState = { ...prev };
                                                  Object.keys(newState).forEach(k => {
                                                    if (k.startsWith(`${msg.id}-rename-`)) newState[k] = true;
                                                  });
                                                  return newState;
                                                });
                                                // Add a follow-up message confirming the rename
                                                setChatHistory(prevHistory => [
                                                  ...prevHistory,
                                                  {
                                                    id: generateId(),
                                                    role: 'assistant',
                                                    type: 'fileOperationExecution',
                                                    content: `✅ Successfully renamed to ${nameToApply}`,
                                                    fileOperationData: {
                                                      operation: 'rename',
                                                      success: true,
                                                      targetPath: msg.filenameSuggestionData!.targetPath,
                                                      newName: nameToApply,
                                                      message: result.message,
                                                      requiresConfirmation: false,
                                                    }
                                                  }
                                                ]);
                                              } else {
                                                toast({
                                                  title: "Action Failed",
                                                  description: result?.message || 'Could not rename. Check console.',
                                                  variant: 'destructive',
                                                });
                                                console.error(`AI Assistant: Rename failed for ${msg.filenameSuggestionData.targetPath} to ${nameToApply}. Message: ${result?.message}`);
                                                setActionAppliedStates(prev => ({ ...prev, [buttonKey]: false }));
                                              }
                                            } catch (error: any) {
                                              toast({
                                                title: "Rename Error",
                                                description: "An unexpected error occurred. Check console.",
                                                variant: 'destructive',
                                              });
                                              console.error('AI Assistant: Rename error (suggestion path):', error);
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
                              <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
                                <div className="text-xs text-primary/90 dark:text-primary/90">
                                  💡 Current: {msg.filenameSuggestionData.currentFileName} → Suggested: {
                                    msg.filenameSuggestionData.itemType === 'folder' 
                                    ? cleanFolderName(msg.filenameSuggestionData.topSuggestion?.filename || '')
                                    : msg.filenameSuggestionData.topSuggestion?.filename
                                  }
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

      <div className="p-4 border-t border-sidebar-border mt-auto space-y-2">
        <div className="w-full max-w-xl mx-auto">
          {attachedFiles.length > 0 && (
            <div className="w-full pb-0.5 pr-11 mb-2">
              <div className="grid grid-cols-2 gap-2">
                {attachedFiles.map(file => (
                  <div key={file.path} className="flex items-center justify-between text-xs bg-muted px-1 py-0.5 rounded-md">
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                      {file.type === 'folder' ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-primary" /> }
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

          <div className="flex items-end gap-2.5 w-full">
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
            <div className="flex flex-col items-center gap-1 justify-end">
              <Popover open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          title="Attach file or folder for context"
                      >
                          <Paperclip className="h-3 w-3 shrink-0" />
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
                                className="text-xs cursor-pointer"
                              >
                                {getFileOrFolderIcon(item.label, item.type)}{getDisplayName(item.label, item.type)}
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
                  <MessageSquare className="h-5 w-5 text-primary" />
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


    