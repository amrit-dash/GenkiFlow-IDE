
"use client";

import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, PlusCircle, Trash2, Edit3, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileSystemNode } from '@/lib/types';
import { useIde } from '@/contexts/ide-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FileTreeItemProps {
  node: FileSystemNode;
  level?: number;
}

const HOVER_TO_OPEN_DELAY = 750; 

const FOLDER_ICON_COLOR_MAP: Record<string, string> = {
  '270 70% 55%': 'text-yellow-500', 
  '210 70% 55%': 'text-orange-500', 
  '30 80% 55%': 'text-sky-500',     
  '330 80% 60%': 'text-teal-500',    
  '180 60% 45%': 'text-rose-500',   
};
const DEFAULT_FOLDER_ICON_COLOR = 'text-yellow-500';

export function FileTreeItem({ node, level = 0 }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(node.type === 'folder' ? (node.path === '/src' || node.path === '/') : false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const { openFile, activeFilePath, addNode, deleteNode, renameNode, nodeToAutoRenameId, setNodeToAutoRenameId, moveNode, accentColor } = useIde();
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isFolder = node.type === 'folder';
  const FileIcon = FileText; 
  const FolderIcon = Folder;
  const ExpansionIcon = isOpen ? ChevronDown : ChevronRight;

  const folderIconColorClass = FOLDER_ICON_COLOR_MAP[accentColor] || DEFAULT_FOLDER_ICON_COLOR;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (nodeToAutoRenameId === node.id && !isRenaming) {
      setIsRenaming(true);
      setRenameValue(node.name);
      setNodeToAutoRenameId(null);
    }
  }, [nodeToAutoRenameId, node.id, node.name, setNodeToAutoRenameId, isRenaming]);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, [clearHoverTimeout]);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && (e.target.closest('[data-action-button]') || e.target.closest('input') || e.target.closest('[role=dialog]'))) {
        return;
    }
    if (isRenaming) return;

    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      openFile(node.path, node);
    }
  };

  const handleAddFile = (e: React.MouseEvent) => { e.stopPropagation(); const newNode = addNode(node.id, "UntitledFile", 'file', node.path); if (newNode) { if (!isOpen) setIsOpen(true); setNodeToAutoRenameId(newNode.id); } };
  const handleAddFolder = (e: React.MouseEvent) => { e.stopPropagation(); const newNode = addNode(node.id, "NewFolder", 'folder', node.path); if (newNode) { if (!isOpen) setIsOpen(true); setNodeToAutoRenameId(newNode.id); } };
  const handleDeleteInitiate = (e: React.MouseEvent) => { e.stopPropagation(); setShowDeleteDialog(true); };
  const confirmDelete = () => { deleteNode(node.id); setShowDeleteDialog(false); };
  const handleRenameStart = (e: React.MouseEvent) => { e.stopPropagation(); setRenameValue(node.name); setIsRenaming(true); };

  const handleRenameConfirm = () => {
    if (renameValue.trim() !== "" && renameValue.trim() !== node.name) {
      const success = renameNode(node.id, renameValue.trim());
      if (!success) { setRenameValue(node.name); console.error(`Failed to rename. A file or folder with the name "${renameValue.trim()}" might already exist in this directory, or the name is invalid.`); }
    }
    setIsRenaming(false);
  };
  
  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleRenameConfirm(); else if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(node.name); } };

  const sortedChildren = node.children ? [...node.children].sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  }) : [];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/genkiflow-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation(); 
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
    e.stopPropagation();
    const draggedNodeId = e.dataTransfer.getData("application/genkiflow-node-id");
    if (isFolder && node.id !== draggedNodeId) { 
      setIsDraggingOver(true);
       if (!isOpen && !hoverTimeoutRef.current) { 
        hoverTimeoutRef.current = setTimeout(() => {
          if (isDraggingOver) { 
            setIsOpen(true);
          }
          hoverTimeoutRef.current = null;
        }, HOVER_TO_OPEN_DELAY);
      }
    }
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedNodeId = e.dataTransfer.getData("application/genkiflow-node-id");
     if (isFolder && node.id !== draggedNodeId) {
      setIsDraggingOver(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    clearHoverTimeout();
    const relatedTarget = e.relatedTarget as Node;
    if (!e.currentTarget.contains(relatedTarget)) {
        setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    clearHoverTimeout();
    const draggedNodeId = e.dataTransfer.getData("application/genkiflow-node-id");
    
    if (draggedNodeId && draggedNodeId !== node.id) {
      if (isFolder) { 
        moveNode(draggedNodeId, node.id);
      }
    }
  };

  return (
    <div 
      className="text-sm group/fileitem w-full" // Added w-full
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      draggable={!isRenaming} 
      onDragStart={handleDragStart}
      onDragOver={handleDragOver} 
      onDragEnter={handleDragEnter} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}   
    >
      <div
        className={cn(
          "flex items-center w-full py-1.5 px-2 rounded-md cursor-pointer overflow-hidden", // Added overflow-hidden
          !isFolder && activeFilePath === node.path && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          isDraggingOver && isFolder && "bg-sidebar-accent/50 ring-1 ring-sidebar-primary", 
          !isDraggingOver && isFolder && "hover:bg-sidebar-accent", 
          !isFolder && "hover:bg-sidebar-accent" 
        )}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !isRenaming) handleToggle(e);
            if (e.key === 'F2' && !isRenaming) { e.preventDefault(); handleRenameStart(e as any); }
        }}
        title={isRenaming ? undefined : node.path} // Tooltip for full path on the row itself
      >
        {/* Indentation part (shrink-0) */}
        <div style={{ paddingLeft: `${level * 1.25}rem` }} className="shrink-0">
          {isFolder && (
            <ExpansionIcon className="w-4 h-4 mr-1 shrink-0" />
          )}
        </div>

        {/* File/Folder Icon part (shrink-0) */}
        <div className="shrink-0">
          {isFolder ? (
            <FolderIcon className={cn("w-4 h-4 mr-2", folderIconColorClass, !isFolder && !isRenaming && "ml-5")} />
          ) : (
            <FileIcon className={cn("w-4 h-4 mr-2 text-primary", !isFolder && !isRenaming && "ml-5")} />
          )}
        </div>
          
        {/* Name or Input part (this must grow and allow truncation) */}
        {isRenaming ? (
          <Input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm} 
            onKeyDown={handleRenameKeyDown}
            className="h-6 px-1 py-0 text-sm w-full bg-input border-primary ring-primary flex-grow min-w-0" // flex-grow min-w-0
            onClick={(e) => e.stopPropagation()} 
          />
        ) : (
          // Wrapper for the name, this will grow and manage overflow for the span
          <div className="flex-grow min-w-0 overflow-hidden mr-1"> {/* Added mr-1 for spacing before actions */}
            <span className="block truncate" title={node.name}> {/* Ensure title is on the span for full name */}
              {node.name}
            </span>
          </div>
        )}

        {/* Action Buttons part (shrink-0, visibility toggled by hover) */}
        {!isRenaming && (
          <div 
            className={cn(
              "flex items-center space-x-0.5 shrink-0 transition-opacity duration-150 z-10 group-focus-within/fileitem:opacity-100",
              showActions ? "opacity-100" : "opacity-0"
            )}
            data-action-button 
          >
            {isFolder && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddFile} data-action-button title="Add File">
                  <PlusCircle className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddFolder} data-action-button title="Add Folder">
                  <FolderPlus className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRenameStart} data-action-button title="Rename (F2)">
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive/80" onClick={handleDeleteInitiate} data-action-button title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isFolder && isOpen && !isRenaming && node.children && (
        <div>
          {sortedChildren.length > 0 ? sortedChildren.map((child) => (
            <FileTreeItem key={child.id} node={child} level={level + 1} />
          )) : (
             <div 
                className={cn(
                    "text-xs text-muted-foreground py-1 italic min-h-[24px] flex items-center", 
                    isDraggingOver && "bg-sidebar-accent/30" 
                )}
                style={{ paddingLeft: `${(level + 1) * 1.25 + 0.5 + 1.25 + 0.5}rem` }} 
                onDragOver={handleDragOver} 
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                (empty)
            </div>
          )}
        </div>
      )}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete "{node.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {node.type}
              {node.type === 'folder' && node.children && node.children.length > 0 ? ` and all its contents (${node.children.length} item(s)).` : '.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => {e.stopPropagation(); setShowDeleteDialog(false);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => {e.stopPropagation(); confirmDelete();}} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

