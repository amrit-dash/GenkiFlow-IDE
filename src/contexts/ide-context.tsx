
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
    if (openedFiles.has(filePath) && activeFilePath === filePath) { 
      return;
    }
    if (openedFiles.has(filePath)) { 
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
      if (type === 'file') { 
        const lastDotIndex = baseName.lastIndexOf('.');
        if (lastDotIndex > 0) { // ensure dot is not the first char and exists
          extension = baseName.substring(lastDotIndex); 
          baseName = baseName.substring(0, lastDotIndex); 
        } else if (lastDotIndex === -1 && baseName !== "") { // No extension
            extension = defaultExtension;
        } else if (lastDotIndex === 0) { // Starts with a dot e.g. ".env"
            // Keep as is, baseName is the full name, extension is empty
        }
      }
      let finalName = type === 'file' ? (baseName.startsWith('.') ? baseName : baseName + extension) : baseName; // Fix for dotfiles
      if (baseName.startsWith('.') && type === 'file') finalName = baseName; // if .env, finalName should be .env

      let counter = 1;
      const targetChildrenArray = parentNode ? parentNode.children || [] : newFs;
      const nameExists = (nameToCheck: string) => targetChildrenArray.some(child => child.name === nameToCheck);
      
      let tempFinalName = finalName;
      while (nameExists(tempFinalName)) { 
        if (type === 'file') {
            if (baseName.startsWith('.')) { // For dotfiles like .env(1)
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
  }, [activeFilePath, openedFiles, setActiveFilePathState]);

  const renameNode = useCallback((nodeId: string, newName: string): boolean => {
    let oldPath = ""; let newPath = ""; let nodeType: 'file' | 'folder' | undefined = undefined; let success = false;
    const cleanNewNameInput = newName.trim(); if (!cleanNewNameInput) { console.error("Invalid new name: cannot be empty or just whitespace."); return false; }
    // Basic check for invalid characters, allow dots and spaces but not slashes.
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
            parentOfTargetNode = currentParent; const siblings = parentOfTargetNode ? parentOfTargetNode.children || [] : newFs;
            if (siblings.some(sibling => sibling.id !== nodeId && sibling.name === cleanNewNameInput)) { console.error(`Node "${cleanNewNameInput}" already exists in this directory.`); success = false; return true; } // Exit findAndRename
            oldPath = node.path; nodeType = node.type; node.name = cleanNewNameInput;
            node.path = (parentPathSegment === '' || parentPathSegment === '/' ? '' : parentPathSegment) + '/' + cleanNewNameInput;
            if (node.path.startsWith('//')) node.path = node.path.substring(1);
            newPath = node.path;
            if (node.type === 'folder' && node.children) { updateChildrenPathsRecursive(node, oldPath, newPath); }
            success = true; return true; // Exit findAndRename
          }
          if (node.children && findAndRename(node.children, node, node.path)) return true;
        }
        return false;
      };
      
      findAndRename(newFs, null, ''); // Call findAndRename. Success is set inside.
      return success ? newFs : prevFs; // Only return newFs if success was true
    });

    if (success && oldPath && newPath && nodeType) {
      setOpenedFilesState(prevOpened => {
        const newOpenedMap = new Map<string, FileSystemNode>(); let newActiveFilePath = activeFilePath;
        prevOpened.forEach((openedNodeValue, openedNodeKey) => {
          if (openedNodeKey === oldPath) { const updatedNode = { ...openedNodeValue, name: cleanNewNameInput, path: newPath }; newOpenedMap.set(newPath, updatedNode); if (activeFilePath === oldPath) newActiveFilePath = newPath;
          } else if (nodeType === 'folder' && openedNodeKey.startsWith(oldPath + '/')) { const relativePath = openedNodeKey.substring(oldPath.length); const updatedChildPath = newPath + relativePath; const updatedNode = { ...openedNodeValue, path: updatedChildPath }; newOpenedMap.set(updatedChildPath, updatedNode); if (activeFilePath === openedNodeKey) newActiveFilePath = updatedChildPath;
          } else { newOpenedMap.set(openedNodeKey, openedNodeValue); }
        });
        if (newActiveFilePath !== activeFilePath) setActiveFilePathState(newActiveFilePath); return newOpenedMap;
      });
    }
    return success;
  }, [activeFilePath, setActiveFilePathState]);

  const moveNode = useCallback((draggedNodeId: string, targetParentFolderId: string | null) => {
    let oldPathForDraggedNode = '';
    let newPathForDraggedNode = '';
    let draggedNodeType: 'file' | 'folder' | undefined;

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

        if (!draggedNode) {
            console.error("Dragged node not found during move:", draggedNodeId);
            return prevFs; 
        }
        oldPathForDraggedNode = draggedNode.path; // Capture old path
        draggedNodeType = draggedNode.type;

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
                // Re-attach node to its original position if target is invalid
                if (sourceParentNode && sourceParentNode.children) sourceParentNode.children.push(draggedNode); else if (!sourceParentNode) newFs.push(draggedNode);
                return prevFs; 
            }
        }
        
        if (draggedNode.type === 'folder' && targetParentNode) {
            let currentCheckNode: FileSystemNode | null = targetParentNode;
            while (currentCheckNode) {
                if (currentCheckNode.id === draggedNode.id) {
                    console.error("Cannot move a folder into itself or one of its descendants.");
                     if (sourceParentNode && sourceParentNode.children) sourceParentNode.children.push(draggedNode); else if (!sourceParentNode) newFs.push(draggedNode);
                    return prevFs; 
                }
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
                
                // To find the parent of currentCheckNode to traverse up, we search from the root of newFs
                // This is inefficient but necessary without direct parent references in the node structure
                let parentPath = currentCheckNode.path.substring(0, currentCheckNode.path.lastIndexOf('/'));
                if(parentPath === "" && currentCheckNode.path.lastIndexOf('/') > -1) parentPath = "/"; // Root case
                
                if(parentPath) {
                    currentCheckNode = findParent(newFs, currentCheckNode.id, null); //This needs a proper parent search based on path
                     let tempNode: FileSystemNode | null = null;
                     if (currentCheckNode?.path) { // Check if currentCheckNode has a path (i.e., it's not the root)
                        const parentPathForCheck = currentCheckNode.path.substring(0, currentCheckNode.path.lastIndexOf('/'));
                        const rootOrParent = parentPathForCheck ? findTargetRecursive(newFs) : null; // Simplified, needs correct parent finding
                        currentCheckNode = rootOrParent;
                     } else {
                        currentCheckNode = null; // Reached root or error
                     }

                } else {
                    currentCheckNode = null; // Reached root
                }
            }
        }
        
        const destinationArray = targetParentNode ? (targetParentNode.children || []) : newFs;
        let newProposedName = draggedNode.name;
        let tempCounter = 1;
        const originalNameParts = newProposedName.split('.');
        const originalExtension = draggedNode.type === 'file' && originalNameParts.length > 1 && originalNameParts[0] !== "" ? '.' + originalNameParts.pop()! : '';
        let originalBaseName = draggedNode.type === 'file' ? (originalNameParts[0] === "" && originalNameParts.length === 1 ? newProposedName : originalNameParts.join('.')) : newProposedName;
         if (draggedNode.type === 'file' && newProposedName.startsWith('.') && !originalExtension) { // Handles names like ".env"
            originalBaseName = newProposedName;
        }


        while (destinationArray.some(child => child.name === newProposedName && child.id !== draggedNode!.id)) {
             if (draggedNode.type === 'file') {
                if (originalBaseName.startsWith('.')) { // For dotfiles like .env(1)
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

            if (nodeToUpdate.type === 'folder' && nodeToUpdate.children) {
                nodeToUpdate.children.forEach(child => updatePathsRecursive(child, nodeToUpdate.path));
            }
        }
        updatePathsRecursive(draggedNode, newParentPathSegment);
        newPathForDraggedNode = draggedNode.path; // Capture new path

        if (targetParentNode) {
            if (!targetParentNode.children) targetParentNode.children = [];
            targetParentNode.children.push(draggedNode);
        } else { 
            newFs.push(draggedNode);
        }
        return newFs;
    });

    // After file system state is updated, handle opened files
    if (oldPathForDraggedNode && newPathForDraggedNode && oldPathForDraggedNode !== newPathForDraggedNode) {
        setOpenedFilesState(prevOpened => {
            const newOpenedMap = new Map(prevOpened);
            const pathsToCloseAndPotentiallyReopen: { oldPath: string, newPath: string, node: FileSystemNode }[] = [];

            // Identify all files affected by the move
            prevOpened.forEach((node, path) => {
                if (path === oldPathForDraggedNode && draggedNodeType === 'file') {
                    pathsToCloseAndPotentiallyReopen.push({ oldPath: path, newPath: newPathForDraggedNode, node: { ...node, path: newPathForDraggedNode, name: newPathForDraggedNode.substring(newPathForDraggedNode.lastIndexOf('/') + 1) } });
                } else if (draggedNodeType === 'folder' && path.startsWith(oldPathForDraggedNode + '/')) {
                    const relativePath = path.substring(oldPathForDraggedNode.length);
                    const newFullPath = newPathForDraggedNode + relativePath;
                    pathsToCloseAndPotentiallyReopen.push({ oldPath: path, newPath: newFullPath, node: { ...node, path: newFullPath, name: newFullPath.substring(newFullPath.lastIndexOf('/')+1) } });
                }
            });

            let newActiveFilePath = activeFilePath;
            const finalOpenedMap = new Map<string, FileSystemNode>();
            
            // Keep files that were not affected
            prevOpened.forEach((node, path) => {
                if (!pathsToCloseAndPotentiallyReopen.some(p => p.oldPath === path)) {
                    finalOpenedMap.set(path, node);
                }
            });

            // Determine new active file path if the current one was closed
            const activeFileWasMoved = pathsToCloseAndPotentiallyReopen.some(p => p.oldPath === activeFilePath);
            if (activeFileWasMoved) {
                 newActiveFilePath = finalOpenedMap.size > 0 ? Array.from(finalOpenedMap.keys())[0] : null;
            }
            
            if (newActiveFilePath !== activeFilePath) {
                setActiveFilePathState(newActiveFilePath);
            }
            return finalOpenedMap; // Return map with only unaffected or explicitly re-opened files
        });
    }


  }, [activeFilePath, setActiveFilePathState, setOpenedFilesState]); 

  const contextValue = useMemo(() => ({
    fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent,
    getFileSystemNode, addNode, deleteNode, renameNode, moveNode, 
    isBusy, nodeToAutoRenameId, setNodeToAutoRenameId,
  }), [
    fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent,
    getFileSystemNode, addNode, deleteNode, renameNode, moveNode, 
    isBusy, nodeToAutoRenameId, setNodeToAutoRenameId
  ]);

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) throw new Error('useIde must be used within an IdeProvider');
  return context;
}

