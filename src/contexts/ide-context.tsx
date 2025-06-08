
"use client";

import type React from 'react';
import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type { FileSystemNode, IdeState as IdeStateInterface } from '@/lib/types'; // Use IdeStateInterface to avoid name clash
import { mockFileSystem } from '@/lib/mock-data';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

// LocalStorage keys
const FS_STORAGE_KEY = 'genkiflowIdeFileSystem';
const OPENED_FILES_STORAGE_KEY = 'genkiflowIdeOpenedFiles';
const ACTIVE_FILE_STORAGE_KEY = 'genkiflowIdeActiveFile';

const IdeContext = createContext<IdeStateInterface | undefined>(undefined);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem, setFileSystemState] = useState<FileSystemNode[]>([]);
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
    if (pathOrId === '/') {
        const rootNodeCandidate = findNode(fileSystem, pathOrId);
        return rootNodeCandidate && rootNodeCandidate.type === 'folder' ? rootNodeCandidate : fileSystem;
    }
    return findNode(fileSystem, pathOrId);
  }, [fileSystem]);

  const openFile = useCallback((filePath: string, nodeToOpen?: FileSystemNode) => {
    if (openedFiles.has(filePath) && activeFilePath === filePath) { // If already open and active, do nothing
      return;
    }
    if (openedFiles.has(filePath)) { // If open but not active, just set active
      setActiveFilePathState(filePath);
      return;
    }

    let fileNode: FileSystemNode | undefined;
    if (nodeToOpen && nodeToOpen.type === 'file' && nodeToOpen.path === filePath) {
      fileNode = nodeToOpen;
    } else {
      const foundNode = getFileSystemNode(filePath);
      if (foundNode && typeof foundNode === 'object' && !Array.isArray(foundNode) && foundNode.type === 'file') {
        fileNode = foundNode as FileSystemNode;
      }
    }
    
    if (fileNode) {
      setOpenedFilesState(prev => new Map(prev).set(filePath, { ...fileNode }));
      setActiveFilePathState(filePath);
    }
  }, [getFileSystemNode, openedFiles, activeFilePath]);

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
            for (const n of nodes) { if (n.id === id) return n; if (n.children) { const found = findParentById(n.children, id); if (found) return found; } } return undefined;
          };
          parentNode = findParentById(newFs, parentId);
          if (!parentNode || parentNode.type !== 'folder') { parentNode = undefined; parentPathForNewNode = currentDirectoryPath === '/' ? '' : currentDirectoryPath; } 
          else { parentPathForNewNode = parentNode.path; }
      } else {
          parentPathForNewNode = currentDirectoryPath === '/' ? '' : currentDirectoryPath;
          parentNode = undefined; 
          if (currentDirectoryPath !== '/') {
            const findTargetDirNode = (nodes: FileSystemNode[], path: string): FileSystemNode | undefined => {
                 for (const n of nodes) { if (n.path === path && n.type === 'folder') return n; if (n.children) { const found = findTargetDirNode(n.children, path); if (found) return found; } } return undefined;
            }
            const targetDirNode = findTargetDirNode(newFs, currentDirectoryPath);
            if (targetDirNode) { parentNode = targetDirNode; parentPathForNewNode = targetDirNode.path; } 
            else if (currentDirectoryPath !== '/') { console.error(`addNode: Parent directory ${currentDirectoryPath} not found for adding ${name}`); return prevFileSystem; }
          }
      }

      let baseName = name; const defaultExtension = ".txt"; let extension = "";
      if (type === 'file') { if (baseName.includes('.')) { extension = baseName.substring(baseName.lastIndexOf('.')); baseName = baseName.substring(0, baseName.lastIndexOf('.')); } else { extension = defaultExtension; } }
      let finalName = type === 'file' ? baseName + extension : baseName;
      let counter = 1;
      const targetChildrenArray = parentNode ? parentNode.children || [] : newFs;
      const nameExists = (nameToCheck: string) => targetChildrenArray.some(child => child.name === nameToCheck);
      while (nameExists(finalName)) { finalName = type === 'file' ? `${baseName}(${counter})${extension}` : `${baseName}(${counter})`; counter++; }
      let newPath = (parentPathForNewNode === '' || parentPathForNewNode === '/' ? '' : parentPathForNewNode) + '/' + finalName;
      if (newPath.startsWith('//')) newPath = newPath.substring(1);


      const newNodeId = generateId();
      addedNodeInstance = { id: newNodeId, name: finalName, type, path: newPath, children: type === 'folder' ? [] : undefined, content: type === 'file' ? '' : undefined };
      if (parentNode) { parentNode.children = [...(parentNode.children || []), addedNodeInstance!]; const updateParentInTree = (nodes: FileSystemNode[]): FileSystemNode[] => { return nodes.map(n => { if (n.id === parentNode!.id) return parentNode!; if (n.children) n.children = updateParentInTree(n.children); return n; }); }; return updateParentInTree(newFs);
      } else { return [...newFs, addedNodeInstance!]; }
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
  }, [activeFilePath, openedFiles]);

  const renameNode = useCallback((nodeId: string, newName: string): boolean => {
    let oldPath = ""; let newPath = ""; let nodeType: 'file' | 'folder' | undefined = undefined; let success = false;
    const cleanNewName = newName.replace(/[\\/:\*\?"<>\|\s]/g, '_').trim(); if (!cleanNewName) { console.error("Invalid new name."); return false; }
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
            parentOfTargetNode = currentParent; const siblings = parentOfTargetNode ? parentOfTargetNode.children || [] : newFs;
            if (siblings.some(sibling => sibling.id !== nodeId && sibling.name === cleanNewName)) { console.error(`Node "${cleanNewName}" already exists.`); success = false; return true; }
            oldPath = node.path; const oldNodeName = node.name; nodeType = node.type; node.name = cleanNewName;
            node.path = (parentPathSegment === '' || parentPathSegment === '/' ? '' : parentPathSegment) + '/' + cleanNewName;
            if (node.path.startsWith('//')) node.path = node.path.substring(1);
            newPath = node.path;
            if (node.type === 'folder' && node.children) { updateChildrenPathsRecursive(node, oldPath, newPath); }
            success = true; return true;
          }
          if (node.children && findAndRename(node.children, node, node.path)) return true;
        }
        return false;
      };
      if (findAndRename(newFs, null, '')) return success ? newFs : prevFs; return prevFs;
    });
    if (success && oldPath && newPath && nodeType) {
      setOpenedFilesState(prevOpened => {
        const newOpenedMap = new Map<string, FileSystemNode>(); let newActiveFilePath = activeFilePath;
        prevOpened.forEach((openedNodeValue, openedNodeKey) => {
          if (openedNodeKey === oldPath) { const updatedNode = { ...openedNodeValue, name: cleanNewName, path: newPath }; newOpenedMap.set(newPath, updatedNode); if (activeFilePath === oldPath) newActiveFilePath = newPath;
          } else if (nodeType === 'folder' && openedNodeKey.startsWith(oldPath + '/')) { const relativePath = openedNodeKey.substring(oldPath.length); const updatedChildPath = newPath + relativePath; const updatedNode = { ...openedNodeValue, path: updatedChildPath }; newOpenedMap.set(updatedChildPath, updatedNode); if (activeFilePath === openedNodeKey) newActiveFilePath = updatedChildPath;
          } else { newOpenedMap.set(openedNodeKey, openedNodeValue); }
        });
        if (newActiveFilePath !== activeFilePath) setActiveFilePathState(newActiveFilePath); return newOpenedMap;
      });
    }
    return success;
  }, [activeFilePath]);

  const moveNode = useCallback((draggedNodeId: string, targetParentFolderId: string | null) => {
    setFileSystemState(prevFs => {
        const newFs = JSON.parse(JSON.stringify(prevFs)); // Full clone for safety

        let draggedNode: FileSystemNode | null = null;
        let oldParentNode: FileSystemNode | null = null;
        let draggedNodeOriginalIndex = -1; // To reinsert if move fails

        // 1. Find and detach the dragged node
        function findAndDetach(nodes: FileSystemNode[], parent: FileSystemNode | null, indexInParent?: number): boolean {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === draggedNodeId) {
                    draggedNode = { ...nodes[i] }; // Clone the node itself
                    oldParentNode = parent;
                    draggedNodeOriginalIndex = parent ? i : indexInParent!; // If root, use indexInParent
                    nodes.splice(i, 1);
                    return true;
                }
                if (nodes[i].children && findAndDetach(nodes[i].children, nodes[i])) {
                    return true;
                }
            }
            return false;
        }
        // For root items, pass their index
        let foundAndDetached = false;
        for(let i=0; i < newFs.length; i++) {
            if(newFs[i].id === draggedNodeId) {
                foundAndDetached = findAndDetach([newFs[i]], null, i); // Wrap in array for findAndDetach, pass index
                if(foundAndDetached) break;
            }
            if(newFs[i].children && findAndDetach(newFs[i].children, newFs[i])) {
                foundAndDetached = true;
                break;
            }
        }


        if (!draggedNode) {
            console.error("Dragged node not found during move:", draggedNodeId);
            return prevFs; // Abort: return original FS
        }

        // 2. Find the target parent folder
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
                console.error("Target parent folder not found or is not a folder:", targetParentFolderId);
                return prevFs; // Abort: return original FS
            }
        }

        // 3. Check for invalid moves (dragging a folder into itself or its children)
        if (draggedNode.type === 'folder' && targetParentNode) {
            let currentCheckNode: FileSystemNode | null = targetParentNode;
            while (currentCheckNode) {
                if (currentCheckNode.id === draggedNode.id) {
                    console.error("Cannot move a folder into itself or one of its descendants.");
                    return prevFs; // Abort
                }
                // Find parent of currentCheckNode to traverse up (complex without parent refs, need to search)
                let foundParentOfCurrentCheck: FileSystemNode | null = null;
                function findParent(nodes: FileSystemNode[], targetId: string, p: FileSystemNode | null): FileSystemNode | null {
                    for(const n of nodes) {
                        if(n.id === targetId) return p;
                        if(n.children) {
                            const fp = findParent(n.children, targetId, n);
                            if(fp) return fp;
                        }
                    }
                    return null;
                }
                currentCheckNode = findParent(newFs, currentCheckNode.id, null);
            }
        }
        
        // 4. Update path of dragged node and its children
        const newParentPathSegment = targetParentNode ? targetParentNode.path : '';
        const oldPathForDragged = draggedNode.path; // Keep old path for opened files update later

        function updatePathsRecursive(nodeToUpdate: FileSystemNode, newPathPrefix: string) {
            const nodeName = nodeToUpdate.name; // Name doesn't change
            nodeToUpdate.path = (newPathPrefix === '/' || newPathPrefix === '' ? '' : newPathPrefix) + '/' + nodeName;
            if (nodeToUpdate.path.startsWith('//')) nodeToUpdate.path = nodeToUpdate.path.substring(1);

            if (nodeToUpdate.type === 'folder' && nodeToUpdate.children) {
                nodeToUpdate.children.forEach(child => updatePathsRecursive(child, nodeToUpdate.path));
            }
        }
        updatePathsRecursive(draggedNode, newParentPathSegment);
        const newPathForDragged = draggedNode.path;


        // 5. Check for name conflicts in the target directory
        const destinationChildren = targetParentNode ? (targetParentNode.children || []) : newFs;
        if (destinationChildren.some(child => child.name === draggedNode!.name && child.id !== draggedNode!.id )) {
            console.error(`A node named "${draggedNode!.name}" already exists in the target directory. Move aborted.`);
            return prevFs; // Abort: return original FS
        }

        // 6. Add the dragged node to its new parent
        if (targetParentNode) {
            if (!targetParentNode.children) targetParentNode.children = [];
            targetParentNode.children.push(draggedNode);
        } else { // Dropped to root
            newFs.push(draggedNode);
        }
        
        // Update opened files (basic, might need more robust solution for deeply nested moves)
        setOpenedFilesState(prevOpened => {
            const newOpenedMap = new Map<string, FileSystemNode>();
            let newActiveFilePath = activeFilePath;

            prevOpened.forEach((openedNodeValue, openedNodeKey) => {
                if (openedNodeKey === oldPathForDragged) { // Direct match for the moved file
                    const updatedNode = { ...openedNodeValue, path: newPathForDragged };
                    newOpenedMap.set(newPathForDragged, updatedNode);
                    if (activeFilePath === openedNodeKey) newActiveFilePath = newPathForDragged;
                } else if (draggedNode!.type === 'folder' && openedNodeKey.startsWith(oldPathForDragged + '/')) { // File was inside moved folder
                    const relativePath = openedNodeKey.substring(oldPathForDragged.length);
                    const updatedChildPath = newPathForDragged + relativePath;
                    const updatedNode = { ...openedNodeValue, path: updatedChildPath };
                    newOpenedMap.set(updatedChildPath, updatedNode);
                    if (activeFilePath === openedNodeKey) newActiveFilePath = updatedChildPath;
                } else {
                    newOpenedMap.set(openedNodeKey, openedNodeValue); // No change
                }
            });
            if (newActiveFilePath !== activeFilePath) setActiveFilePathState(newActiveFilePath);
            return newOpenedMap;
        });


        return newFs;
    });
  }, [activeFilePath, setActiveFilePathState, setOpenedFilesState]); // Added dependencies

  const contextValue = useMemo(() => ({
    fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent,
    getFileSystemNode, addNode, deleteNode, renameNode, moveNode, // Added moveNode
    isBusy, nodeToAutoRenameId, setNodeToAutoRenameId,
  }), [
    fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent,
    getFileSystemNode, addNode, deleteNode, renameNode, moveNode, // Added moveNode
    isBusy, nodeToAutoRenameId, setNodeToAutoRenameId
  ]);

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) throw new Error('useIde must be used within an IdeProvider');
  return context;
}
