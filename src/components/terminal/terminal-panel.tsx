
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Terminal as TerminalIcon } from 'lucide-react';

interface OutputLine {
  id: string;
  type: 'input' | 'output' | 'error';
  text: string;
}

export function TerminalPanel() {
  const [inputCommand, setInputCommand] = useState('');
  const [outputLines, setOutputLines] = useState<OutputLine[]>([
    { id: 'welcome', type: 'output', text: 'Mock Terminal Integrated. Type "help" for commands.'}
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means current input, 0 is newest history item
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addOutputLine = (text: string, type: OutputLine['type'] = 'output') => {
    setOutputLines(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).substring(2,7), text, type }]);
  };

  const handleCommandSubmit = () => {
    const trimmedCommand = inputCommand.trim();
    
    addOutputLine(`> ${trimmedCommand}`, 'input');

    if (trimmedCommand === '') {
      setInputCommand('');
      return;
    }
    
    setCommandHistory(prev => [trimmedCommand, ...prev].slice(0, 50));
    setHistoryIndex(-1); 

    const [command, ...args] = trimmedCommand.split(' ');
    switch (command.toLowerCase()) {
      case 'echo':
        addOutputLine(args.join(' '));
        break;
      case 'clear':
        setOutputLines([]);
        break;
      case 'help':
        addOutputLine('Available mock commands:');
        addOutputLine('  echo <text>  - Prints text to the terminal');
        addOutputLine('  clear        - Clears the terminal screen');
        addOutputLine('  help         - Shows this help message');
        addOutputLine('  date         - Shows the current date and time');
        addOutputLine('  ls           - (Mock) Lists files');
        addOutputLine('  pwd          - (Mock) Prints working directory');
        addOutputLine('  whoami       - (Mock) Prints current user');
        break;
      case 'date':
        addOutputLine(new Date().toLocaleString());
        break;
      case 'ls':
        addOutputLine('src  public  package.json  README.md node_modules');
        break;
      case 'pwd':
        addOutputLine('/home/user/app');
        break;
      case 'whoami':
        addOutputLine('developer');
        break;
      default:
        addOutputLine(`command not found: ${command}`, 'error');
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
    inputRef.current?.focus();
  }, []);

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
      } else if (historyIndex === 0) { // From oldest history item to blank
        setHistoryIndex(-1);
        setInputCommand('');
      }
    } else if (e.key === 'Tab') {
        // Basic tab completion mock (could be expanded)
        if (inputCommand.startsWith('cl')) {
            e.preventDefault();
            setInputCommand('clear ');
        } else if (inputCommand.startsWith('ec')) {
            e.preventDefault();
            setInputCommand('echo ');
        }
    }
  };

  return (
    <div 
        className="flex flex-col h-full bg-card text-card-foreground font-mono text-sm"
        onClick={() => inputRef.current?.focus()} // Focus input when clicking anywhere in terminal
    >
      <div className="flex items-center p-2 border-b border-border">
        <TerminalIcon className="w-4 h-4 mr-2 text-primary" />
        <h3 className="font-semibold text-xs">TERMINAL</h3>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-1">
        <div className="p-2 whitespace-pre-wrap">
          {outputLines.map(line => (
            <div 
                key={line.id} 
                className={cn(
                    "min-h-[1.2em]", // Ensure line takes up space even if empty
                    line.type === 'error' && 'text-destructive',
                    line.type === 'input' && 'text-muted-foreground/80'
                )}
            >
              {line.text}
            </div>
          ))}
           {/* This div ensures that the input prompt is always at the bottom when there's scroll */}
          <div />
        </div>
      </ScrollArea>
      <div className="flex items-center p-1 border-t border-border">
        <span className="mr-2 text-primary ml-1">&gt;</span>
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
