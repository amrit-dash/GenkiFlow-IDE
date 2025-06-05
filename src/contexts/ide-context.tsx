
"use client";

import type React from 'react';
import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { FileSystemNode } from '@/lib/types';
import { mockFileSystem } from '@/lib/mock-data';

interface IdeState {
  fileSystem: FileSystemNode[];
  openedFiles: Map<string, FileSystemNode>; // path -> FileSystemNode
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  openFile: (filePath: string) => void;
  closeFile: (filePath: string) => void;
  updateFileContent: (filePath: string, newContent: string) => void;
  getFileSystemNode: (path: string) => FileSystemNode | undefined;
}

const IdeContext = createContext<IdeState | undefined>(undefined);

export function IdeProvider({ children }: { children: React.ReactNode }) {
  const [fileSystem] = useState<FileSystemNode[]>(mockFileSystem);
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
      return newMap;
    });
    if (activeFilePath === filePath) {
      setActiveFilePathState(null);
      // Potentially set active to the next open tab or null
    }
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
    // Note: This mock version doesn't persist changes back to the initial `fileSystem` state.
    // A real implementation would need to update the source of truth.
  }, []);


  const contextValue = useMemo(() => ({
    fileSystem,
    openedFiles,
    activeFilePath,
    setActiveFilePath,
    openFile,
    closeFile,
    updateFileContent,
    getFileSystemNode,
  }), [fileSystem, openedFiles, activeFilePath, setActiveFilePath, openFile, closeFile, updateFileContent, getFileSystemNode]);

  return <IdeContext.Provider value={contextValue}>{children}</IdeContext.Provider>;
}

export function useIde() {
  const context = useContext(IdeContext);
  if (context === undefined) {
    throw new Error('useIde must be used within an IdeProvider');
  }
  return context;
}
