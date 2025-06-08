
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
}

const IdeContext = createContext<IdeState | undefined>(undefined);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem, setFileSystemState] = useState<FileSystemNode[]>(mockFileSystem);
  const [openedFiles, setOpenedFilesState] = useState<Map<string, FileSystemNode>>(new Map());
  const [activeFilePath, setActiveFilePathState] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true); // Busy while loading from localStorage

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
      setOpenedFilesState(prev => new Map(prev).set(filePath, { ...node })); // Store a copy
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
    const newNodeId = generateId();
    let addedNodeInstance: FileSystemNode | null = null;

    const cleanName = name.replace(/[\\/:\*\?"<>\|]/g, '_').trim();
    if (!cleanName) {
        console.error("Invalid node name provided.");
        return null;
    }

    setFileSystemState(prevFileSystem => {
      const newFs = JSON.parse(JSON.stringify(prevFileSystem)); 
      
      let parentNodePath: string;
      let parentNode: FileSystemNode | undefined;

      if (parentId) {
          // Find parent by ID within the current newFs structure
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
              parentNodePath = currentDirectoryPath; 
          } else {
              parentNodePath = parentNode.path;
          }
      } else { 
          parentNodePath = currentDirectoryPath === '/' ? '' : currentDirectoryPath;
      }

      const newPath = (parentNodePath === '' || parentNodePath === '/' ? '' : parentNodePath) + '/' + cleanName;
      
      addedNodeInstance = {
        id: newNodeId,
        name: cleanName,
        type,
        path: newPath,
        children: type === 'folder' ? [] : undefined,
        content: type === 'file' ? '' : undefined,
      };

      if (parentId === null) { // Add to root
        if (newFs.some((node: FileSystemNode) => node.name === cleanName && (node.path === newPath || (node.path.startsWith('/') && node.path.substring(1) === cleanName )))) {
            console.error(`Node with name "${cleanName}" already exists at root.`);
            addedNodeInstance = null; 
            return prevFileSystem;
        }
        return [...newFs, addedNodeInstance];
      }
      
      // If parentId was provided, update its children array
      if (parentNode && parentNode.type === 'folder') {
          if (parentNode.children?.some(child => child.name === cleanName)) {
              console.error(`Node with name "${cleanName}" already exists in folder "${parentNode.name}".`);
              addedNodeInstance = null;
              return prevFileSystem;
          }
          parentNode.children = [...(parentNode.children || []), addedNodeInstance!];
          // Need to update the parentNode in the newFs tree structure
          const updateParentInTree = (nodes: FileSystemNode[]): FileSystemNode[] => {
              return nodes.map(n => {
                  if (n.id === parentNode!.id) return parentNode!; // Replace with the modified parent
                  if (n.children) n.children = updateParentInTree(n.children);
                  return n;
              });
          };
          return updateParentInTree(newFs);
      } else if (parentId) { // Parent ID was given but parent was not found or not a folder
          console.error("Failed to add node: specified parent folder ID not found or invalid.");
          addedNodeInstance = null;
          return prevFileSystem;
      }
      // If parentId is null but we're not adding to root (e.g. from terminal, currentDirectoryPath)
      // This case should be handled by parentId=null logic, or currentDirectoryPath implies finding a parent by path.
      // For simplicity, file explorer gives parentId, terminal gives currentDirectoryPath (which needs to find a parent ID or add to root)
      
      return prevFileSystem; // Should not reach here if logic is correct
    });
    return addedNodeInstance;
  }, []);


  const deleteNode = useCallback((nodeIdOrPath: string): boolean => {
    let nodeToDelete: FileSystemNode | undefined;
    let success = false;

    const findNodeToDeleteRecursive = (nodes: FileSystemNode[], targetIdOrPath: string): FileSystemNode | undefined => {
        for (const node of nodes) {
            if (node.id === targetIdOrPath || node.path === targetIdOrPath) {
                return node;
            }
            if (node.children) {
                const found = findNodeToDeleteRecursive(node.children, targetIdOrPath);
                if (found) return found;
            }
        }
        return undefined;
    };
    // Use a fresh copy of fileSystem for finding, as state might be stale in closure
    setFileSystemState(prevFs => {
        nodeToDelete = findNodeToDeleteRecursive(prevFs, nodeIdOrPath);

        if (!nodeToDelete) {
            console.error("Node to delete not found:", nodeIdOrPath);
            success = false;
            return prevFs;
        }

        const pathsToClose: string[] = [];
        if (nodeToDelete.type === 'file') {
            pathsToClose.push(nodeToDelete.path);
        } else if (nodeToDelete.type === 'folder') {
            const collectPaths = (n: FileSystemNode) => {
                if (n.type === 'file') pathsToClose.push(n.path);
                if (n.children) n.children.forEach(collectPaths);
            };
            if(nodeToDelete.children) collectPaths(nodeToDelete); // Collect paths of children
            // Do not add folder path itself to pathsToClose unless it was explicitly an open "file" context
        }

        const recursivelyDelete = (nodes: FileSystemNode[], targetId: string): FileSystemNode[] => {
            const filtered = nodes.filter(node => {
                if (node.id === targetId) {
                    success = true;
                    return false; 
                }
                return true;
            });
            return filtered.map(node => {
                if (node.children) {
                    return { ...node, children: recursivelyDelete(node.children, targetId) };
                }
                return node;
            });
        };
        
        const newFs = recursivelyDelete(JSON.parse(JSON.stringify(prevFs)), nodeToDelete!.id);

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
        } else if (nodeToDelete.type === 'folder' && activeFilePath && activeFilePath.startsWith(nodeToDelete.path + '/')) {
            // If active file was inside the deleted folder
            const remainingKeys = Array.from(openedFiles.keys()).filter(k => k !== activeFilePath && !k.startsWith(nodeToDelete!.path + '/'));
            setActiveFilePathState(remainingKeys.length > 0 ? remainingKeys[0] : null);
        }
        return newFs;
    });
    return success;
  }, [activeFilePath, openedFiles]); // Added openedFiles to dependency array
  
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
            // Check for name collision in the same directory
            const siblings = parentOfTargetNode ? parentOfTargetNode.children || [] : newFs;
            if (siblings.some(sibling => sibling.id !== nodeId && sibling.name === cleanNewName)) {
                console.error(`A node named "${cleanNewName}" already exists in this directory.`);
                success = false;
                return true; // Abort renaming for this branch
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
  }), [fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent, getFileSystemNode, addNode, deleteNode, renameNode, isBusy]);

  if (isBusy && typeof window !== 'undefined') { // Only show loader on client after initial hydration attempt
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Initializing IDE State...</p>
      </div>
    );
  }

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) {
    throw new Error('useIde must be used within an IdeProvider');
  }
  return context;
}

    