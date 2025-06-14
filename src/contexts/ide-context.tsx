
"use client";

import type React from 'react';
import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type { FileSystemNode, IdeState as IdeStateInterface, ToastOptions } from '@/lib/types'; // Use IdeStateInterface to avoid name clash
import { mockFileSystem } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast'; // Import useToast

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

// LocalStorage keys
const FS_STORAGE_KEY = 'genkiflowIdeFileSystem';
const OPENED_FILES_STORAGE_KEY = 'genkiflowIdeOpenedFiles';
const ACTIVE_FILE_STORAGE_KEY = 'genkiflowIdeActiveFile';
const ACCENT_COLOR_STORAGE_KEY = 'genkiflowIdeAccentColor';

const MAX_HISTORY_LENGTH = 50;
const DEFAULT_ACCENT_COLOR_HSL = "270 70% 55%";

const IdeContext = createContext<IdeStateInterface | undefined>(undefined);

function applyAccentColorToDocument(hslColor: string) {
  if (typeof window === 'undefined') return;
  try {
    const [h, s, l] = hslColor.split(" ").map(val => parseInt(val.replace('%', ''), 10));
    if (isNaN(h) || isNaN(s) || isNaN(l)) {
      console.warn("Invalid HSL string for accent color:", hslColor);
      return;
    }
    const primaryLightness = l;
    const ringLightness = Math.min(100, Math.max(0, primaryLightness + 10));

    document.documentElement.style.setProperty('--primary', `${h} ${s}% ${primaryLightness}%`);
    document.documentElement.style.setProperty('--accent', `${h} ${s}% ${primaryLightness}%`);
    document.documentElement.style.setProperty('--ring', `${h} ${s}% ${ringLightness}%`);

  } catch (error) {
    console.error("Failed to parse or apply accent color:", hslColor, error);
  }
}

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem, setFileSystemState] = useState<FileSystemNode[]>([]);
  const [openedFiles, setOpenedFilesState] = useState<Map<string, FileSystemNode>>(new Map());
  const [activeFilePath, setActiveFilePathState] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [nodeToAutoRenameId, setNodeToAutoRenameIdState] = useState<string | null>(null);
  const { toast } = useToast();

  const initialAccentValue = useMemo(() => {
    if (typeof window !== 'undefined') {
      const storedColor = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
      const colorToUse = storedColor || DEFAULT_ACCENT_COLOR_HSL;
      applyAccentColorToDocument(colorToUse); // Apply immediately
      return colorToUse;
    }
    return DEFAULT_ACCENT_COLOR_HSL;
  }, []); // Runs once on mount

  const [accentColor, setAccentColorState] = useState<string>(initialAccentValue);

  useEffect(() => {
    setIsBusy(true); // Ensure busy is true at the start of this effect
    try {
      // FileSystem loading
      const storedFs = localStorage.getItem(FS_STORAGE_KEY);
      let loadedFs: FileSystemNode[];
      if (storedFs) {
        const parsedFs = JSON.parse(storedFs);
        if (Array.isArray(parsedFs) && parsedFs.length > 0) {
            loadedFs = parsedFs;
        } else {
             loadedFs = mockFileSystem;
        }
      } else {
        loadedFs = mockFileSystem;
      }
      const initializeFsHistory = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.type === 'file') {
            const savedContent = node.content || '';
            return {
              ...node,
              content: savedContent,
              contentHistory: [savedContent],
              historyIndex: 0,
            };
          }
          if (node.children) {
            return { ...node, children: initializeFsHistory(node.children) };
          }
          return node;
        });
      };
      setFileSystemState(initializeFsHistory(loadedFs));

      // OpenedFiles loading
      const storedOpenedFiles = localStorage.getItem(OPENED_FILES_STORAGE_KEY);
      if (storedOpenedFiles) {
        const parsedOpenedFiles: [string, FileSystemNode][] = JSON.parse(storedOpenedFiles);
        const initializedOpenedFiles = new Map<string, FileSystemNode>();
        parsedOpenedFiles.forEach(([path, node]) => {
            if (node.type === 'file') {
                const liveContentHistory = node.contentHistory && node.contentHistory.length > 0 ? node.contentHistory : [node.content || ''];
                const liveHistoryIndex = node.historyIndex !== undefined && node.historyIndex < liveContentHistory.length ? node.historyIndex : Math.max(0, liveContentHistory.length - 1);
                initializedOpenedFiles.set(path, {...node, content: liveContentHistory[liveHistoryIndex] || '', contentHistory: liveContentHistory, historyIndex: liveHistoryIndex });
            } else {
                initializedOpenedFiles.set(path, node);
            }
        });
        setOpenedFilesState(initializedOpenedFiles);
      }

      // ActiveFile loading
      const storedActiveFile = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
      if (storedActiveFile && storedActiveFile !== "null") {
         const fileExistsInFs = (fs: FileSystemNode[], path: string): boolean => {
            for (const node of fs) {
                if (node.path === path && node.type === 'file') return true;
                if (node.children && fileExistsInFs(node.children, path)) return true;
            }
            return false;
         }
         if (fileExistsInFs(loadedFs, storedActiveFile)) { 
            const currentOpenedFilesMap = storedOpenedFiles ? new Map<string, FileSystemNode>(JSON.parse(storedOpenedFiles)) : new Map();
            if (currentOpenedFilesMap.has(storedActiveFile)) {
                 setActiveFilePathState(storedActiveFile);
            } else {
                const firstOpenedKey = currentOpenedFilesMap.size > 0 ? Array.from(currentOpenedFilesMap.keys())[0] : null;
                setActiveFilePathState(firstOpenedKey);
            }
         } else {
            setActiveFilePathState(null); 
         }
      } else {
        setActiveFilePathState(null);
      }

      const currentAccentInStorage = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
      const definitiveAccentColor = currentAccentInStorage || DEFAULT_ACCENT_COLOR_HSL;
      if (accentColor !== definitiveAccentColor) { 
        setAccentColorState(definitiveAccentColor);
        applyAccentColorToDocument(definitiveAccentColor);
      }

    } catch (error) {
      console.error("Error loading from localStorage during initial setup:", error);
      const initializeMockFsHistory = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.type === 'file') {
            const savedContent = node.content || '';
            return { ...node, content: savedContent, contentHistory: [savedContent], historyIndex: 0 };
          }
          if (node.children) {
            return { ...node, children: initializeMockFsHistory(node.children) };
          }
          return node;
        });
      };
      setFileSystemState(initializeMockFsHistory(mockFileSystem));
      setOpenedFilesState(new Map());
      setActiveFilePathState(null);
      setAccentColorState(DEFAULT_ACCENT_COLOR_HSL);
      applyAccentColorToDocument(DEFAULT_ACCENT_COLOR_HSL);
    } finally {
      // Add a small delay to give the accent color a chance to apply visually
      // and for the user to see the loader with the correct color for a bit longer.
      setTimeout(() => {
        setIsBusy(false);
      }, 350); // Adjusted delay to 350ms
    }
  }, []); 

  useEffect(() => {
    if (isBusy) return;
    try {
      localStorage.setItem(FS_STORAGE_KEY, JSON.stringify(fileSystem));
      localStorage.setItem(OPENED_FILES_STORAGE_KEY, JSON.stringify(Array.from(openedFiles.entries())));
      localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, activeFilePath || "null");
    } catch (error) {
      console.error("Error saving workspace state to localStorage:", error);
    }
  }, [fileSystem, openedFiles, activeFilePath, isBusy]);

  useEffect(() => {
    if (isBusy) return; 
    try {
      localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, accentColor);
    } catch (error) {
      console.error("Error saving accentColor to localStorage:", error);
    }
  }, [accentColor, isBusy]);


  const replaceWorkspace = useCallback((newNodes: FileSystemNode[], newActiveFilePath: string | null = null) => {
    const initializeFsHistory = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.type === 'file') {
            const savedContent = node.content || '';
            return { ...node, content: savedContent, contentHistory: [savedContent], historyIndex: 0 };
          }
          if (node.children) {
            return { ...node, children: initializeFsHistory(node.children) };
          }
          return node;
        });
      };
    setFileSystemState(initializeFsHistory(newNodes));
    setOpenedFilesState(new Map());
    setActiveFilePathState(newActiveFilePath);

    try {
      localStorage.setItem(OPENED_FILES_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, "null");
    } catch (error) {
      console.error("Error clearing workspace state from localStorage:", error);
    }
  }, []);

  const setAccentColor = useCallback((newColorHsl: string) => {
    setAccentColorState(newColorHsl);
    applyAccentColorToDocument(newColorHsl);
  }, []);


  const setNodeToAutoRenameId = useCallback((id: string | null) => {
    setNodeToAutoRenameIdState(id);
  }, []);

  const getFileSystemNode = useCallback((pathOrId: string): FileSystemNode | FileSystemNode[] | undefined => {
    if (pathOrId === '///get_all_root_nodes///') {
        return fileSystem;
    }
    const findNode = (nodes: FileSystemNode[], targetPathOrId: string): FileSystemNode | undefined => {
      for (const node of nodes) {
        if (node.path === targetPathOrId || node.id === targetPathOrId) {
          return node;
        }
        if (node.type === 'folder' && node.children) {
          const found = findNode(node.children, targetPathOrId);
          if (found) return found;
        }
      }
      return undefined;
    };
    if (pathOrId === '/') { 
        const rootNodeCandidate = findNode(fileSystem, pathOrId); 
        return rootNodeCandidate && rootNodeCandidate.type === 'folder' && rootNodeCandidate.path === '/' ? rootNodeCandidate : fileSystem;
    }
    return findNode(fileSystem, pathOrId);
  }, [fileSystem]);

  const openFile = useCallback((filePath: string, nodeToOpen?: FileSystemNode) => {
    if (openedFiles.has(filePath) && activeFilePath === filePath) {
      setActiveFilePathState(filePath);
      return;
    }
    if (openedFiles.has(filePath)) { 
      setActiveFilePathState(filePath);
      return;
    }

    let fileNodeFromSystem: FileSystemNode | undefined;
    if (nodeToOpen && nodeToOpen.type === 'file' && nodeToOpen.path === filePath) {
      fileNodeFromSystem = nodeToOpen;
    } else {
      const foundNode = getFileSystemNode(filePath);
      if (foundNode && typeof foundNode === 'object' && !Array.isArray(foundNode) && foundNode.type === 'file') {
        fileNodeFromSystem = foundNode as FileSystemNode;
      }
    }

    if (fileNodeFromSystem) {
      const savedContent = fileNodeFromSystem.content || '';
      const liveEditingHistory = fileNodeFromSystem.contentHistory && fileNodeFromSystem.contentHistory.length > 0 
                                  ? fileNodeFromSystem.contentHistory 
                                  : [savedContent];
      const liveHistoryIndex = fileNodeFromSystem.historyIndex !== undefined && fileNodeFromSystem.historyIndex < liveEditingHistory.length
                                  ? fileNodeFromSystem.historyIndex
                                  : Math.max(0, liveEditingHistory.length -1);


      setOpenedFilesState(prev => new Map(prev).set(filePath, {
        ...fileNodeFromSystem,
        content: liveEditingHistory[liveHistoryIndex] || '', 
        contentHistory: liveEditingHistory,
        historyIndex: liveHistoryIndex
      }));
      setActiveFilePathState(filePath);
    }
  }, [getFileSystemNode, openedFiles, activeFilePath]);


  const closeFile = useCallback((filePath: string) => {
    const fileToClose = openedFiles.get(filePath);
    if (fileToClose && fileToClose.type === 'file') {
        const persistedNode = getFileSystemNode(filePath);
        const persistedContent = (persistedNode && !Array.isArray(persistedNode) && persistedNode.type === 'file') ? persistedNode.content : undefined;
        if (fileToClose.content !== persistedContent) {
            if (!window.confirm(`"${fileToClose.name}" has unsaved changes. Are you sure you want to close it without saving?`)) {
                return; 
            }
        }
    }

    setOpenedFilesState(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      if (activeFilePath === filePath) {
        const remainingKeys = Array.from(newMap.keys());
        setActiveFilePathState(remainingKeys.length > 0 ? remainingKeys[0] : null);
      }
      return newMap;
    });
  }, [openedFiles, activeFilePath, getFileSystemNode]);

  const setActiveFilePath = useCallback((path: string | null) => {
    setActiveFilePathState(path);
  }, []);

  const updateFileContent = useCallback((filePath: string, newContent: string) => {
    setOpenedFilesState(prevMap => {
      const newMap = new Map(prevMap);
      const file = newMap.get(filePath);
      if (file && file.type === 'file') {
        let history = file.contentHistory ? [...file.contentHistory] : [file.content || ''];
        let index = file.historyIndex !== undefined ? file.historyIndex : Math.max(0, history.length - 1);

        if (history.length === 0 || history[index] !== newContent) {
            if (index < history.length - 1) {
                history = history.slice(0, index + 1);
            }
            history.push(newContent);
            index++; 
        }
        if (history.length > MAX_HISTORY_LENGTH) {
          const itemsToRemove = history.length - MAX_HISTORY_LENGTH;
          history.splice(0, itemsToRemove);
          index = Math.max(0, index - itemsToRemove); 
        }

        const updatedFile = { ...file, content: newContent, contentHistory: history, historyIndex: index };
        newMap.set(filePath, updatedFile);
      }
      return newMap;
    });
  }, []);

  const saveFile = useCallback((filePath: string, contentToSave: string) => {
    setFileSystemState(prevFs => {
        const updateNodeInFS = (nodes: FileSystemNode[]): FileSystemNode[] => {
            return nodes.map(node => {
                if (node.path === filePath && node.type === 'file') {
                    return {
                        ...node,
                        content: contentToSave,
                        contentHistory: [contentToSave], 
                        historyIndex: 0
                    };
                }
                if (node.children) {
                    return { ...node, children: updateNodeInFS(node.children) };
                }
                return node;
            });
        };
        return updateNodeInFS(prevFs);
    });
    setOpenedFilesState(prevOpened => {
        const newOpened = new Map(prevOpened);
        const openedFile = newOpened.get(filePath);
        if (openedFile && openedFile.type === 'file') {
            newOpened.set(filePath, {
                ...openedFile,
                content: contentToSave, 
                contentHistory: [contentToSave],
                historyIndex: 0,
            });
        }
        return newOpened;
    });
  }, []);


  const undoContentChange = useCallback((filePath: string) => {
    setOpenedFilesState(prevMap => {
        const newMap = new Map(prevMap);
        const file = newMap.get(filePath);
        if (file && file.type === 'file' && file.contentHistory && file.historyIndex !== undefined && file.historyIndex > 0) {
            const newIndex = file.historyIndex - 1;
            const newContent = file.contentHistory[newIndex];
            const updatedFile = { ...file, content: newContent, historyIndex: newIndex };
            newMap.set(filePath, updatedFile);
        }
        return newMap;
    });
  }, []);

  const redoContentChange = useCallback((filePath: string) => {
    setOpenedFilesState(prevMap => {
        const newMap = new Map(prevMap);
        const file = newMap.get(filePath);
        if (file && file.type === 'file' && file.contentHistory && file.historyIndex !== undefined && file.historyIndex < file.contentHistory.length - 1) {
            const newIndex = file.historyIndex + 1;
            const newContent = file.contentHistory[newIndex];
            const updatedFile = { ...file, content: newContent, historyIndex: newIndex };
            newMap.set(filePath, updatedFile);
        }
        return newMap;
    });
  }, []);


  const addNode = useCallback((parentId: string | null, name: string, type: 'file' | 'folder', currentDirectoryPath: string = '/'): FileSystemNode | null => {
    let addedNodeInstance: FileSystemNode | null = null;

    setFileSystemState(prevFileSystem => {
      const newFs = JSON.parse(JSON.stringify(prevFileSystem)); 
      let parentNode: FileSystemNode | undefined;
      let parentPathForNewNode: string;

      if (parentId) { 
          const findParentById = (nodes: FileSystemNode[], id: string): FileSystemNode | undefined => {
            for (const n of nodes) { if (n.id === id) return n; if (n.children) { const found = findParentById(n.children, id); if (found) return found; } } return undefined;
          };
          parentNode = findParentById(newFs, parentId);
          if (!parentNode || parentNode.type !== 'folder') { 
            parentNode = undefined; 
            parentPathForNewNode = currentDirectoryPath === '/' ? '' : currentDirectoryPath; 
          } else {
            parentPathForNewNode = parentNode.path; 
          }
      } else { 
          parentPathForNewNode = currentDirectoryPath === '/' ? '' : currentDirectoryPath;
          parentNode = undefined; 
          if (currentDirectoryPath !== '/') {
            const findTargetDirNode = (nodes: FileSystemNode[], path: string): FileSystemNode | undefined => {
                 for (const n of nodes) { if (n.path === path && n.type === 'folder') return n; if (n.children) { const found = findTargetDirNode(n.children, path); if (found) return found; } } return undefined;
            }
            const targetDirNode = findTargetDirNode(newFs, currentDirectoryPath);
            if (targetDirNode) { 
                parentNode = targetDirNode;
                parentPathForNewNode = targetDirNode.path; 
            } else if (currentDirectoryPath !== '/'){ 
                console.error(`addNode: Parent directory ${currentDirectoryPath} not found for adding ${name}. Defaulting to root.`);
                parentPathForNewNode = ''; 
            }
          }
      }

      let baseName = name; let extension = "";
      if (type === 'file') {
        const lastDotIndex = baseName.lastIndexOf('.');
        if (lastDotIndex > 0) { 
          extension = baseName.substring(lastDotIndex);
          baseName = baseName.substring(0, lastDotIndex);
        } else if (lastDotIndex === -1 && baseName !== "" && baseName.startsWith('.')) { 
        } else if (lastDotIndex === -1 && baseName !== "") { 
        }
      }
      if (baseName.trim() === "" && type === 'file' && !extension.startsWith('.')) baseName = "UntitledFile";
      if (baseName.trim() === "" && type === 'folder') baseName = "NewFolder";
      
      let finalName = type === 'file' ? (baseName.startsWith('.') ? baseName : baseName + extension) : baseName;
      if (finalName === "") finalName = type === 'file' ? "UntitledFile" : "NewFolder";


      let counter = 1;
      const targetChildrenArray = parentNode ? parentNode.children || [] : newFs; 
      const nameExists = (nameToCheck: string) => targetChildrenArray.some(child => child.name === nameToCheck);

      let tempFinalName = finalName;
      while (nameExists(tempFinalName)) {
        if (type === 'file') {
            if (baseName.startsWith('.')) { 
                tempFinalName = `${baseName}(${counter})`;
            } else { 
                tempFinalName = `${baseName}(${counter})${extension}`;
            }
        } else { 
            tempFinalName = `${baseName}(${counter})`;
        }
        counter++;
      }
      finalName = tempFinalName;

      let newPath = (parentPathForNewNode === '' || parentPathForNewNode === '/' ? '' : parentPathForNewNode) + '/' + finalName;
      if (newPath.startsWith('//')) newPath = newPath.substring(1); 


      const newNodeId = generateId();
      const initialContent = type === 'file' ? '' : undefined;
      addedNodeInstance = {
        id: newNodeId, name: finalName, type, path: newPath,
        children: type === 'folder' ? [] : undefined,
        content: initialContent
      };
      if (type === 'file') {
        addedNodeInstance.contentHistory = [initialContent || ''];
        addedNodeInstance.historyIndex = 0;
      }

      if (parentNode) { 
        parentNode.children = [...(parentNode.children || []), addedNodeInstance!]; 
        const updateParentInTree = (nodes: FileSystemNode[]): FileSystemNode[] => {
            return nodes.map(n => {
                if (n.id === parentNode!.id) return parentNode!; 
                if (n.children) n.children = updateParentInTree(n.children);
                return n;
            });
        };
        return updateParentInTree(newFs);
      } else { 
        return [...newFs, addedNodeInstance!];
      }
    });
    return addedNodeInstance;
  }, []);

  const deleteNode = useCallback((nodeIdOrPath: string): boolean => {
    let success = false; let nodeToDeleteRefForClosing: FileSystemNode | undefined;
    setFileSystemState(prevFs => {
        const newFsDeepClone = JSON.parse(JSON.stringify(prevFs)); let parentOfDeletedNode: FileSystemNode | null = null; let nodeToDeleteInClone: FileSystemNode | undefined; let newFsStructure: FileSystemNode[];
        const findNodeAndParentRecursive = (nodes: FileSystemNode[], targetIdOrPath: string, parent: FileSystemNode | null): { node: FileSystemNode | undefined, parent: FileSystemNode | null } => { for (const node of nodes) { if (node.id === targetIdOrPath || node.path === targetIdOrPath) return { node, parent }; if (node.children) { const found = findNodeAndParentRecursive(node.children, targetIdOrPath, node); if (found.node) return found; } } return { node: undefined, parent: null }; };
        const { node: foundNodeFromClone, parent: foundParentFromClone } = findNodeAndParentRecursive(newFsDeepClone, nodeIdOrPath, null); nodeToDeleteInClone = foundNodeFromClone; parentOfDeletedNode = foundParentFromClone;
        const findOriginalNode = (nodes: FileSystemNode[], targetIdOrPath: string): FileSystemNode | undefined => { for (const node of nodes) { if (node.id === targetIdOrPath || node.path === targetIdOrPath) return node; if (node.children) { const found = findOriginalNode(node.children, targetIdOrPath); if (found) return found; } } return undefined; } 
        nodeToDeleteRefForClosing = findOriginalNode(prevFs, nodeIdOrPath); 
        if (!nodeToDeleteInClone) { console.error("Node to delete not found:", nodeIdOrPath); success = false; return prevFs; }
        if (parentOfDeletedNode && parentOfDeletedNode.children) { parentOfDeletedNode.children = parentOfDeletedNode.children.filter(child => child.id !== nodeToDeleteInClone!.id); newFsStructure = newFsDeepClone;
        } else { newFsStructure = newFsDeepClone.filter(n => n.id !== nodeToDeleteInClone!.id); } 
        success = true; return newFsStructure;
    });
    if (success && nodeToDeleteRefForClosing) {
        const pathsToClose: string[] = []; const collectPathsRecursive = (n: FileSystemNode) => { if (n.type === 'file') pathsToClose.push(n.path); if (n.children) n.children.forEach(collectPathsRecursive); };
        if (nodeToDeleteRefForClosing.type === 'file') { pathsToClose.push(nodeToDeleteRefForClosing.path); } else if (nodeToDeleteRefForClosing.type === 'folder' && nodeToDeleteRefForClosing.children) { collectPathsRecursive(nodeToDeleteRefForClosing); }
        if (pathsToClose.length > 0) {
            setOpenedFilesState(prevOpened => {
                const newOpened = new Map(prevOpened); let newActivePath = activeFilePath;
                pathsToClose.forEach(p => { newOpened.delete(p); if (activeFilePath === p) newActivePath = null; }); 
                if (newActivePath === null && newOpened.size > 0) newActivePath = Array.from(newOpened.keys())[0]; 
                if (newActivePath !== activeFilePath) setActiveFilePathState(newActivePath); 
                return newOpened;
            });
        } else if (nodeToDeleteRefForClosing.type === 'folder' && activeFilePath && activeFilePath.startsWith(nodeToDeleteRefForClosing.path + '/')) { 
             const currentOpenedKeys = Array.from(openedFiles.keys()); const remainingKeys = currentOpenedKeys.filter(k => !k.startsWith(nodeToDeleteRefForClosing!.path + '/')); const newActivePath = remainingKeys.length > 0 ? remainingKeys[0] : null; if (newActivePath !== activeFilePath) setActiveFilePathState(newActivePath);
        }
    }
    return success;
  }, [activeFilePath, openedFiles, setActiveFilePathState]); 

  const renameNode = useCallback((nodeId: string, newName: string): boolean => {
    let oldPath = ""; let newPath = ""; let nodeType: 'file' | 'folder' | undefined = undefined; let success = false;
    const cleanNewNameInput = newName.trim(); if (!cleanNewNameInput) { console.error("Invalid new name: cannot be empty or just whitespace."); return false; }
    if (/[\\/:\*\?"<>\|]/.test(cleanNewNameInput)) { console.error("Invalid new name: contains forbidden characters."); return false; } 

    setFileSystemState(prevFs => {
      const newFs = JSON.parse(JSON.stringify(prevFs)); 
      const updateChildrenPathsRecursive = (currentProcessingNode: FileSystemNode, _oldParentPath: string, newParentPathForChildren: string) => {
        if (currentProcessingNode.type === 'folder' && currentProcessingNode.children) {
          currentProcessingNode.children.forEach(child => {
            const childName = child.path.substring(child.path.lastIndexOf('/') + 1);
            child.path = (newParentPathForChildren === '/' ? '' : newParentPathForChildren) + '/' + childName;
            if (child.path.startsWith('//')) child.path = child.path.substring(1); 
            updateChildrenPathsRecursive(child, _oldParentPath + '/' + childName, child.path);
          });
        }
      };
      let parentOfTargetNode: FileSystemNode | null = null;
      const findAndRename = (nodes: FileSystemNode[], currentParent: FileSystemNode | null, parentPathSegment: string): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === nodeId) {
            parentOfTargetNode = currentParent; 
            const siblings = parentOfTargetNode ? parentOfTargetNode.children || [] : newFs; 
            if (siblings.some(sibling => sibling.id !== nodeId && sibling.name === cleanNewNameInput)) { console.error(`Node "${cleanNewNameInput}" already exists in this directory.`); success = false; return true;  }

            oldPath = node.path; 
            nodeType = node.type;
            node.name = cleanNewNameInput; 
            node.path = (parentPathSegment === '' || parentPathSegment === '/' ? '' : parentPathSegment) + '/' + cleanNewNameInput;
            if (node.path.startsWith('//')) node.path = node.path.substring(1); 
            newPath = node.path; 

            if (node.type === 'folder' && node.children) { 
              updateChildrenPathsRecursive(node, oldPath, newPath);
            }
            success = true;
            return true; 
          }
          if (node.children && findAndRename(node.children, node, node.path)) return true; 
        }
        return false; 
      };

      findAndRename(newFs, null, ''); 
      return success ? newFs : prevFs; 
    });

    if (success && oldPath && newPath && nodeType) {
      setOpenedFilesState(prevOpened => {
        const newOpenedMap = new Map<string, FileSystemNode>();
        let newActiveFilePath = activeFilePath; 

        prevOpened.forEach((openedNodeValue, openedNodeKey) => {
          if (openedNodeKey === oldPath) { 
            const updatedNode = { ...openedNodeValue, name: cleanNewNameInput, path: newPath };
            newOpenedMap.set(newPath, updatedNode);
            if (activeFilePath === oldPath) newActiveFilePath = newPath; 
          } else if (nodeType === 'folder' && openedNodeKey.startsWith(oldPath + '/')) { 
            const relativePath = openedNodeKey.substring(oldPath.length); 
            const updatedChildPath = newPath + relativePath;
            const updatedNode = { ...openedNodeValue, path: updatedChildPath };
            newOpenedMap.set(updatedChildPath, updatedNode);
            if (activeFilePath === openedNodeKey) newActiveFilePath = updatedChildPath; 
          } else { 
            newOpenedMap.set(openedNodeKey, openedNodeValue);
          }
        });
        if (newActiveFilePath !== activeFilePath) setActiveFilePathState(newActiveFilePath); 
        return newOpenedMap;
      });
    }
    return success;
  }, [activeFilePath, setActiveFilePathState]); 

  const moveNode = useCallback((draggedNodeId: string, targetParentFolderId: string | null) => {
    let oldPathForDraggedNode = '';
    let newPathForDraggedNode = '';
    let movedNodeReference: FileSystemNode | null = null; 

    setFileSystemState(prevFs => {
        const newFs = JSON.parse(JSON.stringify(prevFs)); 
        let draggedNode: FileSystemNode | null = null;
        let sourceParentNode: FileSystemNode | null = null;

        function findAndDetachRecursive(nodes: FileSystemNode[], parent: FileSystemNode | null): FileSystemNode | null {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === draggedNodeId) {
                    const nodeToDrag = { ...nodes[i] }; 
                    sourceParentNode = parent;
                    nodes.splice(i, 1); 
                    return nodeToDrag;
                }
                if (nodes[i].children) {
                    const found = findAndDetachRecursive(nodes[i].children, nodes[i]);
                    if (found) return found;
                }
            }
            return null;
        }
        draggedNode = findAndDetachRecursive(newFs, null);

        if (!draggedNode) { console.error("Dragged node not found during move:", draggedNodeId); return prevFs; }

        movedNodeReference = JSON.parse(JSON.stringify(draggedNode)); 
        oldPathForDraggedNode = draggedNode.path;

        let targetParentNode: FileSystemNode | null = null;
        if (targetParentFolderId) { 
            function findTargetRecursive(nodes: FileSystemNode[]): FileSystemNode | null {
                for (const node of nodes) {
                    if (node.id === targetParentFolderId && node.type === 'folder') return node;
                    if (node.children) { const found = findTargetRecursive(node.children); if (found) return found; }
                }
                return null;
            }
            targetParentNode = findTargetRecursive(newFs);
            if (!targetParentNode) { 
                console.warn("Target parent folder not found or is not a folder:", targetParentFolderId, "Reverting move."); 
                if (sourceParentNode && sourceParentNode.children) sourceParentNode.children.push(draggedNode);
                else if (!sourceParentNode) newFs.push(draggedNode); 
                return prevFs; 
            }
        }
        
        if (draggedNode.type === 'folder' && targetParentNode) {
            let currentCheckNodePath = targetParentNode.path;
            while (currentCheckNodePath !== '/') { 
                if (currentCheckNodePath === draggedNode.path) { 
                    console.error("Cannot move a folder into itself or one of its descendants.");
                    if (sourceParentNode && sourceParentNode.children) sourceParentNode.children.push(draggedNode);
                    else if (!sourceParentNode) newFs.push(draggedNode);
                    return prevFs; 
                }
                const parentPathIndex = currentCheckNodePath.lastIndexOf('/');
                if (parentPathIndex === -1) break; 
                currentCheckNodePath = parentPathIndex === 0 ? '/' : currentCheckNodePath.substring(0, parentPathIndex);
            }
             if (currentCheckNodePath === draggedNode.path) { 
                  console.error("Cannot move a folder into itself.");
                  if (sourceParentNode && sourceParentNode.children) sourceParentNode.children.push(draggedNode);
                  else if (!sourceParentNode) newFs.push(draggedNode);
                  return prevFs;
             }
        }


        const destinationArray = targetParentNode ? (targetParentNode.children || []) : newFs;
        let newProposedName = draggedNode.name;
        let tempCounter = 1;
        const originalNameParts = newProposedName.split('.');
        const originalExtension = draggedNode.type === 'file' && originalNameParts.length > 1 && originalNameParts[0] !== "" ? '.' + originalNameParts.pop()! : '';
        let originalBaseName = draggedNode.type === 'file' ? (originalNameParts[0] === "" && originalNameParts.length === 1 ? newProposedName : originalNameParts.join('.')) : newProposedName;
         if (draggedNode.type === 'file' && newProposedName.startsWith('.') && !originalExtension) { 
            originalBaseName = newProposedName;
        }


        while (destinationArray.some(child => child.name === newProposedName && child.id !== draggedNode!.id)) { 
             if (draggedNode.type === 'file') {
                if (originalBaseName.startsWith('.')) { 
                    newProposedName = `${originalBaseName}(${tempCounter})`;
                } else {
                    newProposedName = `${originalBaseName}(${tempCounter})${originalExtension}`;
                }
            } else { 
                newProposedName = `${originalBaseName}(${tempCounter})`;
            }
            tempCounter++;
        }
        draggedNode.name = newProposedName; 

        const newParentPathSegment = targetParentNode ? targetParentNode.path : ''; 
        function updatePathsRecursive(nodeToUpdate: FileSystemNode, newPathPrefix: string) {
            const nodeName = nodeToUpdate.name; 
            nodeToUpdate.path = (newPathPrefix === '/' || newPathPrefix === '' ? '' : newPathPrefix) + '/' + nodeName;
            if (nodeToUpdate.path.startsWith('//')) nodeToUpdate.path = nodeToUpdate.path.substring(1); 
            
            if (nodeToUpdate.id === draggedNodeId) {
                newPathForDraggedNode = nodeToUpdate.path;
                movedNodeReference = JSON.parse(JSON.stringify(nodeToUpdate)); 
            }

            if (nodeToUpdate.type === 'folder' && nodeToUpdate.children) {
                nodeToUpdate.children.forEach(child => updatePathsRecursive(child, nodeToUpdate.path));
            }
        }
        updatePathsRecursive(draggedNode, newParentPathSegment);


        if (targetParentNode) {
            if (!targetParentNode.children) targetParentNode.children = [];
            targetParentNode.children.push(draggedNode);
        } else { 
            newFs.push(draggedNode);
        }
        return newFs;
    });

    if (oldPathForDraggedNode && newPathForDraggedNode && oldPathForDraggedNode !== newPathForDraggedNode && movedNodeReference) {
        setOpenedFilesState(prevOpened => {
            const newOpenedMap = new Map<string, FileSystemNode>();
            let newActiveFilePathStateCandidate = activeFilePath; 

            prevOpened.forEach((openedNodeValue, openedNodeKey) => {
                if (movedNodeReference?.type === 'file' && openedNodeKey === oldPathForDraggedNode) {
                    const updatedOpenedFile = { ...openedNodeValue, path: newPathForDraggedNode, name: movedNodeReference.name };
                    newOpenedMap.set(newPathForDraggedNode, updatedOpenedFile);
                    if (activeFilePath === oldPathForDraggedNode) newActiveFilePathStateCandidate = newPathForDraggedNode;
                } else if (movedNodeReference?.type === 'folder' && openedNodeKey.startsWith(oldPathForDraggedNode + '/')) {
                    const relativePath = openedNodeKey.substring(oldPathForDraggedNode.length); 
                    const newChildPath = newPathForDraggedNode + relativePath;
                    const updatedOpenedFile = { ...openedNodeValue, path: newChildPath };
                    newOpenedMap.set(newChildPath, updatedOpenedFile);
                    if (activeFilePath === openedNodeKey) newActiveFilePathStateCandidate = newChildPath;
                } else {
                    newOpenedMap.set(openedNodeKey, openedNodeValue);
                }
            });

            if (newActiveFilePathStateCandidate !== activeFilePath) {
                setActiveFilePathState(newActiveFilePathStateCandidate);
            }
            return newOpenedMap;
        });
    }
  }, [activeFilePath, setActiveFilePathState, setOpenedFilesState]); 

  const analyzeFileSystemStructure = useCallback((nodes: FileSystemNode[]): {
    totalFiles: number;
    totalFolders: number;
    fileTypes: Record<string, number>;
    hasPackageJson: boolean;
    hasReadme: boolean;
    hasGitIgnore: boolean;
    hasSrcFolder: boolean;
    hasTestFolder: boolean;
    maxDepth: number;
  } => {
    let totalFiles = 0;
    let totalFolders = 0;
    const fileTypes: Record<string, number> = {};
    let hasPackageJson = false;
    let hasReadme = false;
    let hasGitIgnore = false;
    let hasSrcFolder = false;
    let hasTestFolder = false;
    let maxDepth = 0;
    
    function analyze(currentNodes: FileSystemNode[], depth: number = 0) {
      maxDepth = Math.max(maxDepth, depth);
      
      currentNodes.forEach(node => {
        if (node.type === 'file') {
          totalFiles++;
          const extension = node.name.split('.').pop()?.toLowerCase() || 'no-extension';
          fileTypes[extension] = (fileTypes[extension] || 0) + 1;
          
          if (node.name === 'package.json') hasPackageJson = true;
          if (node.name.toLowerCase().includes('readme')) hasReadme = true;
          if (node.name === '.gitignore') hasGitIgnore = true;
        } else {
          totalFolders++;
          if (node.name === 'src') hasSrcFolder = true;
          if (node.name === 'test' || node.name === 'tests' || node.name === '__tests__') hasTestFolder = true;
          
          if (node.children) {
            analyze(node.children, depth + 1);
          }
        }
      });
    }
    analyze(nodes);
    return { totalFiles, totalFolders, fileTypes, hasPackageJson, hasReadme, hasGitIgnore, hasSrcFolder, hasTestFolder, maxDepth };
  }, []);


  const contextValue = useMemo(() => ({
    fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile,
    updateFileContent, saveFile,
    getFileSystemNode, addNode, deleteNode, renameNode, moveNode, replaceWorkspace,
    isBusy, nodeToAutoRenameId, setNodeToAutoRenameId,
    undoContentChange, redoContentChange,
    accentColor, setAccentColor,
    toast, // Ensure toast is included in the context value
    analyzeFileSystemStructure,
  }), [
    fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile,
    updateFileContent, saveFile,
    getFileSystemNode, addNode, deleteNode, renameNode, moveNode, replaceWorkspace,
    isBusy, nodeToAutoRenameId, setNodeToAutoRenameId,
    undoContentChange, redoContentChange,
    accentColor, setAccentColor,
    toast, // And in its dependency array
    analyzeFileSystemStructure,
  ]);

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) throw new Error('useIde must be used within an IdeProvider');
  return context;
}

