
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import { Brain, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmartFolderOperationDisplayProps } from '@/components/ai-assistant/types';

export const SmartFolderOperationDisplay: React.FC<SmartFolderOperationDisplayProps> = ({
  msg,
  isLoading,
  actionAppliedStates,
  handleFileOperation,
  setChatHistory, // Used to update internal state for applied buttons
}) => {
  if (!msg.smartFolderOperationData) return <p>{msg.content}</p>;

  const { operation, confidence, folderAnalysis, suggestions, targetPath, reasoning } = msg.smartFolderOperationData;
  const anySuggestionApplied = (messageId: string, prefix: string) => {
    return Object.keys(actionAppliedStates).some(k => k.startsWith(`${messageId}-${prefix}-`) && actionAppliedStates[k]);
  };

  return (
    <div className="space-y-3">
      <div className="whitespace-pre-wrap font-medium text-sm mb-2">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
      <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary dark:text-primary">
              Smart {operation.charAt(0).toUpperCase() + operation.slice(1)} Suggestions
            </span>
            <span className="text-xs text-primary/80 dark:text-primary/90">
              ({Math.round(confidence * 100)}% confidence)
            </span>
          </div>
          {folderAnalysis && (
            <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
              <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                📁 Folder Analysis: {folderAnalysis.totalFiles} files, {folderAnalysis.languages.join(', ')}
              </div>
              <div className="text-xs text-primary/90 dark:text-primary/90">Purpose: {folderAnalysis.primaryPurpose}</div>
            </div>
          )}
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, idx) => {
              const buttonKey = `${msg.id}-folder-${idx}`;
              const isApplied = (msg as any)._internalActionAppliedStates?.[buttonKey] || actionAppliedStates[buttonKey]; // Check internal state first
              const anyApplied = anySuggestionApplied(msg.id, "folder") || Object.values((msg as any)._internalActionAppliedStates || {}).some(v => v);


              return (
                <div key={idx} className="relative flex items-center justify-between p-2 bg-card/80 dark:bg-card/50 rounded border border-border mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{suggestion.folderName}</span>
                      <span className={cn("text-xs px-2 py-1 rounded", "bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary")}>
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{suggestion.reasoning}</div>
                    <div className="text-xs text-primary/90 dark:text-primary/90 mt-1">📂 {suggestion.folderPath}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute bottom-2 right-2 h-7 w-7 hover:bg-transparent",
                      isApplied ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-primary',
                      (isLoading || (anyApplied && !isApplied)) && 'opacity-50 pointer-events-none',
                      anyApplied && isApplied && 'text-green-600 cursor-default hover:text-green-600'
                    )}
                    title={isApplied ? 'Applied' : `Use this ${operation === 'move' ? 'destination' : 'name'}`}
                    disabled={isLoading || (anyApplied && !isApplied) || (anyApplied && isApplied)}
                    onClick={async () => {
                      if (isLoading || (anyApplied && !isApplied) || (anyApplied && isApplied)) return;
                      let result;
                      if (operation === 'move') {
                        result = await handleFileOperation('move', { targetPath, destinationPath: suggestion.folderPath });
                      } else if (operation === 'rename') {
                        result = await handleFileOperation('rename', { targetPath, newName: suggestion.folderName });
                      } else if (operation === 'delete') {
                        result = await handleFileOperation('delete', { targetPath: suggestion.folderPath });
                      }
                      if (result?.success) {
                        setChatHistory(prev => prev.map(m => {
                          if (m.id === msg.id) {
                            return { ...m, _internalActionAppliedStates: { ...((m as any)._internalActionAppliedStates || {}), [buttonKey]: true } };
                          }
                          return m;
                        }));
                      }
                    }}
                  >
                    {isApplied ? <CheckCircle2 className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
            <div className="text-xs text-primary/90 dark:text-primary/90">
              🤖 {reasoning}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
