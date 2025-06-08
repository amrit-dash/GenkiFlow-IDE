
"use client";

import type React from 'react';
import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type { FileSystemNode } from '@/lib/types';
import { mockFileSystem } from '@/lib/mock-data';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

// LocalStorage keys
const FS_STORAGE_KEY = 'genkiflowIdeFileSystem';
const OPENED_FILES_STORAGE_KEY = 'genkiflowIdeOpenedFiles';
const ACTIVE_FILE_STORAGE_KEY = 'genkiflowIdeActiveFile';

interface IdeState {
  fileSystem: FileSystemNode[];
  openedFiles: Map<string, FileSystemNode>; // path -> FileSystemNode
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  openFile: (filePath: string) => void;
  closeFile: (filePath: string) => void;
  updateFileContent: (filePath: string, newContent: string) => void;
  getFileSystemNode: (path: string) => FileSystemNode | undefined;
  addNode: (parentId: string | null, name: string, type: 'file' | 'folder', currentDirectoryPath?: string) => FileSystemNode | null;
  deleteNode: (nodeIdOrPath: string) => boolean;
  renameNode: (nodeId: string, newName: string) => boolean;
  isBusy: boolean; // To indicate background activity like loading from localStorage
  nodeToAutoRenameId: string | null;
  setNodeToAutoRenameId: (id: string | null) => void;
}

