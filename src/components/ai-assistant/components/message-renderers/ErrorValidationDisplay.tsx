
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Lightbulb, Wand2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { ActionButton } from './ActionButton';
import type { ErrorValidationDisplayProps } from '@/components/ai-assistant/types';
import { cn } from '@/lib/utils';

export const ErrorValidationDisplay: React.FC<ErrorValidationDisplayProps> = ({
  msg,
  isLoading,
  handleCopyCode,
  copiedStates,
  handleApplyToEditor,
  actionAppliedStates,
  loadingStates,
}) => {
  if (!msg.errorValidationData) return <p>{msg.content}</p>;

  const { hasErrors, errors, suggestions, codeQuality } = msg.errorValidationData;
  const applyFixKeyPrefix = `${msg.id}-apply-fix-`;

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap font-medium">{msg.content}</p>

      <Card className={cn("border-2", hasErrors ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-500/5")}>
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center">
            {hasErrors ? <AlertTriangle className="h-4 w-4 mr-2 text-destructive" /> : <CheckCircle className="h-4 w-4 mr-2 text-green-500" />}
            Validation Result
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2 text-xs">
          {hasErrors && errors.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1">Errors/Warnings ({errors.length}):</h4>
              <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto themed-scrollbar pr-2">
                {errors.map((err, idx) => (
                  <li key={idx} className={cn(err.severity === 'error' ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400')}>
                    Line {err.line || 'N/A'}: {err.message} ({err.severity})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {suggestions && suggestions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1 mt-2 flex items-center"><Lightbulb className="h-4 w-4 mr-1.5 text-blue-500"/>Suggested Fixes:</h4>
              {suggestions.map((sug, idx) => (
                <div key={idx} className="p-2 bg-card/80 dark:bg-card/60 rounded border border-border mb-2">
                  <p className="text-xs text-muted-foreground mb-1">{sug.description} (Confidence: {Math.round(sug.confidence*100)}%)</p>
                  <CodeBlock
                    code={sug.fixedCode}
                    messageId={msg.id}
                    actionKeySuffix={`fix-${idx}`}
                    handleCopyCode={handleCopyCode}
                    copiedStates={copiedStates}
                    maxHeightClass="max-h-32"
                  />
                  <ActionButton
                    onClick={() => handleApplyToEditor(sug.fixedCode, msg.id, `${applyFixKeyPrefix}${idx}`, msg.targetPath, `Applying suggested fix for ${sug.description}`)}
                    isLoading={loadingStates[`${applyFixKeyPrefix}${idx}`]}
                    isApplied={actionAppliedStates[`${applyFixKeyPrefix}${idx}`]}
                    disabled={isLoading || !msg.targetPath}
                    icon={Wand2}
                    buttonKey={`${applyFixKeyPrefix}${idx}`}
                    size="sm"
                    className="mt-1.5"
                  >
                    Apply Fix
                  </ActionButton>
                </div>
              ))}
            </div>
          )}
          {codeQuality && (
            <div>
              <h4 className="font-semibold mb-1 mt-2">Code Quality (Score: {codeQuality.score.toFixed(1)}/10):</h4>
              {codeQuality.issues.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Issues:</p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground/80">
                    {codeQuality.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                </>
              )}
              {codeQuality.improvements.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Improvements:</p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground/80">
                    {codeQuality.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
          {!hasErrors && <p className="text-green-600 dark:text-green-400">No issues found. Code quality score: {codeQuality?.score.toFixed(1)}/10</p>}
        </CardContent>
      </Card>
    </div>
  );
};
