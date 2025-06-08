
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Terminal as TerminalIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { Button } from '@/components/ui/button';

interface OutputLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
}

interface TerminalPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function TerminalPanel({ isVisible, onToggleVisibility }: TerminalPanelProps) {
  const { addNode, deleteNode, getFileSystemNode } = useIde();
  const [inputCommand, setInputCommand] = useState('');
  const [outputLines, setOutputLines] = useState<OutputLine[]>([
    { id: 'welcome', type: 'info', text: 'Terminal. Type "help" for commands.'}
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [currentPath, setCurrentPath] = useState('/'); 

  const addOutputLine = (text: string, type: OutputLine['type'] = 'output') => {
    setOutputLines(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).substring(2,7), text, type }]);
  };

  const resolvePath = (targetPath: string): string => {
    if (targetPath.startsWith('/')) {
      const normalizedPath = '/' + targetPath.split('/').filter(p => p).join('/');
      return normalizedPath === "/" && targetPath !== "/" ? "/" : (normalizedPath || "/");
    }

    const currentParts = currentPath === '/' ? [] : currentPath.split('/').filter(p => p);
    const targetParts = targetPath.split('/').filter(p => p);

    for (const part of targetParts) {
      if (part === '..') {
        currentParts.pop();
      } else if (part !== '.') {
        currentParts.push(part);
      }
    }
    const newPath = '/' + currentParts.join('/');
    return newPath === "/" && currentParts.length > 0 && !targetPath.endsWith('/') && targetPath !== '.' && targetPath !== '..' ? newPath : (newPath || '/');
  };


  const handleCommandSubmit = () => {
    const trimmedCommand = inputCommand.trim();
    
    addOutputLine(`${currentPath === '/' ? '~' : currentPath}$ ${trimmedCommand}`, 'input');

    if (trimmedCommand === '') {
      setInputCommand('');
      return;
    }
    
    setCommandHistory(prev => [trimmedCommand, ...prev].slice(0, 50));
    setHistoryIndex(-1); 

    const [command, ...args] = trimmedCommand.split(' ');
    const targetName = args[0];
    
    let operationPath = currentPath;
    let nameForOperation = targetName;

    if (targetName && targetName.includes('/')) {
        const parts = targetName.split('/');
        nameForOperation = parts.pop() || '';
        const dirPart = parts.join('/');
        operationPath = resolvePath(dirPart);
    } else {
        nameForOperation = targetName; // targetName is just the name, path is currentPath
    }


    switch (command.toLowerCase()) {
      case 'echo':
        addOutputLine(args.join(' '));
        break;
      case 'clear':
        setOutputLines([{ id: 'cleared', type: 'info', text: 'Terminal cleared.'}]);
        break;
      case 'help':
        addOutputLine('Available commands:');
        addOutputLine('  echo <text>         - Prints text');
        addOutputLine('  clear               - Clears the terminal');
        addOutputLine('  help                - Shows this help message');
        addOutputLine('  date                - Shows current date/time');
        addOutputLine('  ls [path]           - Lists files/folders');
        addOutputLine('  cd <path>           - Changes directory');
        addOutputLine('  pwd                 - Prints working directory');
        addOutputLine('  mkdir <name>        - Creates a directory in current or specified path');
        addOutputLine('  touch <name>        - Creates a file in current or specified path');
        addOutputLine('  rm <name>           - Deletes a file or folder from current or specified path');
        break;
      case 'date':
        addOutputLine(new Date().toLocaleString());
        break;
      case 'ls':
        {
            const pathToLs = args[0] ? resolvePath(args[0]) : currentPath;
            const node = getFileSystemNode(pathToLs);
            if (node && node.type === 'folder' && node.children) {
                if (node.children.length === 0) {
                    addOutputLine('(empty directory)');
                } else {
                    node.children.slice().sort((a,b) => a.name.localeCompare(b.name)).sort((a,b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1)).forEach(child => addOutputLine(`${child.name}${child.type === 'folder' ? '/' : ''}`));
                }
            } else if (node && node.type === 'file') {
                addOutputLine(node.name);
            } else if (pathToLs === '/') { // Listing root
                const rootNodes = getFileSystemNode('/'); // This should conceptually get root children
                if (Array.isArray(rootNodes) && rootNodes.length > 0) {
                     rootNodes.slice().sort((a,b) => a.name.localeCompare(b.name)).sort((a,b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1)).forEach(child => addOutputLine(`${child.name}${child.type === 'folder' ? '/' : ''}`));
                } else if (Array.isArray(rootNodes) && rootNodes.length === 0) {
                    addOutputLine('(empty root directory)');
                }
                 else {
                     // If getFileSystemNode('/') doesn't return an array for root, handle it or log error
                     const fs = getFileSystemNode('///get_all_root_nodes///'); // Special marker, context handles it
                     if (Array.isArray(fs)) {
                        if (fs.length === 0) addOutputLine('(empty root directory)');
                        else fs.slice().sort((a,b) => a.name.localeCompare(b.name)).sort((a,b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1)).forEach(child => addOutputLine(`${child.name}${child.type === 'folder' ? '/' : ''}`));
                     } else {
                        addOutputLine(`ls: cannot access '${args[0] || pathToLs}': No such file or directory`, 'error');
                     }
                }
            }
            else {
                addOutputLine(`ls: cannot access '${args[0] || pathToLs}': No such file or directory`, 'error');
            }
        }
        break;
      case 'pwd':
        addOutputLine(currentPath);
        break;
      case 'cd':
        if (!args[0]) {
            setCurrentPath('/'); // cd without args goes to root
            break;
        }
        const newResolvedPath = resolvePath(args[0]);
        if (newResolvedPath === '/') {
            setCurrentPath('/');
            break;
        }
        const nodeToCd = getFileSystemNode(newResolvedPath);
        if (nodeToCd && nodeToCd.type === 'folder') {
            setCurrentPath(newResolvedPath);
        } else if (nodeToCd && nodeToCd.type === 'file') {
            addOutputLine(`cd: ${args[0]}: Not a directory`, 'error');
        } else {
            addOutputLine(`cd: ${args[0]}: No such file or directory`, 'error');
        }
        break;
      case 'mkdir':
        if (!nameForOperation) { addOutputLine('mkdir: missing operand', 'error'); break; }
        
        if (operationPath === '/') {
            const createdDir = addNode(null, nameForOperation, 'folder', '/');
            if (createdDir) {
                addOutputLine(`mkdir: created directory '${nameForOperation}' in /`);
            } else {
                addOutputLine(`mkdir: cannot create directory '${nameForOperation}' at root: Already exists or invalid name`, 'error');
            }
        } else {
            const parentDirNode = getFileSystemNode(operationPath);
            if (parentDirNode && parentDirNode.type === 'folder') {
                const createdDir = addNode(parentDirNode.id, nameForOperation, 'folder', operationPath);
                if (createdDir) {
                    addOutputLine(`mkdir: created directory '${nameForOperation}' in ${operationPath}`);
                } else {
                    addOutputLine(`mkdir: cannot create directory '${nameForOperation}' in ${operationPath}: Already exists or invalid name`, 'error');
                }
            } else {
                addOutputLine(`mkdir: cannot create directory in '${operationPath}': No such directory or not a folder`, 'error');
            }
        }
        break;
      case 'touch':
        if (!nameForOperation) { addOutputLine('touch: missing operand', 'error'); break; }

        if (operationPath === '/') {
            const createdFile = addNode(null, nameForOperation, 'file', '/');
            if (createdFile) {
                addOutputLine(`touch: created file '${nameForOperation}' in /`);
            } else {
                addOutputLine(`touch: cannot create file '${nameForOperation}' at root: Already exists or invalid name`, 'error');
            }
        } else {
            const parentDirNode = getFileSystemNode(operationPath);
            if (parentDirNode && parentDirNode.type === 'folder') {
                const createdFile = addNode(parentDirNode.id, nameForOperation, 'file', operationPath);
                if (createdFile) {
                    addOutputLine(`touch: created file '${nameForOperation}' in ${operationPath}`);
                } else {
                    addOutputLine(`touch: cannot create file '${nameForOperation}' in ${operationPath}: Already exists or invalid name`, 'error');
                }
            } else {
                addOutputLine(`touch: cannot create file in '${operationPath}': No such directory or not a folder`, 'error');
            }
        }
        break;
      case 'rm':
        if (!nameForOperation) { addOutputLine('rm: missing operand', 'error'); break; }
        const fullPathToDelete = (operationPath === '/' && !nameForOperation.startsWith('/') ? '/' : (operationPath === '/' ? '' : operationPath + '/')) + nameForOperation;
        const nodeToDelete = getFileSystemNode(fullPathToDelete); 
        if (nodeToDelete) {
            const success = deleteNode(nodeToDelete.id); 
            if (success) addOutputLine(`rm: removed '${nameForOperation}' from ${operationPath}`);
            else addOutputLine(`rm: cannot remove '${nameForOperation}': Deletion failed.`, 'error');
        } else {
            addOutputLine(`rm: cannot remove '${nameForOperation}': No such file or directory in ${operationPath}`, 'error');
        }
        break;
      default:
        addOutputLine(`${command}: command not found`, 'error');
    }
    setInputCommand('');
  };

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [outputLines]);
  
  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommandSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setInputCommand(commandHistory[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputCommand(commandHistory[newIndex] || '');
      } else if (historyIndex === 0) { 
        setHistoryIndex(-1);
        setInputCommand('');
      }
    } else if (e.key === 'Tab') {
        e.preventDefault();
        const commonCommands = ['clear', 'echo', 'help', 'date', 'ls', 'cd', 'pwd', 'mkdir', 'touch', 'rm'];
        const currentInput = inputCommand.toLowerCase();
        const matches = commonCommands.filter(cmd => cmd.startsWith(currentInput));
        if (matches.length === 1) {
            setInputCommand(matches[0] + ' ');
        } else if (matches.length > 1) {
            addOutputLine(matches.join('  '), 'info');
        }
    }
  };

  return (
    <div 
        className="flex flex-col h-full bg-card text-card-foreground font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center">
          <TerminalIcon className="w-4 h-4 mr-2 text-primary" />
          <h3 className="font-semibold text-xs">TERMINAL</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleVisibility} className="h-6 w-6" data-action-button>
          {isVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="sr-only">{isVisible ? "Hide Terminal" : "Show Terminal"}</span>
        </Button>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-1">
        <div className="p-2 whitespace-pre-wrap">
          {outputLines.map(line => (
            <div 
                key={line.id} 
                className={cn(
                    "min-h-[1.2em]", 
                    line.type === 'error' && 'text-destructive',
                    line.type === 'input' && 'text-muted-foreground/80',
                    line.type === 'info' && 'text-primary/90'
                )}
            >
              {line.text}
            </div>
          ))}
          <div />
        </div>
      </ScrollArea>
      <div className="flex items-center p-1 border-t border-border">
        <span className="mr-2 text-primary ml-1">{currentPath === '/' ? '~' : currentPath}$</span>
        <Input
          ref={inputRef}
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-6 font-mono text-sm"
          placeholder=""
          spellCheck="false"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
    

    