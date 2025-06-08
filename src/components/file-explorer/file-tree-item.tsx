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

const HOVER_TO_OPEN_DELAY = 750; // ms

export function FileTreeItem({ node, level = 0 }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(node.type === 'folder' ? (node.path === '/src' || node.path === '/') : false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const { openFile, activeFilePath, addNode, deleteNode, renameNode, nodeToAutoRenameId, setNodeToAutoRenameId, moveNode } = useIde();
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isFolder = node.type === 'folder';
  const Icon = isFolder ? Folder : FileText;
  const ExpansionIcon = isOpen ? ChevronDown : ChevronRight;

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
    // Cleanup timeout on unmount
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
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    const draggedNodeId = e.dataTransfer.getData("application/genkiflow-node-id");
    if (isFolder && node.id !== draggedNodeId) { // Can drop into a folder
      setIsDraggingOver(true);
       if (!isOpen && !hoverTimeoutRef.current) { // If folder is closed and no timeout is active
        hoverTimeoutRef.current = setTimeout(() => {
          if (isDraggingOver) { // Check if still dragging over this item
            setIsOpen(true);
          }
          hoverTimeoutRef.current = null;
        }, HOVER_TO_OPEN_DELAY);
      }
    } else if (!isFolder) { // Can drop ON files (for reordering, not implemented yet but allow visual cue)
      // setIsDraggingOver(true); // No visual cue for dropping ON files for now
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
    // Check if the mouse is truly leaving the element, not just moving to a child
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
      if (isFolder) { // Dropped onto a folder
        moveNode(draggedNodeId, node.id);
      } else { // Dropped onto a file (or empty space sibling to a file)
        // To drop "next to" a file, we need parentId.
        // This requires getting parent info or handling at FileExplorer level for root drops.
        // For now, assume a drop on a file means drop into its parent.
        // This needs to be refined based on where exactly the drop happens.
        // The current root drop logic is in FileExplorer.tsx
        // console.log(`Dropped node ${draggedNodeId} onto file ${node.name} (parent drop not implemented here)`);
      }
    }
  };


  return (
    <div 
      className="text-sm group/fileitem relative"
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
          "flex items-center py-1.5 px-2 rounded-md cursor-pointer",
          !isFolder && activeFilePath === node.path && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          isDraggingOver && isFolder && "bg-sidebar-accent/50 ring-1 ring-sidebar-primary", // Visual cue for droppable folder
          !isDraggingOver && isFolder && "hover:bg-sidebar-accent", // Standard hover for folder
          !isFolder && "hover:bg-sidebar-accent" // Standard hover for file
        )}
        style={{ paddingLeft: `${level * 1.25 + (isFolder ? 0 : 1.25) + (isRenaming ? 0.1 : 0.5)}rem` }}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !isRenaming) handleToggle(e);
            if (e.key === 'F2' && !isRenaming) { e.preventDefault(); handleRenameStart(e as any); }
        }}
        title={node.path}      
      >
        {isFolder && (
          <ExpansionIcon className="w-4 h-4 mr-1 shrink-0" />
        )}
        <Icon className={cn("w-4 h-4 mr-2 shrink-0", isFolder ? "text-yellow-500" : "text-primary")} />
        
        {isRenaming ? (
          <Input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm} 
            onKeyDown={handleRenameKeyDown}
            className="h-6 px-1 py-0 text-sm w-full bg-input border-primary ring-primary"
            onClick={(e) => e.stopPropagation()} 
          />
        ) : (
          <>
            <span className="truncate flex-grow pointer-events-none">{node.name}</span> 
            
            {showActions && !isRenaming && (
              <div className="ml-auto flex items-center space-x-0.5 opacity-0 group-hover/fileitem:opacity-100 transition-opacity duration-150">
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
          </>
        )}
      </div>
      {isFolder && isOpen && !isRenaming && node.children && (
        <div>
          {sortedChildren.length > 0 ? sortedChildren.map((child) => (
            <FileTreeItem key={child.id} node={child} level={level + 1} />
          )) : (
             <div 
                className={cn(
                    "pl-4 text-xs text-muted-foreground py-1 italic min-h-[24px] flex items-center", // min-h for drop target
                    isDraggingOver && "bg-sidebar-accent/30" // Cue for dropping into empty folder
                )}
                style={{ paddingLeft: `${(level + 1) * 1.25 + 0.5 + 1.25}rem` }}
                // Drag handlers for empty folder area also needed
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
