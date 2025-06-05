
"use client";

import type React from 'react';
import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { FileSystemNode } from '@/lib/types';
import { mockFileSystem } from '@/lib/mock-data';

// Helper to generate unique IDs
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

interface IdeState {
  fileSystem: FileSystemNode[];
  openedFiles: Map<string, FileSystemNode>; // path -> FileSystemNode
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  openFile: (filePath: string) => void;
  closeFile: (filePath: string) => void;
  updateFileContent: (filePath: string, newContent: string) => void;
  getFileSystemNode: (path: string) => FileSystemNode | undefined;
  addNode: (parentId: string | null, name: string, type: 'file' | 'folder') => FileSystemNode | null;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newName: string) => void;
}

const IdeContext = createContext<IdeState | undefined>(undefined);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>(mockFileSystem);
  const [openedFiles, setOpenedFiles] = useState<Map<string, FileSystemNode>>(new Map());
  const [activeFilePath, setActiveFilePathState] = useState<string | null>(null);

  const getFileSystemNode = useCallback((path: string): FileSystemNode | undefined => {
    const findNode = (nodes: FileSystemNode[], targetPath: string): FileSystemNode | undefined => {
      for (const node of nodes) {
        if (node.path === targetPath) {
          return node;
        }
        if (node.type === 'folder' && node.children) {
          const found = findNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return undefined;
    };
    return findNode(fileSystem, path);
  }, [fileSystem]);

  const openFile = useCallback((filePath: string) => {
    if (openedFiles.has(filePath)) {
      setActiveFilePathState(filePath);
      return;
    }
    const node = getFileSystemNode(filePath);
    if (node && node.type === 'file') {
      setOpenedFiles(prev => new Map(prev).set(filePath, node));
      setActiveFilePathState(filePath);
    }
  }, [getFileSystemNode, openedFiles]);

  const closeFile = useCallback((filePath: string) => {
    setOpenedFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      if (activeFilePath === filePath) {
        // Set active to the next open tab or null
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
    setOpenedFiles(prev => {
      const newMap = new Map(prev);
      const file = newMap.get(filePath);
      if (file) {
        newMap.set(filePath, { ...file, content: newContent });
      }
      return newMap;
    });
    // Update fileSystem as well for persistence if desired, for now only opened files
     setFileSystem(prevFs => {
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
  }, [setFileSystem]);

  const addNode = useCallback((parentId: string | null, name: string, type: 'file' | 'folder'): FileSystemNode | null => {
    const newNodeId = generateId();
    let addedNodeInstance: FileSystemNode | null = null;

    const createNodeWithPath = (basePath: string): FileSystemNode => {
      let newPath;
      if (basePath === '' || basePath === '/') { // Adding to root
        newPath = '/' + name.replace(/^\/+/, '');
      } else {
        newPath = basePath + '/' + name.replace(/^\/+/, '');
      }
      return {
        id: newNodeId,
        name,
        type,
        path: newPath,
        children: type === 'folder' ? [] : undefined,
        content: type === 'file' ? '' : undefined,
      };
    };

    if (parentId === null) { // Add to root
      addedNodeInstance = createNodeWithPath('');
      setFileSystem(prev => [...prev, addedNodeInstance!]);
      return addedNodeInstance;
    }

    setFileSystem(prevFileSystem => {
      const newFs = JSON.parse(JSON.stringify(prevFileSystem)); // Deep clone
      const addRecursively = (nodes: FileSystemNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === parentId && node.type === 'folder') {
            addedNodeInstance = createNodeWithPath(node.path);
            node.children = [...(node.children || []), addedNodeInstance];
            return true;
          }
          if (node.children && addRecursively(node.children)) {
            return true;
          }
        }
        return false;
      };
      if (addRecursively(newFs)) {
        return newFs;
      }
      return prevFileSystem; 
    });
    return addedNodeInstance;
  }, [setFileSystem]);

  const deleteNode = useCallback((nodeId: string) => {
    const pathsToClose: string[] = [];
    let nodePathToDelete: string | null = null;

    const recursivelyDelete = (nodes: FileSystemNode[]): FileSystemNode[] => {
      return nodes.filter(node => {
        if (node.id === nodeId) {
          nodePathToDelete = node.path;
          if (node.type === 'file') {
            pathsToClose.push(node.path);
          } else if (node.type === 'folder' && node.children) {
            const collectPaths = (children: FileSystemNode[]) => {
              children.forEach(child => {
                if (child.type === 'file') pathsToClose.push(child.path);
                if (child.children) collectPaths(child.children);
              });
            };
            collectPaths(node.children);
          }
          return false; 
        }
        if (node.children) {
          node.children = recursivelyDelete(node.children);
        }
        return true;
      });
    };

    setFileSystem(prev => recursivelyDelete(JSON.parse(JSON.stringify(prev))));

    if (pathsToClose.length > 0) {
        setOpenedFiles(prevOpened => {
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
            if (newActivePath !== activeFilePath) setActiveFilePathState(newActivePath);
            return newOpened;
        });
    } else if (nodePathToDelete && activeFilePath && activeFilePath.startsWith(nodePathToDelete + '/')) {
        // If an open file was inside the deleted folder but not explicitly collected (e.g. folder deleted directly)
        setActiveFilePathState(null); // Or find next available tab
    }


  }, [activeFilePath, setActiveFilePathState, setOpenedFiles, setFileSystem]);
  
  const renameNode = useCallback((nodeId: string, newName: string) => {
    let oldPath = "";
    let newPath = "";
    let nodeType: 'file' | 'folder' | undefined = undefined;

    const updateChildrenPathsRecursive = (node: FileSystemNode, currentParentPath: string) => {
      node.path = currentParentPath + '/' + node.name.replace(/^\/+/, '');
      if (node.type === 'folder' && node.children) {
        node.children.forEach(child => updateChildrenPathsRecursive(child, node.path));
      }
    };

    setFileSystem(prevFs => {
      const newFs = JSON.parse(JSON.stringify(prevFs)); 
      const findAndRename = (nodes: FileSystemNode[], parentPathSegment: string): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === nodeId) {
            oldPath = node.path;
            nodeType = node.type;
            node.name = newName;
            
            if (parentPathSegment === '' || parentPathSegment === '/') { // Root item
              node.path = '/' + newName.replace(/^\/+/, '');
            } else {
              node.path = parentPathSegment + '/' + newName.replace(/^\/+/, '');
            }
            newPath = node.path;

            if (node.type === 'folder' && node.children) {
              node.children.forEach(child => updateChildrenPathsRecursive(child, node.path));
            }
            return true;
          }
          if (node.children && findAndRename(node.children, node.path)) {
            return true;
          }
        }
        return false;
      };

      if (findAndRename(newFs, '')) { // Start with empty parent path for root
        return newFs;
      }
      return prevFs; 
    });

    if (oldPath && newPath && nodeType) {
      setOpenedFiles(prevOpened => {
        const newOpenedMap = new Map<string, FileSystemNode>();
        let newActiveFilePath = activeFilePath;

        prevOpened.forEach((openedNodeValue, openedNodeKey) => {
          if (openedNodeKey === oldPath) { 
            const updatedNode = { ...openedNodeValue, name: newName, path: newPath };
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
  }, [activeFilePath, setActiveFilePathState, setOpenedFiles, setFileSystem]);

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
  }), [fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent, getFileSystemNode, addNode, deleteNode, renameNode]);

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) {
    throw new Error('useIde must be used within an IdeProvider');
  }
  return context;
}

    