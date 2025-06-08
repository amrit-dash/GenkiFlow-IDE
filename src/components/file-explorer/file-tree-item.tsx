
"use client";

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, PlusCircle, Trash2, Edit3, FolderPlus, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileSystemNode } from '@/lib/types';
import { useIde } from '@/contexts/ide-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FileTreeItemProps {
  node: FileSystemNode;
  level?: number;
}

export function FileTreeItem({ node, level = 0 }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(node.type === 'folder' ? (node.path === '/src' || node.path === '/') : false); // Keep /src open by default
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showActions, setShowActions] = useState(false);
  const { openFile, activeFilePath, addNode, deleteNode, renameNode } = useIde(); // Removed getFileSystemNode as it's not directly used here
  const inputRef = useRef<HTMLInputElement>(null);

  const isFolder = node.type === 'folder';
  const Icon = isFolder ? Folder : FileText;
  const ExpansionIcon = isOpen ? ChevronDown : ChevronRight;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && (e.target.closest('[data-action-button]') || e.target.closest('input'))) {
        return;
    }
    if (isRenaming) return;

    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      openFile(node.path);
    }
  };

  const handleAddFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fileName = window.prompt("Enter new file name (e.g., newFile.txt):");
    if (fileName && fileName.trim() !== "") {
      const added = addNode(node.id, fileName.trim(), 'file');
      if (added && !isOpen) setIsOpen(true);
    }
  };

  const handleAddFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const folderName = window.prompt("Enter new folder name (e.g., newFolder):");
    if (folderName && folderName.trim() !== "") {
      const added = addNode(node.id, folderName.trim(), 'folder');
      if (added && !isOpen) setIsOpen(true);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${node.name}"? This action cannot be undone.`)) {
      deleteNode(node.id);
    }
  };

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(node.name);
    setIsRenaming(true);
  };

  const handleRenameConfirm = () => {
    if (renameValue.trim() !== "" && renameValue.trim() !== node.name) {
      const success = renameNode(node.id, renameValue.trim());
      if (!success) {
         setRenameValue(node.name); 
         // Optionally, inform user about name collision if that was the cause
         alert(`Failed to rename. A file or folder with the name "${renameValue.trim()}" might already exist in this directory, or the name is invalid.`);
      }
    }
    setIsRenaming(false);
  };
  
  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameValue(node.name); // Revert to original name on escape
    }
  };


  return (
    <div 
      className="text-sm group/fileitem relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md cursor-pointer hover:bg-sidebar-accent",
          !isFolder && activeFilePath === node.path && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 1.25 + (isFolder ? 0 : 1.25) + (isRenaming ? 0.1 : 0.5)}rem` }}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !isRenaming) handleToggle(e);
            if (e.key === 'F2' && !isRenaming) { e.preventDefault(); setIsRenaming(true); setRenameValue(node.name); }
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
            onBlur={handleRenameConfirm} // Confirm on blur
            onKeyDown={handleRenameKeyDown}
            className="h-6 px-1 py-0 text-sm w-full bg-input border-primary ring-primary"
            onClick={(e) => e.stopPropagation()} // Prevent toggle when clicking input
          />
        ) : (
          <>
            <span className="truncate flex-grow">{node.name}</span>
            
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
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive/80" onClick={handleDelete} data-action-button title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {isFolder && isOpen && !isRenaming && node.children && (
        <div>
          {node.children.length > 0 ? node.children.sort((a,b) => a.name.localeCompare(b.name)).sort((a,b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1)).map((child) => ( // Sort folders first, then by name
            <FileTreeItem key={child.id} node={child} level={level + 1} />
          )) : (
             <div 
                className="pl-4 text-xs text-muted-foreground py-1 italic"
                style={{ paddingLeft: `${(level + 1) * 1.25 + 0.5 + 1.25}rem` }}
            >
                (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

    