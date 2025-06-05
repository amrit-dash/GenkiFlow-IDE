
"use client";

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, PlusCircle, Trash2, Edit3, FolderPlus } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showActions, setShowActions] = useState(false);
  const { openFile, activeFilePath, addNode, deleteNode, renameNode } = useIde();
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
    // Prevent toggle if click was on an action button or input
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
      addNode(node.id, fileName.trim(), 'file');
      if (!isOpen) setIsOpen(true);
    }
  };

  const handleAddFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const folderName = window.prompt("Enter new folder name (e.g., newFolder):");
    if (folderName && folderName.trim() !== "") {
      addNode(node.id, folderName.trim(), 'folder');
      if (!isOpen) setIsOpen(true);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${node.name}"?`)) {
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
      renameNode(node.id, renameValue.trim());
    }
    setIsRenaming(false);
  };
  
  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameValue(node.name);
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
          !isFolder && activeFilePath === node.path && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft: `${level * 1.25 + (isRenaming ? 0.1 : 0.5)}rem` }} // Adjust padding for input
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !isRenaming) handleToggle(e);
            if (e.key === 'F2' && !isRenaming) { e.preventDefault(); setIsRenaming(true); setRenameValue(node.name); }
        }}
      >
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
            {isFolder && (
              <ExpansionIcon className="w-4 h-4 mr-1 shrink-0" />
            )}
            <Icon className={cn("w-4 h-4 mr-2 shrink-0", isFolder ? "text-yellow-500" : "text-blue-400")} />
            <span className="truncate flex-grow">{node.name}</span>
            
            {showActions && !isRenaming && (
              <div className="ml-auto flex items-center space-x-1 opacity-0 group-hover/fileitem:opacity-100 transition-opacity duration-150">
                {isFolder && (
                  <>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddFile} data-action-button title="Add File">
                      <PlusCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddFolder} data-action-button title="Add Folder">
                      <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleRenameStart} data-action-button title="Rename">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={handleDelete} data-action-button title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {isFolder && isOpen && !isRenaming && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.id} node={child} level={level + 1} />
          ))}
          {node.children.length === 0 && (
             <div 
                className="pl-4 text-xs text-muted-foreground py-1"
                style={{ paddingLeft: `${(level + 1) * 1.25 + 0.5}rem` }}
            >
                (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

    