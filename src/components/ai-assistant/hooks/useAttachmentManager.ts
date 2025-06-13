
"use client";

import { useState, useCallback, useMemo } from 'react';
import type { IdeState } from '@/contexts/ide-context';
import type { AttachedFileUIData } from '../types';
import type { FileSystemNode } from '@/lib/types';
import { generateFolderContext } from '../ai-assistant-utils'; // Ensure this utility is correctly imported

const MAX_ATTACHMENTS = 5;

export function useAttachmentManager(ideContext: IdeState) {
  const { fileSystem, openedFiles, toast } = ideContext;

  const [attachedFiles, setAttachedFiles] = useState<AttachedFileUIData[]>([]);
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);

  const flattenFileSystemForSearch = useCallback((nodes: FileSystemNode[], currentPath: string = ''): AttachedFileUIData[] => {
    let flatList: AttachedFileUIData[] = [];
    nodes.forEach(node => {
      const nodeData: AttachedFileUIData = {
        path: node.path,
        name: node.name,
        content: node.type === 'file' ? (openedFiles.get(node.path)?.content || node.content || '') : generateFolderContext(node),
        type: node.type,
      };
      flatList.push(nodeData);
      if (node.type === 'folder' && node.children) {
        flatList = flatList.concat(flattenFileSystemForSearch(node.children, node.path));
      }
    });
    return flatList;
  }, [openedFiles, generateFolderContext]);

  const allFilesForSelector = useMemo(() => {
    return flattenFileSystemForSearch(fileSystem);
  }, [fileSystem, flattenFileSystemForSearch]);

  const handleFileSelect = useCallback((file: AttachedFileUIData) => {
    setAttachedFiles(prev => {
      if (prev.length >= MAX_ATTACHMENTS) {
        toast({
          variant: 'destructive',
          title: 'Attachment Limit Reached',
          description: `You can attach a maximum of ${MAX_ATTACHMENTS} items.`,
        });
        return prev;
      }
      if (prev.find(f => f.path === file.path)) {
        return prev; // Already attached
      }
      const contentToAttach = file.type === 'file'
        ? (openedFiles.get(file.path)?.content || file.content || '')
        : generateFolderContext(file as FileSystemNode); // Cast needed if file is folder

      return [...prev, { ...file, content: contentToAttach }];
    });
    setFileSelectorOpen(false);
  }, [openedFiles, toast]);

  const handleRemoveAttachedFile = useCallback((path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path));
  }, []);

  return {
    attachedFiles,
    setAttachedFiles,
    fileSelectorOpen,
    setFileSelectorOpen,
    allFilesForSelector,
    handleFileSelect,
    handleRemoveAttachedFile,
  };
}
