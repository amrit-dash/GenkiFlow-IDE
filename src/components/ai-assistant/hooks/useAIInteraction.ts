"use client";

import { useCallback } from 'react';
import type { IdeState } from '@/lib/types';
import type { ChatMessage, AttachedFileUIData, UndoOperation, UseAIInteractionProps } from '../types';
import {
  enhancedGenerateCodeServer,
  summarizeCodeSnippetServer,
  // generateCodeServer, // Keeping enhancedGenerateCodeServer as the primary for now
  refactorCodeServer,
  findExamplesServer,
  // executeFileSystemOperationServer, // Handled via enhancedGenerateCode or specific ops like smartFolderOperations
  // executeFileSystemCommandServer, //  Handled via enhancedGenerateCode or specific ops like actualTerminalCommand
  executeActualTerminalCommandServer,
  suggestFilenameServer,
  intelligentCodeMergerServer,
  smartFolderOperationsServer,
  // Other server actions as needed...
} from '@/app/(ide)/actions';
import { generateId, generateFolderContext } from '../ai-assistant-utils';
import type { FileSystemNode, FilenameSuggestionData, AttachedFileContextForAI } from '@/lib/types';

// Assuming FilenameSuggesterToolOutput type matching src/ai/tools/filename-suggester.ts outputSchema
interface FilenameSuggesterToolOutput {
  suggestions: Array<{
    filename: string;
    reasoning: string;
    confidence: number;
    category: 'descriptive' | 'conventional' | 'functional' | 'contextual';
  }>;
  analysis: {
    detectedLanguage: string;
    codeType: string;
    mainFunctions: string[];
    hasExports: boolean;
    isComponent: boolean;
    suggestedExtension: string;
    currentFileNameForFiltering?: string;
  };
}

