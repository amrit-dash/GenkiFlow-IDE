
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, Check, CheckCircle2 } from 'lucide-react';
import { cleanFolderName, getDisplayNameForAttachment } from '@/components/ai-assistant/ai-assistant-utils';
import type { FilenameSuggestionDisplayProps } from '@/components/ai-assistant/types';
import { cn } from '@/lib/utils';

export const FilenameSuggestionDisplay: React.FC<FilenameSuggestionDisplayProps> = ({
  msg,
  isLoading,
  actionAppliedStates,
  handleFileOperation,
  setChatHistory,
}) => {
  if (!msg.filenameSuggestionData) return <p>{msg.content}</p>;

  const { suggestions, analysis, topSuggestion, currentFileName, targetPath, itemType } = msg.filenameSuggestionData;

  const anySuggestionApplied = (messageId: string, prefix: string) => {
    return Object.keys(actionAppliedStates).some(k => k.startsWith(`${messageId}-${prefix}-`) && actionAppliedStates[k]);
  };

  return (
    <div className="space-y-3 overflow-x-hidden">
      <p className="whitespace-pre-wrap font-medium text-sm mb-2">{msg.content}</p>

      {analysis.mainFunctions.length > 0 && (
        <div className="p-2 bg-primary/10 dark:bg-primary/15 rounded border border-primary/20 dark:border-primary/30">
          <div className="text-xs font-medium text-primary dark:text-primary">
            📝 Functions Found: {analysis.mainFunctions.join(', ')}
          </div>
        </div>
      )}

      <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
        <CardContent className="p-3 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary dark:text-primary">AI Filename Analysis</span>
          </div>
          <div className="text-xs text-primary/90 dark:text-primary/90 mb-3">
            {analysis.detectedLanguage} • {analysis.codeType}
            {itemType === 'folder' && " (Folder)"}
          </div>

          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, idx) => {
              const buttonKey = `${msg.id}-rename-${idx}`;
              const isApplied = actionAppliedStates[buttonKey];
              const anyApplied = anySuggestionApplied(msg.id, "rename");
              let displayName = suggestion.filename;
              if (itemType === 'folder') {
                displayName = cleanFolderName(suggestion.filename);
              }

              return (
                <div key={idx} className="relative p-2 bg-card/80 dark:bg-card/50 rounded border border-border mb-2">
                  <span className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary font-medium z-10">
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                  <div className="pr-12">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-mono text-sm font-medium truncate block flex-shrink min-w-0" title={suggestion.filename}>
                          {displayName}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start">
                        <p>Full suggested name: {suggestion.filename}</p>
                        <p>Category: {suggestion.category}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground mt-1 capitalize">
                      <span>{suggestion.category} Suggestion</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute h-7 w-7 hover:bg-transparent",
                      "bottom-2 right-2",
                      isApplied ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-primary',
                      (isLoading || (anyApplied && !isApplied)) && 'opacity-50 pointer-events-none',
                      anyApplied && isApplied && 'text-green-600 cursor-default hover:text-green-600'
                    )}
                    title={isApplied ? 'Applied' : `Apply name: ${displayName}`}
                    disabled={isLoading || (anyApplied && !isApplied) || (anyApplied && isApplied)}
                    onClick={async () => {
                      if (isLoading || (anyApplied && !isApplied) || (anyApplied && isApplied)) return;
                      if (targetPath) {
                        const nameToApply = itemType === 'folder' ? cleanFolderName(suggestion.filename) : suggestion.filename;
                        const result = await handleFileOperation('rename', { targetPath, newName: nameToApply });
                        if (result?.success) {
                          // This state update might need to be lifted if actionAppliedStates is not directly mutable here
                          // For now, assuming it's part of props passed down that can be updated in parent
                          setChatHistory(prev => prev.map(m => {
                            if (m.id === msg.id && m.filenameSuggestionData) {
                              return {
                                ...m,
                                filenameSuggestionData: {
                                  ...m.filenameSuggestionData,
                                  suggestions: m.filenameSuggestionData.suggestions.map(s =>
                                    s.filename === suggestion.filename ? { ...s, applied: true } : s
                                  ),
                                },
                                _internalActionAppliedStates: { ...(m as any)._internalActionAppliedStates, [buttonKey]: true }
                              };
                            }
                            return m;
                          }));
                        }
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
            <div className="text-xs text-primary/90 dark:text-primary/90 space-y-0.5">
              <div>💡 Current: {currentFileName}</div>
              <div>→ Suggested: {
                topSuggestion ? (itemType === 'folder' ? cleanFolderName(topSuggestion.filename) : topSuggestion.filename) : 'N/A'
              }</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