const IdeContext = createContext<IdeState | undefined>(undefined);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem, setFileSystemState] = useState<FileSystemNode[]>(mockFileSystem);
  const [openedFiles, setOpenedFilesState] = useState<Map<string, FileSystemNode>>(new Map());
  const [activeFilePath, setActiveFilePathState] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [nodeToAutoRenameId, setNodeToAutoRenameIdState] = useState<string | null>(null);

  // Load from localStorage on initial mount
  useEffect(() => {
    setIsBusy(true);
    try {
      const storedFs = localStorage.getItem(FS_STORAGE_KEY);
      if (storedFs) {
        setFileSystemState(JSON.parse(storedFs));
      } else {
        setFileSystemState(mockFileSystem); // Initialize with mock if nothing stored
      }

      const storedOpenedFiles = localStorage.getItem(OPENED_FILES_STORAGE_KEY);
      if (storedOpenedFiles) {
        const parsedOpenedFiles: [string, FileSystemNode][] = JSON.parse(storedOpenedFiles);
        setOpenedFilesState(new Map(parsedOpenedFiles));
      }

      const storedActiveFile = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
      if (storedActiveFile && storedActiveFile !== "null") {
        setActiveFilePathState(storedActiveFile);
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      setFileSystemState(mockFileSystem); // Fallback to mock data on error
      setOpenedFilesState(new Map());
      setActiveFilePathState(null);
    }
    setIsBusy(false);
  }, []);

  // Save to localStorage whenever relevant state changes
  useEffect(() => {
    if (isBusy) return; // Don't save while initially loading
    try {
      localStorage.setItem(FS_STORAGE_KEY, JSON.stringify(fileSystem));
      localStorage.setItem(OPENED_FILES_STORAGE_KEY, JSON.stringify(Array.from(openedFiles.entries())));
      localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, activeFilePath || "null");
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [fileSystem, openedFiles, activeFilePath, isBusy]);

  const setNodeToAutoRenameId = useCallback((id: string | null) => {
    setNodeToAutoRenameIdState(id);
  }, []);

  const getFileSystemNode = useCallback((pathOrId: string): FileSystemNode | undefined => {
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
    return findNode(fileSystem, pathOrId);
  }, [fileSystem]);

  const openFile = useCallback((filePath: string) => {
    if (openedFiles.has(filePath)) {
      setActiveFilePathState(filePath);
      return;
    }
    const node = getFileSystemNode(filePath);
    if (node && node.type === 'file') {
      setOpenedFilesState(prev => new Map(prev).set(filePath, { ...node }));
      setActiveFilePathState(filePath);
    }
  }, [getFileSystemNode, openedFiles]);

  const closeFile = useCallback((filePath: string) => {
    setOpenedFilesState(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      if (activeFilePath === filePath) {
        const remainingKeys = Array.from(newMap.keys());
        setActiveFilePathState(remainingKeys.length > 0 ? remainingKeys[0] : null);
      }
      return newMap;
    });
  }, [activeFilePath]);
  
  const setActiveFilePath = useCallback((path: string | null) => {
    setActiveFilePathState(path);
  }, []);

  const updateFileContent = useCallback((filePath: string, newContent: string) => {
    let updatedInOpenedFiles = false;
    setOpenedFilesState(prev => {
      const newMap = new Map(prev);
      const file = newMap.get(filePath);
      if (file) {
        newMap.set(filePath, { ...file, content: newContent });
        updatedInOpenedFiles = true;
      }
      return newMap;
    });

    if (updatedInOpenedFiles) {
      setFileSystemState(prevFs => {
          const updateNodeContent = (nodes: FileSystemNode[]): FileSystemNode[] => {
              return nodes.map(node => {
                  if (node.path === filePath && node.type === 'file') {
                      return { ...node, content: newContent };
                  }
                  if (node.children) {
                      return { ...node, children: updateNodeContent(node.children) };
                  }
                  return node;
              });
          };
          return updateNodeContent(prevFs);
      });
    }
  }, []);

  const addNode = useCallback((parentId: string | null, name: string, type: 'file' | 'folder', currentDirectoryPath: string = '/'): FileSystemNode | null => {
    let addedNodeInstance: FileSystemNode | null = null;

    setFileSystemState(prevFileSystem => {
      const newFs = JSON.parse(JSON.stringify(prevFileSystem)); 
      
      let parentNode: FileSystemNode | undefined;
      let parentPathForNewNode: string;

      if (parentId) {
          const findParentById = (nodes: FileSystemNode[], id: string): FileSystemNode | undefined => {
            for (const n of nodes) {
                if (n.id === id) return n;
                if (n.children) {
                    const found = findParentById(n.children, id);
                    if (found) return found;
                }
            }
            return undefined;
          };
          parentNode = findParentById(newFs, parentId);
          if (!parentNode || parentNode.type !== 'folder') {
              console.error("Parent not found or is not a folder for ID:", parentId);
              parentNode = undefined; 
              parentPathForNewNode = ''; 
          } else {
              parentPathForNewNode = parentNode.path;
          }
      } else { 
          if (currentDirectoryPath && currentDirectoryPath !== '/') {
            const findParentByPath = (nodes: FileSystemNode[], path: string): FileSystemNode | undefined => {
              for (const n of nodes) {
                  if (n.path === path && n.type === 'folder') return n;
                  if (n.children) {
                      const found = findParentByPath(n.children, path);
                      if (found) return found;
                  }
              }
              return undefined;
            };
            parentNode = findParentByPath(newFs, currentDirectoryPath);
            if (!parentNode) {
                console.error("Specified current directory path for addNode not found:", currentDirectoryPath);
                parentPathForNewNode = ''; 
            } else {
                parentPathForNewNode = parentNode.path;
            }
          } else { 
            parentPathForNewNode = ''; 
            parentNode = undefined; 
          }
      }
      
      // Generate unique default name
      let baseName = name; // Use the provided name as base (e.g., "UntitledFile", "NewFolder")
      const extension = type === 'file' && baseName.includes('.') ? baseName.substring(baseName.lastIndexOf('.')) : (type === 'file' ? ".tsx" : "");
      if (type === 'file' && !baseName.endsWith(extension) && extension) {
         baseName = baseName.replace(extension, "") + extension;
      } else if (type === 'file' && !baseName.includes('.')) {
         baseName += ".tsx"; // Default extension if none provided
      }


      let finalName = baseName;
      let counter = 1;
      const targetChildrenArray = parentNode ? parentNode.children || [] : newFs;

      // Adjust for files that might not have an extension in baseName initially
      const nameToCheck = (n: string) => n;

      while (targetChildrenArray.some(child => child.name === nameToCheck(finalName) )) {
          if (type === 'file') {
            const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf(extension) > -1 ? baseName.lastIndexOf(extension) : baseName.length);
            finalName = `${nameWithoutExt}(${counter})${extension}`;
          } else {
            finalName = `${baseName}(${counter})`;
          }
          counter++;
      }

      const newPath = (parentPathForNewNode === '' || parentPathForNewNode === '/' ? '' : parentPathForNewNode) + '/' + finalName;
      
      if (targetChildrenArray.some(child => child.name === finalName && child.id !== parentId)) { // check for existing name again (mainly for root)
          console.error(`Node with name "${finalName}" already exists in "${parentPathForNewNode || '/'}".`);
          addedNodeInstance = null; 
          return prevFileSystem; 
      }

      const newNodeId = generateId();
      addedNodeInstance = {
        id: newNodeId,
        name: finalName,
        type,
        path: newPath,
        children: type === 'folder' ? [] : undefined,
        content: type === 'file' ? '' : undefined,
      };

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
    let success = false;
    let nodeToDeleteRef: FileSystemNode | undefined; // To hold reference for closing files

    setFileSystemState(prevFs => {
        const newFsDeepClone = JSON.parse(JSON.stringify(prevFs)); // Deep clone at the start
        let parentOfDeletedNode: FileSystemNode | null = null;
        let newFsStructure: FileSystemNode[];

        const findNodeAndParentRecursive = (
          nodes: FileSystemNode[], 
          targetIdOrPath: string, 
          parent: FileSystemNode | null
        ): { node: FileSystemNode | undefined, parent: FileSystemNode | null } => {
            for (const node of nodes) {
                if (node.id === targetIdOrPath || node.path === targetIdOrPath) {
                    return { node, parent };
                }
                if (node.children) {
                    const found = findNodeAndParentRecursive(node.children, targetIdOrPath, node);
                    if (found.node) return found;
                }
            }
            return { node: undefined, parent: null };
        };
        
        const { node: foundNode, parent: foundParent } = findNodeAndParentRecursive(newFsDeepClone, nodeIdOrPath, null);
        nodeToDeleteRef = getFileSystemNode(nodeIdOrPath); // Get original node for path info before modification
        let nodeToDeleteInClone = foundNode; // This is the node from the cloned structure
        parentOfDeletedNode = foundParent;


        if (!nodeToDeleteInClone) {
            console.error("Node to delete not found in cloned structure:", nodeIdOrPath);
            success = false;
            return prevFs; 
        }
        
        if (parentOfDeletedNode && parentOfDeletedNode.children) {
            parentOfDeletedNode.children = parentOfDeletedNode.children.filter(child => child.id !== nodeToDeleteInClone!.id);
            newFsStructure = newFsDeepClone; 
        } else { 
            newFsStructure = newFsDeepClone.filter(n => n.id !== nodeToDeleteInClone!.id);
        }
        success = true;
        return newFsStructure;
    });

    if (success && nodeToDeleteRef) {
        const pathsToClose: string[] = [];
        const collectPathsRecursive = (n: FileSystemNode) => {
            if (n.type === 'file') pathsToClose.push(n.path);
            if (n.children) n.children.forEach(collectPathsRecursive);
        };

        if (nodeToDeleteRef.type === 'file') {
            pathsToClose.push(nodeToDeleteRef.path);
        } else if (nodeToDeleteRef.type === 'folder' && nodeToDeleteRef.children) {
            collectPathsRecursive(nodeToDeleteRef);
        }
        
        if (pathsToClose.length > 0) {
            setOpenedFilesState(prevOpened => {
                const newOpened = new Map(prevOpened);
                let newActivePath = activeFilePath;
                pathsToClose.forEach(p => {
                    newOpened.delete(p);
                    if (activeFilePath === p) {
                        newActivePath = null; 
                    }
                });
                if (newActivePath === null && newOpened.size > 0) { 
                    newActivePath = Array.from(newOpened.keys())[0];
                }
                if (newActivePath !== activeFilePath) {
                    setActiveFilePathState(newActivePath);
                }
                return newOpened;
            });
        } else if (nodeToDeleteRef.type === 'folder' && activeFilePath && activeFilePath.startsWith(nodeToDeleteRef.path + '/')) {
             const currentOpenedFiles = Array.from(openedFiles.keys());
             const remainingKeys = currentOpenedFiles.filter(k => !k.startsWith(nodeToDeleteRef!.path + '/'));
             const newActivePath = remainingKeys.length > 0 ? remainingKeys[0] : null;
             if (newActivePath !== activeFilePath) {
                setActiveFilePathState(newActivePath);
             }
        }
    }
    return success;
  }, [activeFilePath, openedFiles, getFileSystemNode]); 
  
  const renameNode = useCallback((nodeId: string, newName: string): boolean => {
    let oldPath = "";
    let newPath = "";
    let nodeType: 'file' | 'folder' | undefined = undefined;
    let success = false;

    const cleanNewName = newName.replace(/[\\/:\*\?"<>\|]/g, '_').trim();
    if (!cleanNewName) {
        console.error("Invalid new name provided.");
        return false;
    }

    setFileSystemState(prevFs => {
      const newFs = JSON.parse(JSON.stringify(prevFs)); 
      
      const updateChildrenPathsRecursive = (parentNode: FileSystemNode) => {
        if (parentNode.type === 'folder' && parentNode.children) {
          parentNode.children.forEach(child => {
            child.path = parentNode.path + '/' + child.name;
            updateChildrenPathsRecursive(child); 
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
            if (siblings.some(sibling => sibling.id !== nodeId && sibling.name === cleanNewName)) {
                console.error(`A node named "${cleanNewName}" already exists in this directory.`);
                success = false;
                return true; 
            }

            oldPath = node.path;
            nodeType = node.type;
            node.name = cleanNewName;
            node.path = (parentPathSegment === '' || parentPathSegment === '/' ? '' : parentPathSegment) + '/' + cleanNewName;
            newPath = node.path;
            
            updateChildrenPathsRecursive(node);
            success = true;
            return true;
          }
          if (node.children && findAndRename(node.children, node, node.path)) {
            return true;
          }
        }
        return false;
      };
      
      if (findAndRename(newFs, null, '')) { 
         return success ? newFs : prevFs; 
      }
      return prevFs; 
    });

    if (success && oldPath && newPath && nodeType) {
      setOpenedFilesState(prevOpened => {
        const newOpenedMap = new Map<string, FileSystemNode>();
        let newActiveFilePath = activeFilePath;

        prevOpened.forEach((openedNodeValue, openedNodeKey) => {
          if (openedNodeKey === oldPath) { 
            const updatedNode = { ...openedNodeValue, name: cleanNewName, path: newPath };
            newOpenedMap.set(newPath, updatedNode);
            if (activeFilePath === oldPath) {
              newActiveFilePath = newPath;
            }
          } else if (nodeType === 'folder' && openedNodeKey.startsWith(oldPath + '/')) { 
            const relativePath = openedNodeKey.substring(oldPath.length); 
            const updatedChildPath = newPath + relativePath;
            const updatedNode = { ...openedNodeValue, path: updatedChildPath };
            newOpenedMap.set(updatedChildPath, updatedNode);
            if (activeFilePath === openedNodeKey) {
              newActiveFilePath = updatedChildPath;
            }
          } else {
            newOpenedMap.set(openedNodeKey, openedNodeValue);
          }
        });
        if (newActiveFilePath !== activeFilePath) setActiveFilePathState(newActiveFilePath);
        return newOpenedMap;
      });
    }
    return success;
  }, [activeFilePath]);

  const contextValue = useMemo(() => ({
    fileSystem,
    openedFiles,
    activeFilePath,
    setActiveFilePath,
    openFile,
    closeFile,
    updateFileContent,
    getFileSystemNode,
    addNode,
    deleteNode,
    renameNode,
    isBusy,
    nodeToAutoRenameId,
    setNodeToAutoRenameId,
  }), [fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent, getFileSystemNode, addNode, deleteNode, renameNode, isBusy, nodeToAutoRenameId, setNodeToAutoRenameId]);

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) {
    throw new Error('useIde must be used within an IdeProvider');
  }
  return context;
}

    