export function useAIInteraction({
  prompt,
  setPrompt,
  attachedFiles,
  // setAttachedFiles, // Removed, attachments persist
  chatHistory,
  setChatHistory,
  setIsLoading,
  ideContext,
  performFileOperation,
  showConfirmationDialog,
  setLoadingStates,
  setActionAppliedStates,
  addToUndoStack,
  setForceReplaceState,
}: UseAIInteractionProps) {
  const {
    activeFilePath,
    openedFiles,
    getFileSystemNode,
    fileSystem,
    toast,
    analyzeFileSystemStructure,
  } = ideContext;

  // Helper function to parse user intent and extract location/purpose hints
  const parseUserIntent = useCallback((prompt: string, projectStructure?: string) => {
    const lowerPrompt = prompt.toLowerCase();
    let locationHint = '';
    let purposeHint = '';
    let domainContext = '';

    // Extract location hints
    const locationPatterns = [
      /(?:in|into|under|inside)\s+(?:the\s+)?([a-zA-Z0-9/._-]+(?:\s+[a-zA-Z0-9/._-]+)*)/gi,
      /(?:create|put|place|add).*?(?:in|into|under)\s+([a-zA-Z0-9/._-]+)/gi,
      /src\/([a-zA-Z0-9/_-]+)/gi,
    ];

    for (const pattern of locationPatterns) {
      const match = prompt.match(pattern);
      if (match) {
        locationHint = match[1] || match[0];
        break;
      }
    }

    // Extract purpose hints
    const purposePatterns = [
      /(?:for|to)\s+(.*?)(?:\s+in|\s+under|\s*$)/gi,
      /(?:create|make|build)\s+(?:a|an)?\s*(.*?)(?:\s+for|\s+in|\s*$)/gi,
    ];

    for (const pattern of purposePatterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        purposeHint = match[1].trim();
        break;
      }
    }

    // Extract domain context
    if (lowerPrompt.includes('component') || lowerPrompt.includes('ui')) {
      domainContext = 'components';
    } else if (lowerPrompt.includes('util') || lowerPrompt.includes('helper')) {
      domainContext = 'utils';
    } else if (lowerPrompt.includes('api') || lowerPrompt.includes('service')) {
      domainContext = 'api';
    } else if (lowerPrompt.includes('type') || lowerPrompt.includes('interface')) {
      domainContext = 'types';
    } else if (lowerPrompt.includes('config') || lowerPrompt.includes('setting')) {
      domainContext = 'config';
    } else if (lowerPrompt.includes('test') || lowerPrompt.includes('spec')) {
      domainContext = 'tests';
    }

    return {
      locationHint: locationHint.replace(/['"]/g, '').trim(),
      purposeHint: purposeHint.replace(/['"]/g, '').trim(),
      domainContext,
    };
  }, []);

  // Helper function to detect programming language from file path
  const detectLanguageFromPath = useCallback((filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'TypeScript',
      'tsx': 'TypeScript React',
      'js': 'JavaScript',
      'jsx': 'JavaScript React',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'md': 'Markdown',
      'yml': 'YAML',
      'yaml': 'YAML',
    };
    return languageMap[ext || ''] || 'Text';
  }, []);

  // Helper function to infer file purpose from filename
  const inferFilePurpose = useCallback((fileName: string): string => {
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('component') || lowerName.includes('.tsx') || lowerName.includes('.jsx')) {
      return 'UI Component';
    } else if (lowerName.includes('util') || lowerName.includes('helper')) {
      return 'Utility Function';
    } else if (lowerName.includes('service') || lowerName.includes('api')) {
      return 'Service/API';
    } else if (lowerName.includes('type') || lowerName.includes('interface')) {
      return 'Type Definition';
    } else if (lowerName.includes('config') || lowerName.includes('.env')) {
      return 'Configuration';
    } else if (lowerName.includes('test') || lowerName.includes('spec')) {
      return 'Test File';
    } else if (lowerName.includes('index')) {
      return 'Entry Point';
    } else if (lowerName.includes('hook') && lowerName.startsWith('use')) {
      return 'React Hook';
    }
    
    return 'General Purpose';
  }, []);

  const prepareContextualData = useCallback(() => {
    const generateMinimalTree = (nodes: FileSystemNode[], prefix = "", depth = 0, maxDepth = 3): string => {
      if (depth > maxDepth) return "";
      let treeString = "";
      nodes.forEach(node => {
        treeString += `${prefix}${node.name}${node.type === 'folder' ? '/' : ''}\n`;
        if (node.type === 'folder' && node.children && node.children.length > 0) {
          treeString += generateMinimalTree(node.children, prefix + "  ", depth + 1, maxDepth);
        }
      });
      return treeString;
    };
    const fsTreeSummary = generateMinimalTree(fileSystem);
    const activeNode = activeFilePath ? getFileSystemNode(activeFilePath) : null;
    const currentFileContentForContext = activeFilePath ? (openedFiles.get(activeFilePath)?.content || (activeNode && !Array.isArray(activeNode) && activeNode.type === 'file' ? activeNode.content : undefined)) : undefined;
    const currentFileNameForContext = activeFilePath ? (activeNode && !Array.isArray(activeNode) ? activeNode.name : activeFilePath.split('/').pop()) : undefined;

    // Transform attached files into format suitable for AI consumption
    const attachedFilesDataForAI: AttachedFileContextForAI[] = attachedFiles.map(file => {
      let content = file.content;
      
      // For folders, enhance content with actual file analysis
      if (file.type === 'folder') {
        const folderNode = getFileSystemNode(file.path);
        if (folderNode && !Array.isArray(folderNode) && folderNode.children) {
          const folderContents = folderNode.children.map(child => ({
            name: child.name,
            type: child.type,
            path: child.path,
            content: child.type === 'file' ? (openedFiles.get(child.path)?.content || child.content || '') : undefined,
            language: child.type === 'file' ? detectLanguageFromPath(child.path) : undefined,
          }));
          
          // Create rich description with actual file analysis
          if (folderContents.length > 0) {
            const allFileDescriptions = folderContents.map(f => {
              if (f.type === 'file' && f.content) {
                const fileContent = f.content;
                let analysis = '';
                
                // Extract key information from file content
                if (fileContent.includes('requests') && fileContent.includes('BeautifulSoup')) {
                  analysis = 'web scraping script using requests and BeautifulSoup';
                } else if (fileContent.includes('import ') || fileContent.includes('from ')) {
                  const imports = fileContent.match(/(?:import|from)\s+([^\s\n;]+)/g);
                  if (imports && imports.length > 0) {
                    const mainImports = imports.slice(0, 3).map((imp: string) => imp.replace(/^(import|from)\s+/, '')).join(', ');
                    analysis = `${f.language || 'code'} file using ${mainImports}`;
                  }
                } else {
                  analysis = `${f.language || 'text'} file`;
                }
                
                return `${f.name}: ${analysis}`;
              }
              return `${f.name} (${f.type})`;
            }).join('; ');
            
            content = `Folder containing ${folderContents.length} items: ${allFileDescriptions}`;
          } else {
            content = `Empty folder`;
          }
        }
      }
      
      return {
        path: file.path,
        content: content,
      };
    });

    const projectAnalysisDetails = analyzeFileSystemStructure(fileSystem);
    const projectContextForAI = projectAnalysisDetails ? {
      hasPackageJson: projectAnalysisDetails.hasPackageJson,
      hasReadme: projectAnalysisDetails.hasReadme,
      hasSrcFolder: projectAnalysisDetails.hasSrcFolder,
      hasTestFolder: projectAnalysisDetails.hasTestFolder,
      totalFiles: projectAnalysisDetails.totalFiles,
      totalFolders: projectAnalysisDetails.totalFolders,
    } : undefined;

    return {
      fsTreeSummary,
      currentFileContentForContext,
      currentFileNameForContext,
      attachedFilesDataForAI,
      projectContextForAI,
    };
  }, [fileSystem, activeFilePath, openedFiles, attachedFiles, getFileSystemNode, analyzeFileSystemStructure]);

  // Helper function to automatically execute file operations
  const autoExecuteFileOperation = useCallback(async (
    operationType: 'create' | 'rename' | 'delete' | 'move',
    targetPath: string | undefined,
    newName: string | undefined,
    fileType: 'file' | 'folder' | undefined,
    destinationPath?: string,
    content?: string
  ) => {
    try {
      let result;
      if (operationType === 'create' && newName && fileType) {
        result = await performFileOperation('create', { 
          parentPath: targetPath || '/', 
          fileName: newName, 
          fileType, 
          content: content || '',
          openInIDE: true 
        });
        return result?.success ? `✅ Created ${fileType}: ${newName}` : `❌ Failed to create ${newName}`;
      } else if (operationType === 'rename' && targetPath && newName) {
        result = await performFileOperation('rename', { targetPath, newName });
        return result?.success ? `✅ Renamed to: ${newName}` : `❌ Failed to rename`;
      } else if (operationType === 'delete' && targetPath) {
        result = await performFileOperation('delete', { targetPath });
        return result?.success ? `✅ Deleted: ${targetPath.split('/').pop()}` : `❌ Failed to delete`;
      } else if (operationType === 'move' && targetPath && destinationPath) {
        result = await performFileOperation('move', {targetPath, destinationPath});
        return result?.success ? `✅ Moved to: ${destinationPath}` : `❌ Failed to move`;
      }
      return `❌ Invalid operation parameters`;
    } catch (error: any) {
      return `❌ Operation failed: ${error.message}`;
    }
  }, [performFileOperation]);

  // Helper function to automatically apply code to existing files
  const autoApplyCodeToFile = useCallback(async (
    code: string,
    targetPath: string,
    insertionContext?: string
  ) => {
    try {
      let resolvedNode = getFileSystemNode(targetPath);
      let resolvedPath = targetPath;

      // If direct path lookup fails, try to find by filename
      if (!resolvedNode || Array.isArray(resolvedNode)) {
        // Search through attached files first
        const attachedFile = attachedFiles.find(f => f.name === targetPath || f.path.endsWith('/' + targetPath));
        if (attachedFile && attachedFile.type === 'file') {
          resolvedPath = attachedFile.path;
          resolvedNode = getFileSystemNode(attachedFile.path);
        } else {
          // Search through file system for filename
          const findFileByName = (nodes: any[], name: string): any => {
            for (const node of nodes) {
              if (node.type === 'file' && node.name === name) {
                return node;
              }
              if (node.type === 'folder' && node.children) {
                const found = findFileByName(node.children, name);
                if (found) return found;
              }
            }
            return null;
          };

          const foundNode = findFileByName(fileSystem, targetPath);
          if (foundNode) {
            resolvedPath = foundNode.path;
            resolvedNode = foundNode;
          }
        }
      }

      if (!resolvedNode || Array.isArray(resolvedNode) || resolvedNode.type !== 'file') {
        return `❌ Target path is not a valid file: ${targetPath}`;
      }

      const { updateFileContent } = ideContext;
      updateFileContent(resolvedPath, code);
      
      return `✅ Applied code to: ${resolvedNode.name}`;
    } catch (error: any) {
      return `❌ Failed to apply code: ${error.message}`;
    }
  }, [getFileSystemNode, ideContext, attachedFiles, fileSystem]);

  // Helper function to create new files with content
  const autoCreateFileWithContent = useCallback(async (
    fileName: string,
    code: string,
    targetPath?: string
  ) => {
    try {
      const { addNode, openFile, updateFileContent } = ideContext;
      
      let parentDirNode = targetPath ? getFileSystemNode(targetPath) : 
                         activeFilePath ? getFileSystemNode(activeFilePath) : null;
      let parentIdForNewNode: string | null = null;
      let baseDirForNewNode = "/";

      if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'file') {
        const pathParts = parentDirNode.path.split('/');
        pathParts.pop();
        baseDirForNewNode = pathParts.join('/') || '/';
        const actualParentDirNode = getFileSystemNode(baseDirForNewNode);
        parentIdForNewNode = (actualParentDirNode && !Array.isArray(actualParentDirNode) && actualParentDirNode.type === 'folder') ? actualParentDirNode.id : null;
        if (!parentIdForNewNode) baseDirForNewNode = "/";
      } else if (parentDirNode && !Array.isArray(parentDirNode) && parentDirNode.type === 'folder') {
        parentIdForNewNode = parentDirNode.id;
        baseDirForNewNode = parentDirNode.path;
      }

      const newNode = addNode(parentIdForNewNode, fileName, 'file', baseDirForNewNode);
      if (newNode) {
        openFile(newNode.path, newNode);
        updateFileContent(newNode.path, code);
        addToUndoStack({ 
          type: 'create', 
          data: { name: newNode.name, path: newNode.path, type: newNode.type }, 
          timestamp: Date.now(), 
          description: `Created ${newNode.name}`
        });
        return `✅ Created file: ${newNode.name} with ${code.split('\n').length} lines of code`;
      } else {
        return `❌ Failed to create file: ${fileName}`;
      }
    } catch (error: any) {
      return `❌ Error creating file: ${error.message}`;
    }
  }, [ideContext, getFileSystemNode, activeFilePath, addToUndoStack]);

  const handleSendMessage = useCallback(async () => {
    if (!prompt.trim() && attachedFiles.length === 0) return;

    const userMessageId = generateId();
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      type: 'text',
      content: prompt.trim(),
      attachments: attachedFiles.length > 0 ? attachedFiles.map(file => {
        let fileCount;
        if (file.type === 'folder') {
          // Get actual file count from folder children
          const folderNode = getFileSystemNode(file.path);
          if (folderNode && !Array.isArray(folderNode) && folderNode.children) {
            fileCount = folderNode.children.filter(child => child.type === 'file').length;
          } else {
            fileCount = 0;
          }
        }
        
        return {
          path: file.path,
          name: file.name,
          type: file.type,
          size: file.type === 'file' ? file.content.length : undefined,
          fileCount: file.type === 'folder' ? fileCount : undefined,
        };
      }) : undefined,
    };

    setChatHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    const currentPrompt = prompt.trim();
    setPrompt('');
    // Attachments are NOT cleared here: setAttachedFiles([]);

    const assistantMessageId = generateId();
    const loadingMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      type: 'loading',
      content: 'Processing your request...',
    };
    setChatHistory(prev => [...prev, loadingMessage]);

    let responseMessage: ChatMessage | null = null;

    try {
      const {
        fsTreeSummary,
        currentFileContentForContext,
        currentFileNameForContext,
        attachedFilesDataForAI,
        projectContextForAI
      } = prepareContextualData();

      // Auto-index the codebase for RAG if there are files to index
      if (attachedFilesDataForAI.length > 0) {
        try {
          console.log('Auto-indexing attached files for RAG...');
          const { triggerRAGIndexingServer } = await import('@/app/(ide)/actions');
          await triggerRAGIndexingServer({
            attachedFiles: attachedFilesDataForAI,
            fileSystemTree: fsTreeSummary,
            projectContext: {
              name: 'current-project',
              description: 'GenkiFlow IDE project',
              languages: ['TypeScript', 'JavaScript', 'React'],
              frameworks: ['Next.js', 'React', 'Tailwind CSS'],
            }
          });
          console.log('RAG indexing completed successfully');
        } catch (error) {
          console.error('RAG auto-indexing failed:', error);
          // Continue with request even if indexing fails
        }
      }

      const lowerPrompt = currentPrompt.toLowerCase();
      let intentHandled = false;

      // 1. Enhanced Filename/Folder Suggestion Intent with Context Parsing
      if (lowerPrompt.includes("suggest name") || lowerPrompt.includes("what should i call this") || lowerPrompt.includes("new name for") || 
          lowerPrompt.includes("rename") || lowerPrompt.includes("name this folder") || lowerPrompt.includes("folder name")) {
        
        let targetContent = "";
        let targetCurrentName: string | undefined;
        let targetItemType: 'file' | 'folder' = 'file';
        let targetItemPath: string | undefined;
        let folderContents: any[] = [];
        
        // Parse user intent and location preferences
        const userIntent = parseUserIntent(currentPrompt, fsTreeSummary);

        if (attachedFilesDataForAI.length > 0) {
            targetContent = attachedFilesDataForAI[0].content;
            targetCurrentName = attachedFiles[0].name;
            targetItemType = attachedFiles[0].type;
            targetItemPath = attachedFiles[0].path;
            
            // If it's a folder, get its contents for analysis
            if (targetItemType === 'folder') {
              const folderNode = getFileSystemNode(targetItemPath);
              if (folderNode && !Array.isArray(folderNode) && folderNode.children) {
                folderContents = folderNode.children.map(child => ({
                  name: child.name,
                  type: child.type,
                  path: child.path,
                  content: child.type === 'file' ? (openedFiles.get(child.path)?.content || child.content || '') : undefined,
                  language: child.type === 'file' ? detectLanguageFromPath(child.path) : undefined,
                  purpose: child.type === 'file' ? inferFilePurpose(child.name) : undefined,
                }));
              }
              // For folders, create rich description with actual file analysis
              if (folderContents.length > 0) {
                const fileAnalyses = folderContents
                  .filter(f => f.type === 'file' && f.content)
                  .map(f => {
                    // Analyze actual file content to understand its purpose
                    const content = f.content || '';
                    let purpose = f.purpose || 'Unknown';
                    
                    // Enhanced purpose detection based on content
                    if (content.includes('requests.get') || content.includes('BeautifulSoup') || content.includes('scraper')) {
                      purpose = 'Web Scraper';
                    } else if (content.includes('def ') && content.includes('import')) {
                      purpose = 'Python Module';
                    } else if (content.includes('class ') && content.includes('React')) {
                      purpose = 'React Component';
                    } else if (content.includes('async') && content.includes('await')) {
                      purpose = 'Async Handler';
                    } else if (content.includes('test') || content.includes('describe') || content.includes('it(')) {
                      purpose = 'Test File';
                    } else if (content.includes('import') && content.includes('export')) {
                      purpose = 'Module/Library';
                    } else if (content.includes('function') || content.includes('def ')) {
                      purpose = 'Utility Functions';
                    }
                    
                    return `${f.name} (${purpose})`;
                  });
                
                const allFileDescriptions = folderContents.map(f => {
                  if (f.type === 'file' && f.content) {
                    const content = f.content;
                    let analysis = '';
                    
                    // Extract key information from file content
                    if (content.includes('requests') && content.includes('BeautifulSoup')) {
                      analysis = 'web scraping script using requests and BeautifulSoup';
                    } else if (content.includes('import ') || content.includes('from ')) {
                      const imports = content.match(/(?:import|from)\s+([^\s\n;]+)/g);
                      if (imports && imports.length > 0) {
                        const mainImports = imports.slice(0, 3).map((imp: string) => imp.replace(/^(import|from)\s+/, '')).join(', ');
                        analysis = `${f.language || 'code'} file using ${mainImports}`;
                      }
                    } else {
                      analysis = `${f.language || 'text'} file`;
                    }
                    
                    return `${f.name}: ${analysis}`;
                  }
                  return `${f.name} (${f.type})`;
                }).join('; ');
                
                targetContent = `Folder containing ${folderContents.length} items: ${allFileDescriptions}`;
              } else {
                targetContent = `Empty folder`;
              }
            }
        } else if (activeFilePath && currentFileContentForContext !== undefined) {
            targetContent = currentFileContentForContext;
            targetCurrentName = currentFileNameForContext;
            const activeNode = getFileSystemNode(activeFilePath);
            targetItemType = (activeNode && !Array.isArray(activeNode)) ? activeNode.type : 'file';
            targetItemPath = activeFilePath;
            
            // If active item is a folder, get its contents
            if (targetItemType === 'folder' && activeNode && !Array.isArray(activeNode) && activeNode.children) {
              folderContents = activeNode.children.map(child => ({
                name: child.name,
                type: child.type,
                path: child.path,
                content: child.type === 'file' ? (openedFiles.get(child.path)?.content || child.content || '') : undefined,
                language: child.type === 'file' ? detectLanguageFromPath(child.path) : undefined,
                purpose: child.type === 'file' ? inferFilePurpose(child.name) : undefined,
              }));
              // For folders, create rich description with actual file analysis
              if (folderContents.length > 0) {
                const allFileDescriptions = folderContents.map(f => {
                  if (f.type === 'file' && f.content) {
                    const content = f.content;
                    let analysis = '';
                    
                    // Extract key information from file content
                    if (content.includes('requests') && content.includes('BeautifulSoup')) {
                      analysis = 'web scraping script using requests and BeautifulSoup';
                    } else if (content.includes('import ') || content.includes('from ')) {
                      const imports = content.match(/(?:import|from)\s+([^\s\n;]+)/g);
                      if (imports && imports.length > 0) {
                        const mainImports = imports.slice(0, 3).map((imp: string) => imp.replace(/^(import|from)\s+/, '')).join(', ');
                        analysis = `${f.language || 'code'} file using ${mainImports}`;
                      }
                    } else {
                      analysis = `${f.language || 'text'} file`;
                    }
                    
                    return `${f.name}: ${analysis}`;
                  }
                  return `${f.name} (${f.type})`;
                }).join('; ');
                
                targetContent = `Folder containing ${folderContents.length} items: ${allFileDescriptions}`;
              } else {
                targetContent = `Empty folder`;
              }
            }
        }

        if (targetContent || targetItemType === 'folder') {
            // Enhanced context for folders by including folder analysis in the prompt
            let enhancedContext = currentPrompt;
            if (targetItemType === 'folder' && folderContents.length > 0) {
              // Use the rich file analysis we already created
              const folderAnalysis = `This folder contains ${folderContents.length} items. `;
              
              // Get detailed file purposes
              const filePurposes = folderContents
                .filter(f => f.type === 'file' && f.content)
                .map(f => {
                  const content = f.content || '';
                  if (content.includes('requests.get') || content.includes('BeautifulSoup') || content.includes('scraper')) {
                    return 'web scraping';
                  } else if (content.includes('def ') && content.includes('import')) {
                    return 'python modules';
                  } else if (content.includes('class ') && content.includes('React')) {
                    return 'react components';
                  } else if (content.includes('async') && content.includes('await')) {
                    return 'async handlers';
                  } else if (content.includes('test') || content.includes('describe') || content.includes('it(')) {
                    return 'tests';
                  } else if (content.includes('function') || content.includes('def ')) {
                    return 'utility functions';
                  }
                  return 'code files';
                })
                .filter(Boolean);
              
              const dominantLanguage = folderContents.filter(f => f.language).map(f => f.language).reduce((acc: any, lang: string) => {
                acc[lang] = (acc[lang] || 0) + 1;
                return acc;
              }, {});
              const mostCommonLang = Object.keys(dominantLanguage).reduce((a, b) => dominantLanguage[a] > dominantLanguage[b] ? a : b, '');
              
              const purposeHint = filePurposes.length > 0 
                ? `Main purposes: ${Array.from(new Set(filePurposes)).join(', ')}` 
                : 'mixed content';
              
              if (mostCommonLang) {
                enhancedContext = `${folderAnalysis}Primary language: ${mostCommonLang}. ${purposeHint}. User intent: ${userIntent.purposeHint || 'folder organization'}. ${enhancedContext}`;
              } else {
                enhancedContext = `${folderAnalysis}${purposeHint}. User intent: ${userIntent.purposeHint || 'folder organization'}. ${enhancedContext}`;
              }
            } else if (targetItemType === 'folder' && userIntent.purposeHint) {
              enhancedContext = `Creating folder for: ${userIntent.purposeHint}. ${userIntent.locationHint ? `Preferred location: ${userIntent.locationHint}. ` : ''}${enhancedContext}`;
            }

            const result = await suggestFilenameServer({
                fileContent: targetContent || 'Empty folder for organization',
                currentFileName: targetCurrentName,
                fileType: targetItemType,
                context: enhancedContext,
                projectStructure: fsTreeSummary,
            });
            
            responseMessage = {
                id: assistantMessageId, 
                role: 'assistant', 
                type: 'filenameSuggestion',
                content: result.suggestions.length > 0 ? 
                  `Here are some ${targetItemType} name suggestions for "${targetCurrentName || 'the new ' + targetItemType}"${userIntent.locationHint ? ` (suggested location: ${userIntent.locationHint})` : ''}:` : 
                  `I couldn't come up with specific name suggestions for "${targetCurrentName || 'the ' + targetItemType}".`,
                filenameSuggestionData: {
                  suggestions: result.suggestions,
                  analysis: result.analysis as FilenameSuggestionData['analysis'],
                  topSuggestion: result.topSuggestion,
                  currentFileName: targetCurrentName,
                  targetPath: targetItemPath,
                  itemType: targetItemType,
                },
            };
            intentHandled = true;
        }
      }
      // 2. Terminal Command Intent
      else if (lowerPrompt.startsWith("run ") || lowerPrompt.startsWith("execute `") || lowerPrompt.startsWith("terminal:")) {
          const commandToRun = lowerPrompt.replace(/^(run\s*|execute\s*`|terminal:\s*)/, '').replace(/`$/, '');
          if (commandToRun) {
            const result = await executeActualTerminalCommandServer({ command: commandToRun, context: "User requested terminal command" });
            responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'terminalCommandExecution',
                content: `Terminal command status for: \`${result.command}\``,
                terminalCommandData: {
                  command: result.command,
                  status: result.status === 'executed' ? 'completed' : result.status as 'pending' | 'failed' | 'cancelled' | 'unsupported' | 'executing' | 'completed',
                  output: result.output,
                  error: result.error,
                  context: result.context,
                  canExecute: result.canExecute,
                  readyForExecution: result.readyForExecution,
                  supportedCommands: result.supportedCommands,
                  executionInstructions: result.executionInstructions,
                  availableCommands: result.availableCommands,
                }
            };
            intentHandled = true;
          }
      }
      // 3. Refactor Intent
      else if (lowerPrompt.includes("refactor")) {
          const codeToRefactor = attachedFilesDataForAI.length > 0 ? attachedFilesDataForAI[0].content : currentFileContentForContext;
          const pathForRefactor = attachedFilesDataForAI.length > 0 ? attachedFilesDataForAI[0].path : activeFilePath;
          
          if (codeToRefactor && pathForRefactor) {
            const fileNameForRefactor = pathForRefactor.split('/').pop() || "selected code";
            const result = await refactorCodeServer({
                attachedFilesDataForAI,
                currentFilePath: activeFilePath || undefined,
                currentFileContent: currentFileContentForContext,
            });
            
            // Auto-apply refactoring if suggestion exists
            if (result.suggestion?.proposedCode) {
              const applyResult = await autoApplyCodeToFile(
                result.suggestion.proposedCode,
                pathForRefactor,
                'AI refactoring suggestion'
              );
              responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'text',
                content: `${applyResult}\n\n**Refactoring Applied:** ${result.suggestion.description}`,
              };
            } else {
            responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'text',
                content: "No significant refactoring improvements were identified for the selected code.",
            };
            }
            intentHandled = true;
          }
      }
      // 4. Summarize Intent
      else if (lowerPrompt.startsWith("summarize")) {
          const contentToSummarize = attachedFilesDataForAI.length > 0 ? attachedFilesDataForAI[0].content : currentFileContentForContext;
          if (contentToSummarize) {
            const result = await summarizeCodeSnippetServer({
                attachedFilesDataForAI,
                currentFilePath: activeFilePath || undefined,
                currentFileContent: currentFileContentForContext,
            });
            responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'text',
                content: result.summary || "Could not summarize the content."
            };
            intentHandled = true;
          }
      }
      // 5. Find Examples Intent
      else if (lowerPrompt.includes("find example") || lowerPrompt.includes("show me how to use")) {
        const queryForExamples = currentPrompt.replace(/(find\s+example(s)?\s+of|show\s+me\s+how\s+to\s+use)\s*/i, "").trim();
        if (queryForExamples) {
            const result = await findExamplesServer({ query: queryForExamples });
            responseMessage = {
                id: assistantMessageId, role: 'assistant', type: 'codeExamples',
                content: `Here are some examples for "${queryForExamples}":`,
                examples: result.examples
            };
            intentHandled = true;
        }
      }
      // 6. Smart Folder Creation Intent with Purpose Analysis
      else if (lowerPrompt.includes("create") && (lowerPrompt.includes("folder") || lowerPrompt.includes("directory"))) {
        // Check if this is a purpose-driven folder creation that should use enhanced suggestions
        const hasPurpose = lowerPrompt.includes(" for ") || lowerPrompt.includes(" to ") || 
                          lowerPrompt.includes("python") || lowerPrompt.includes("component") || 
                          lowerPrompt.includes("util") || lowerPrompt.includes("script") ||
                          lowerPrompt.includes("api") || lowerPrompt.includes("service") ||
                          lowerPrompt.includes("test") || lowerPrompt.includes("config");

        if (hasPurpose) {
          // Use enhanced filename suggester for purpose-driven folder creation
          const userIntent = parseUserIntent(currentPrompt, fsTreeSummary);
          
          // Create enhanced context for folder purpose
          let folderPurpose = '';
          if (lowerPrompt.includes('python')) folderPurpose = 'Python scripts and modules';
          else if (lowerPrompt.includes('component')) folderPurpose = 'React/UI components';
          else if (lowerPrompt.includes('util') || lowerPrompt.includes('helper')) folderPurpose = 'Utility functions';
          else if (lowerPrompt.includes('api') || lowerPrompt.includes('service')) folderPurpose = 'API services and endpoints';
          else if (lowerPrompt.includes('test')) folderPurpose = 'Test files and specs';
          else if (lowerPrompt.includes('config')) folderPurpose = 'Configuration files';
          else {
            // Extract purpose from "for [purpose]" pattern
            const purposeMatch = currentPrompt.match(/for\s+(.*?)(?:\s+in|\s*$)/i);
            if (purposeMatch) {
              folderPurpose = purposeMatch[1].trim();
            }
          }

          const enhancedContext = `Creating folder for: ${folderPurpose}. ${userIntent.locationHint ? `Preferred location: ${userIntent.locationHint}. ` : ''}${currentPrompt}`;

          const result = await suggestFilenameServer({
              fileContent: `Folder for organizing: ${folderPurpose}`,
              currentFileName: undefined,
              fileType: 'folder',
              context: enhancedContext,
              projectStructure: fsTreeSummary,
          });
          
          responseMessage = {
              id: assistantMessageId, 
              role: 'assistant', 
              type: 'filenameSuggestion',
              content: `Here are some folder name suggestions for "${folderPurpose}"${userIntent.locationHint ? ` (suggested location: ${userIntent.locationHint})` : ''}:`,
              filenameSuggestionData: {
                suggestions: result.suggestions,
                analysis: result.analysis as FilenameSuggestionData['analysis'],
                topSuggestion: result.topSuggestion,
                currentFileName: undefined,
                targetPath: userIntent.locationHint || '/',
                itemType: 'folder',
              },
          };
          intentHandled = true;
        } else {
          // Simple folder creation without specific purpose
          const folderNameMatch = currentPrompt.match(/create\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)(?:\s+called|\s+named)?\s+["']?([^"'\s]+)["']?/i);
          const suggestedFolderName = folderNameMatch?.[1] || 'new-folder';
          
          responseMessage = {
            id: assistantMessageId, role: 'assistant', type: 'fileOperationExecution',
            content: `I suggest creating a new folder. What would you like to do?`,
            fileOperationData: {
              operation: 'create',
              success: false,
              targetPath: '/', // Default to root
              newName: suggestedFolderName,
              message: `The user wants to create a new folder in the root directory.`,
              requiresConfirmation: true,
              confirmationMessage: `Create a new folder named "${suggestedFolderName}" in the root directory?`,
              fileType: 'folder',
            },
          };
          intentHandled = true;
        }
      }
      // 7. Contextual File Reference Intent (e.g., "update readme", "modify package.json")
      else if (lowerPrompt.includes("update") || lowerPrompt.includes("modify") || lowerPrompt.includes("edit") || lowerPrompt.includes("change")) {
        // Helper function to find files by fuzzy matching
        const findFileByPattern = (pattern: string): any => {
          const findInNodes = (nodes: any[]): any => {
            for (const node of nodes) {
              if (node.type === 'file') {
                const fileName = node.name.toLowerCase();
                const patternLower = pattern.toLowerCase();
                
                // Exact matches
                if (fileName === patternLower || fileName === patternLower + '.md' || fileName === patternLower + '.txt') {
                  return node;
                }
                
                // Common patterns
                if (patternLower.includes('readme') && fileName.includes('readme')) return node;
                if (patternLower.includes('package') && fileName.includes('package')) return node;
                if (patternLower.includes('config') && (fileName.includes('config') || fileName.includes('.env'))) return node;
                if (patternLower.includes('main') && (fileName.includes('main') || fileName.includes('index') || fileName.includes('app'))) return node;
                
                // Partial matches
                if (fileName.includes(patternLower) || patternLower.includes(fileName.replace(/\.[^.]+$/, ''))) {
                  return node;
                }
              }
              
              if (node.type === 'folder' && node.children) {
                const found = findInNodes(node.children);
                if (found) return found;
              }
            }
            return null;
          };
          
          return findInNodes(fileSystem);
        };

        // Extract file reference from prompt
        const fileRefMatch = currentPrompt.match(/(?:update|modify|edit|change)\s+(?:the\s+)?([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)*)/i);
        const fileReference = fileRefMatch?.[1];
        
        if (fileReference) {
          const foundFile = findFileByPattern(fileReference);
          
          if (foundFile) {
            // Get current file content for context
            const currentContent = openedFiles.get(foundFile.path)?.content || foundFile.content || '';
            
            responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'fileOperationExecution',
              content: `I found "${foundFile.name}" in your project. What changes would you like to make?`,
              fileOperationData: {
                operation: 'rename', // We'll use this as a "modify" operation
                success: false,
                targetPath: foundFile.path,
                newName: foundFile.name, // Keep same name, we're modifying content
                content: currentContent,
                message: `Found file: ${foundFile.path}\n\nCurrent content:\n${currentContent.slice(0, 500)}${currentContent.length > 500 ? '...' : ''}\n\nWhat specific changes would you like to make to this file?`,
                requiresConfirmation: true,
                confirmationMessage: `Modify ${foundFile.name}?`,
                fileType: 'file',
              },
            };
            intentHandled = true;
          }
        }
      }

      // Default: Enhanced Code Generation with Interactive UI
      if (!intentHandled) {
        const enhancedGenInput = {
          prompt: currentPrompt,
          currentFilePath: activeFilePath || undefined,
          currentFileContent: currentFileContentForContext,
          currentFileName: currentFileNameForContext,
          attachedFiles: attachedFilesDataForAI,
          fileSystemTree: fsTreeSummary,
          chatHistory: chatHistory.slice(-5).map(m => ({ role: m.role, content: m.content })),
          projectContext: projectContextForAI,
        };
        const enhancedResult = await enhancedGenerateCodeServer(enhancedGenInput);

        // Handle filename suggestions (show UI for user choice)
        if (enhancedResult.filenameSuggestionData) {
            const toolOutput = enhancedResult.filenameSuggestionData as FilenameSuggesterToolOutput;
            const targetPathForResult = enhancedResult.targetPath;
            const targetNode = targetPathForResult ? getFileSystemNode(targetPathForResult) : null;
            const itemTypeForResult = (targetNode && !Array.isArray(targetNode)) ? targetNode.type : (enhancedResult.fileOperationSuggestion?.fileType || 'file');
            const currentNameForSuggestion = toolOutput.analysis?.currentFileNameForFiltering || (targetNode && !Array.isArray(targetNode) ? targetNode.name : targetPathForResult?.split('/').pop());

            responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'filenameSuggestion',
              content: enhancedResult.explanation || `Here are some name suggestions for "${currentNameForSuggestion || 'the item'}":`,
              filenameSuggestionData: {
                suggestions: toolOutput.suggestions,
                analysis: toolOutput.analysis as FilenameSuggestionData['analysis'],
                topSuggestion: toolOutput.suggestions.length > 0 ? toolOutput.suggestions[0] : null,
                currentFileName: currentNameForSuggestion,
                targetPath: targetPathForResult || undefined,
                itemType: itemTypeForResult,
              },
              targetPath: targetPathForResult || undefined,
              explanation: enhancedResult.explanation || undefined,
            };
        }
        // Handle file operations (show UI for user choice)
        else if (enhancedResult.fileOperationSuggestion && enhancedResult.fileOperationSuggestion.type !== 'none') {
          const fileOp = enhancedResult.fileOperationSuggestion;
          
          responseMessage = {
            id: assistantMessageId, role: 'assistant', type: 'fileOperationExecution',
            content: `I suggest ${fileOp.type === 'create' ? 'creating' : fileOp.type === 'rename' ? 'renaming' : fileOp.type === 'delete' ? 'deleting' : 'moving'} ${fileOp.type === 'create' ? 'a new ' + (fileOp.fileType || 'file') : 'this item'}. What would you like to do?`,
            fileOperationData: {
              operation: fileOp.type as 'create' | 'rename' | 'delete' | 'move' | 'list',
              success: false, // Not executed yet
              targetPath: fileOp.targetPath || undefined,
              newName: fileOp.newName || undefined,
              destinationPath: fileOp.destinationPath || undefined,
              content: enhancedResult.code || undefined,
              message: fileOp.reasoning,
              requiresConfirmation: true,
              confirmationMessage: fileOp.reasoning,
              fileType: fileOp.fileType,
            },
          };
        }
        // Handle code generation (show interactive options)
        else if (enhancedResult.code) {
          if (enhancedResult.isNewFile && enhancedResult.suggestedFileName) {
            // Show interactive dialog for new file creation
            responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'newFileSuggestion',
              content: `I've generated code for you. How would you like to proceed?`,
              code: enhancedResult.code,
              isNewFile: true,
              suggestedFileName: enhancedResult.suggestedFileName,
              targetPath: enhancedResult.targetPath || undefined,
              explanation: enhancedResult.explanation || undefined,
              fileOperationSuggestion: enhancedResult.fileOperationSuggestion || {
                type: 'create',
                reasoning: `Create new file: ${enhancedResult.suggestedFileName}`,
                targetPath: enhancedResult.targetPath || '/',
                newName: enhancedResult.suggestedFileName,
                fileType: 'file',
                confidence: 0.8,
              },
              alternativeOptions: [
                {
                  description: `Merge with current file: ${currentFileNameForContext || 'active file'}`,
                  isNewFile: false,
                  targetPath: activeFilePath || undefined,
                },
                {
                  description: "Let me choose a different location",
                  isNewFile: true,
                  targetPath: undefined,
                }
              ],
            };
          } else if (enhancedResult.targetPath || activeFilePath) {
            // Show enhanced code generation result for existing file modification
            responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'enhancedCodeGeneration',
              content: enhancedResult.explanation || `I've generated code for you. How would you like to proceed?`,
              code: enhancedResult.code,
              isNewFile: false,
              targetPath: enhancedResult.targetPath || activeFilePath,
              explanation: enhancedResult.explanation || undefined,
              fileOperationSuggestion: enhancedResult.fileOperationSuggestion,
              alternativeOptions: enhancedResult.alternativeOptions,
              codeQuality: enhancedResult.codeQuality,
            };
          } else {
            // Show options when no clear target
            responseMessage = {
              id: assistantMessageId, role: 'assistant', type: 'newFileSuggestion',
              content: `I've generated code for you. How would you like to proceed?`,
              code: enhancedResult.code,
              isNewFile: true,
              suggestedFileName: enhancedResult.suggestedFileName || `generated-code-${Date.now()}.ts`,
              explanation: enhancedResult.explanation || undefined,
              fileOperationSuggestion: enhancedResult.fileOperationSuggestion || {
                type: 'create',
                reasoning: "Create new file for the generated code",
                targetPath: '/',
                newName: enhancedResult.suggestedFileName || `generated-code-${Date.now()}.ts`,
                fileType: 'file',
                confidence: 0.7,
              },
              alternativeOptions: activeFilePath ? [
                {
                  description: `Apply to current file: ${currentFileNameForContext || 'active file'}`,
                  isNewFile: false,
                  targetPath: activeFilePath,
                }
              ] : [],
            };
          }
        }
        // Fallback for explanation-only responses
        else {
          responseMessage = {
            id: assistantMessageId, role: 'assistant', type: 'text',
            content: enhancedResult.explanation || "I've processed your request. How else can I help you?",
          };
        }
      }

      if (responseMessage) {
        setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? responseMessage! : msg));
      } else {
        setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? {
          id: assistantMessageId, role: 'assistant', type: 'error', content: "Sorry, I couldn't process that request. Could you rephrase?"
        } : msg));
      }

    } catch (error: any) {
      console.error("AI Interaction Error:", error);
      const errorMessage = error.message || "An unexpected error occurred.";
      setChatHistory(prev => prev.map(msg => msg.id === assistantMessageId ? {
        id: assistantMessageId, role: 'assistant', type: 'error', content: `Error: ${errorMessage}`
      } : msg));
      toast({ variant: "destructive", title: "AI Error", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [
    prompt,
    setPrompt,
    attachedFiles,
    chatHistory,
    setChatHistory,
    setIsLoading,
    ideContext,
    performFileOperation,
    showConfirmationDialog,
    setLoadingStates,
    setActionAppliedStates,
    addToUndoStack,
    setForceReplaceState,
    prepareContextualData,
    autoExecuteFileOperation,
    autoApplyCodeToFile,
    autoCreateFileWithContent,
    getFileSystemNode,
    activeFilePath,
    toast,
  ]);

  return { handleSendMessage };
}
