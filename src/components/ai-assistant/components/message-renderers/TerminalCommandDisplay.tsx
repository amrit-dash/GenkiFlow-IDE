
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TerminalSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TerminalCommandDisplayProps } from '@/components/ai-assistant/types';

export const TerminalCommandDisplay: React.FC<TerminalCommandDisplayProps> = ({ msg }) => {
  if (!msg.terminalCommandData) return <p>{msg.content}</p>;

  const { status, command, output, error } = msg.terminalCommandData;

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap">{msg.content}</p>
      <Card className="bg-slate-50/50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-800">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <TerminalSquare className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium">Terminal Command</span>
            <span className={cn(
              "text-xs px-2 py-1 rounded",
              status === 'completed' ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
              status === 'failed' ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            )}>
              {status}
            </span>
          </div>
          <div className="text-xs font-mono bg-background/70 p-2 rounded mb-2">$ {command}</div>
          {output && (
            <div className="text-xs">
              <strong>Output:</strong>
              <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">{output}</pre>
            </div>
          )}
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400">
              <strong>Error:</strong>
              <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
