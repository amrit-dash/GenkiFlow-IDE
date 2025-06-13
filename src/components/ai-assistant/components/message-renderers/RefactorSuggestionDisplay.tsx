
import React from 'react';
import { CodeBlock } from './CodeBlock';
import { ActionButton } from './ActionButton';
import { Card, CardHeader, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // For RotateCcw
import { Edit, Check, RotateCcw } from 'lucide-react';
import type { RefactorSuggestionDisplayProps } from '@/components/ai-assistant/types';

export const RefactorSuggestionDisplay: React.FC<RefactorSuggestionDisplayProps> = ({
  msg,
  isLoading,
  activeFilePath,
  handleCopyCode,
  copiedStates,
  handleApplyToEditor,
  actionAppliedStates,
  loadingStates,
  forceReplaceState, // Added
  setForceReplaceState, // Added
}) => {
  const applyEditorKey = `${msg.id}-apply-editor`;

  if (!msg.suggestion) {
    return <p className="whitespace-pre-wrap">No specific refactoring suggestion found.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
      <Card className="bg-muted/60 shadow-none">
        <CardHeader className="p-2">
          <CardDescription className="text-xs">{msg.suggestion.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <CodeBlock
            code={msg.suggestion.proposedCode}
            messageId={msg.id}
            actionKeySuffix="suggestion"
            handleCopyCode={handleCopyCode}
            copiedStates={copiedStates}
            maxHeightClass="max-h-40"
          />
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={async () => await handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath, 'Refactoring suggestion', forceReplaceState[applyEditorKey])}
              isLoading={loadingStates[applyEditorKey]}
              isApplied={actionAppliedStates[applyEditorKey]}
              disabled={isLoading || (!msg.targetPath && !activeFilePath)}
              icon={Edit}
              buttonKey={applyEditorKey}
              className="mt-1"
              title={actionAppliedStates[applyEditorKey] ? "Applied" : (msg.targetPath || activeFilePath) ? "Apply to Editor" : "Apply (No file open)"}
            >
              {(msg.targetPath || activeFilePath) ? "Apply to Editor" : "Apply (No file open)"}
            </ActionButton>
            {actionAppliedStates[applyEditorKey] && (msg.targetPath || activeFilePath) && (
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                    // Toggle force replace and re-apply
                    const newForceReplace = !forceReplaceState[applyEditorKey];
                    setForceReplaceState(prev => ({...prev, [applyEditorKey]: newForceReplace }));
                    await handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath, 'Refactoring suggestion', newForceReplace);
                }}
                disabled={isLoading || loadingStates[applyEditorKey]}
                title={forceReplaceState[applyEditorKey] ? "Undo Force Replace & Re-apply (Merge)" : "Force Replace & Re-apply"}
                className="h-6 w-6 mt-1 hover:bg-transparent"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
