
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
  getFileSystemNode: (pathOrId: string) => FileSystemNode | FileSystemNode[] | undefined; // Can return array for root listing
  addNode: (parentId: string | null, name: string, type: 'file' | 'folder', currentDirectoryPath?: string) => FileSystemNode | null;
  deleteNode: (nodeIdOrPath: string) => boolean;
  renameNode: (nodeId: string, newName: string) => boolean;
  isBusy: boolean;
  nodeToAutoRenameId: string | null;
  setNodeToAutoRenameId: (id: string | null) => void;
}

const IdeContext = createContext<IdeState | undefined>(undefined);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem, setFileSystemState] = useState<FileSystemNode[]>([]); // Start empty, load from mock/LS
  const [openedFiles, setOpenedFilesState] = useState<Map<string, FileSystemNode>>(new Map());
  const [activeFilePath, setActiveFilePathState] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [nodeToAutoRenameId, setNodeToAutoRenameIdState] = useState<string | null>(null);

  useEffect(() => {
    setIsBusy(true);
    try {
      const storedFs = localStorage.getItem(FS_STORAGE_KEY);
      if (storedFs) {
        const parsedFs = JSON.parse(storedFs);
        if (Array.isArray(parsedFs) && parsedFs.length > 0) {
            setFileSystemState(parsedFs);
        } else {
             setFileSystemState(mockFileSystem);
        }
      } else {
        setFileSystemState(mockFileSystem);
      }

      const storedOpenedFiles = localStorage.getItem(OPENED_FILES_STORAGE_KEY);
      if (storedOpenedFiles) {
        const parsedOpenedFiles: [string, FileSystemNode][] = JSON.parse(storedOpenedFiles);
        setOpenedFilesState(new Map(parsedOpenedFiles));
      }

      const storedActiveFile = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
      if (storedActiveFile && storedActiveFile !== "null") {
         const fileExists = (fs: FileSystemNode[], path: string): boolean => {
            for (const node of fs) {
                if (node.path === path && node.type === 'file') return true;
                if (node.children && fileExists(node.children, path)) return true;
            }
            return false;
         }
         const currentFs = storedFs ? JSON.parse(storedFs) : mockFileSystem;
         if (fileExists(currentFs, storedActiveFile)) {
            setActiveFilePathState(storedActiveFile);
         } else {
            setActiveFilePathState(null);
         }
      } else {
        setActiveFilePathState(null);
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      setFileSystemState(mockFileSystem);
      setOpenedFilesState(new Map());
      setActiveFilePathState(null);
    }
    setIsBusy(false);
  }, []);

  useEffect(() => {
    if (isBusy) return;
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
    // If pathOrId is '/' for root listing (e.g. terminal 'ls /'), return the root fileSystem array
    if (pathOrId === '/') {
        const rootNodeCandidate = findNode(fileSystem, pathOrId);
        return rootNodeCandidate && rootNodeCandidate.type === 'folder' ? rootNodeCandidate : fileSystem;
    }
    return findNode(fileSystem, pathOrId);
  }, [fileSystem]);

  const openFile = useCallback((filePath: string) => {
    if (openedFiles.has(filePath)) {
      setActiveFilePathState(filePath);
      return;
    }
    const node = getFileSystemNode(filePath);
    if (node && typeof node === 'object' && !Array.isArray(node) && node.type === 'file') {
      setOpenedFilesState(prev => new Map(prev).set(filePath, { ...(node as FileSystemNode) }));
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
              parentNode = undefined;
              parentPathForNewNode = currentDirectoryPath === '/' ? '' : currentDirectoryPath;
          } else {
              parentPathForNewNode = parentNode.path;
          }
      } else {
          parentPathForNewNode = currentDirectoryPath === '/' ? '' : currentDirectoryPath;
          parentNode = undefined; // Explicitly undefined for root addition
          // Try to find if the currentDirectoryPath itself is a node (e.g. for 'mkdir /newfolder' or 'touch /newfile.txt')
          if (currentDirectoryPath !== '/') {
            const findTargetDirNode = (nodes: FileSystemNode[], path: string): FileSystemNode | undefined => {
                 for (const n of nodes) {
                    if (n.path === path && n.type === 'folder') return n;
                    if (n.children) {
                        const found = findTargetDirNode(n.children, path);
                        if (found) return found;
                    }
                }
                return undefined;
            }
            const targetDirNode = findTargetDirNode(newFs, currentDirectoryPath);
            if (targetDirNode) {
                parentNode = targetDirNode; // Set parentNode if currentDirectoryPath is a valid folder
                parentPathForNewNode = targetDirNode.path;
            } else if (currentDirectoryPath !== '/') { // If currentDirectoryPath is not root and not a valid folder, it's an error handled by terminal
                console.error(`addNode: Parent directory ${currentDirectoryPath} not found for adding ${name}`);
                return prevFileSystem; // No change
            }
          }
      }

      let baseName = name;
      const defaultExtension = ".txt";
      let extension = "";

      if (type === 'file') {
        if (baseName.includes('.')) {
            extension = baseName.substring(baseName.lastIndexOf('.'));
            baseName = baseName.substring(0, baseName.lastIndexOf('.'));
        } else {
            extension = defaultExtension;
        }
      }

      let finalName = type === 'file' ? baseName + extension : baseName;
      let counter = 1;
      const targetChildrenArray = parentNode ? parentNode.children || [] : newFs;

      const nameExists = (nameToCheck: string) => targetChildrenArray.some(child => child.name === nameToCheck);

      while (nameExists(finalName)) {
          finalName = type === 'file' ? `${baseName}(${counter})${extension}` : `${baseName}(${counter})`;
          counter++;
      }

      const newPath = (parentPathForNewNode === '' || parentPathForNewNode === '/' ? '' : parentPathForNewNode) + '/' + finalName;

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
    let nodeToDeleteRefForClosing: FileSystemNode | undefined;

    setFileSystemState(prevFs => {
        const newFsDeepClone = JSON.parse(JSON.stringify(prevFs));
        let parentOfDeletedNode: FileSystemNode | null = null;
        let nodeToDeleteInClone: FileSystemNode | undefined;
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

        const { node: foundNodeFromClone, parent: foundParentFromClone } = findNodeAndParentRecursive(newFsDeepClone, nodeIdOrPath, null);
        nodeToDeleteInClone = foundNodeFromClone;
        parentOfDeletedNode = foundParentFromClone;

        const findOriginalNode = (nodes: FileSystemNode[], targetIdOrPath: string): FileSystemNode | undefined => {
             for (const node of nodes) {
                if (node.id === targetIdOrPath || node.path === targetIdOrPath) return node;
                if (node.children) {
                    const found = findOriginalNode(node.children, targetIdOrPath);
                    if (found) return found;
                }
            }
            return undefined;
        }
        nodeToDeleteRefForClosing = findOriginalNode(prevFs, nodeIdOrPath);


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

    if (success && nodeToDeleteRefForClosing) {
        const pathsToClose: string[] = [];
        const collectPathsRecursive = (n: FileSystemNode) => {
            if (n.type === 'file') pathsToClose.push(n.path);
            if (n.children) n.children.forEach(collectPathsRecursive);
        };

        if (nodeToDeleteRefForClosing.type === 'file') {
            pathsToClose.push(nodeToDeleteRefForClosing.path);
        } else if (nodeToDeleteRefForClosing.type === 'folder' && nodeToDeleteRefForClosing.children) {
            collectPathsRecursive(nodeToDeleteRefForClosing);
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
        } else if (nodeToDeleteRefForClosing.type === 'folder' && activeFilePath && activeFilePath.startsWith(nodeToDeleteRefForClosing.path + '/')) {
             const currentOpenedKeys = Array.from(openedFiles.keys());
             const remainingKeys = currentOpenedKeys.filter(k => !k.startsWith(nodeToDeleteRefForClosing!.path + '/'));
             const newActivePath = remainingKeys.length > 0 ? remainingKeys[0] : null;
             if (newActivePath !== activeFilePath) {
                setActiveFilePathState(newActivePath);
             }
        }
    }
    return success;
  }, [activeFilePath, openedFiles]);

  const renameNode = useCallback((nodeId: string, newName: string): boolean => {
    let oldPath = "";
    let newPath = "";
    let nodeType: 'file' | 'folder' | undefined = undefined;
    let success = false;

    const cleanNewName = newName.replace(/[\\/:\*\?"<>\|\s]/g, '_').trim();
    if (!cleanNewName) {
        console.error("Invalid new name provided (empty or only invalid chars).");
        return false;
    }

    setFileSystemState(prevFs => {
      const newFs = JSON.parse(JSON.stringify(prevFs));

      const updateChildrenPathsRecursive = (parentNode: FileSystemNode, oldParentPath: string, newParentPath: string) => {
        if (parentNode.type === 'folder' && parentNode.children) {
          parentNode.children.forEach(child => {
            const relativePath = child.path.substring(oldParentPath.length +1);
            child.path = newParentPath + '/' + relativePath;
            updateChildrenPathsRecursive(child, oldParentPath + '/' + child.name, newParentPath + '/' + child.name);
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
            const oldNodeName = node.name;
            nodeType = node.type;
            node.name = cleanNewName;
            node.path = (parentPathSegment === '' || parentPathSegment === '/' ? '' : parentPathSegment) + '/' + cleanNewName;
            newPath = node.path;

            if (node.type === 'folder' && node.children) {
                const oldChildrenBasePath = (parentPathSegment === '' || parentPathSegment === '/' ? '' : parentPathSegment) + '/' + oldNodeName;
                updateChildrenPathsRecursive(node, oldChildrenBasePath, newPath);
            }
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
