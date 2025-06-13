
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionButton } from './ActionButton';
import { Brain, FilePlus2, Edit } from 'lucide-react';
import { detectMainLanguage } from '@/components/ai-assistant/ai-assistant-utils';
import type { SmartCodePlacementDisplayProps } from '@/components/ai-assistant/types';
import { useIde } from '@/contexts/ide-context';

export const SmartCodePlacementDisplay: React.FC<SmartCodePlacementDisplayProps> = ({
  msg,
  isLoading,
  activeFilePath,
  handleApplyToEditor,
  actionAppliedStates,
  loadingStates,
  handleCreateFileAndInsert,
}) => {
  const { getFileSystemNode } = useIde();
  if (!msg.smartPlacementData || !msg.code) return <p>{msg.content}</p>;

  const { suggestedFiles, currentActiveFile, codeToAdd, codeType, analysis } = msg.smartPlacementData;
  const topSuggestion = analysis.topSuggestion;

  return (
    <div className="space-y-3 mt-3">
       <p className="whitespace-pre-wrap">{msg.content}</p>
      <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary dark:text-primary">Smart Code Placement</span>
            <span className="text-xs text-primary/80 dark:text-primary/90 capitalize">({codeType})</span>
          </div>

          {topSuggestion && (
            <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
              <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                🎯 Best Match: {topSuggestion.fileName}
              </div>
              <div className="text-xs text-primary/90 dark:text-primary/90">
                Confidence: {Math.round(topSuggestion.confidence * 100)}%
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {topSuggestion && (
              <ActionButton
                onClick={() => handleApplyToEditor(codeToAdd, msg.id, `${msg.id}-smart-suggested`, topSuggestion.filePath, 'Smart code placement suggestion')}
                isLoading={loadingStates[`${msg.id}-smart-suggested`]}
                isApplied={actionAppliedStates[`${msg.id}-smart-suggested`]}
                disabled={isLoading}
                icon={FilePlus2}
                buttonKey={`${msg.id}-smart-suggested`}
                variant="default"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Add to {topSuggestion.fileName}
              </ActionButton>
            )}

            {currentActiveFile && currentActiveFile !== topSuggestion?.filePath && (
              <ActionButton
                onClick={() => handleApplyToEditor(codeToAdd, msg.id, `${msg.id}-smart-current`, currentActiveFile, 'Smart code placement to current file')}
                isLoading={loadingStates[`${msg.id}-smart-current`]}
                isApplied={actionAppliedStates[`${msg.id}-smart-current`]}
                disabled={isLoading}
                icon={Edit}
                buttonKey={`${msg.id}-smart-current`}
              >
                Add to {(() => {
                  const node = getFileSystemNode(currentActiveFile);
                  return node && !Array.isArray(node) ? node.name : 'Current File';
                })()}
              </ActionButton>
            )}

            <ActionButton
              onClick={() => handleCreateFileAndInsert(
                msg.suggestedFileName || `new-${codeType}.${detectMainLanguage(codeToAdd).toLowerCase() === 'typescript' ? 'ts' : 'js'}`,
                codeToAdd,
                msg.id,
                `${msg.id}-smart-new`
              )}
              isLoading={loadingStates[`${msg.id}-smart-new`]}
              isApplied={actionAppliedStates[`${msg.id}-smart-new`]}
              disabled={isLoading}
              icon={FilePlus2}
              buttonKey={`${msg.id}-smart-new`}
            >
              Create New File
            </ActionButton>
          </div>

          {suggestedFiles.length > 1 && (
            <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
              <div className="text-xs font-medium text-primary dark:text-primary mb-2">Other Suggestions:</div>
              <div className="space-y-1">
                {suggestedFiles.slice(1, 3).map((suggestion, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-primary/90 dark:text-primary/90">{suggestion.fileName} ({Math.round(suggestion.confidence * 100)}%)</span>
                    <ActionButton
                      onClick={() => handleApplyToEditor(codeToAdd, msg.id, `${msg.id}-alt-${idx}`, suggestion.filePath, 'Alternative smart placement suggestion')}
                      isLoading={loadingStates[`${msg.id}-alt-${idx}`]}
                      isApplied={actionAppliedStates[`${msg.id}-alt-${idx}`]}
                      disabled={isLoading}
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs hover:bg-transparent"
                      buttonKey={`${msg.id}-alt-${idx}`}
                    >
                      Add
                    </ActionButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
