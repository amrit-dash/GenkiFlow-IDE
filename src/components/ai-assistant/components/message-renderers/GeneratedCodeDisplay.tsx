
import React from 'react';
import { CodeBlock } from './CodeBlock';
import { ActionButton } from './ActionButton';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2, Edit, Wand2, RotateCcw, Check, Brain } from 'lucide-react';
import { getDynamicCodeQuality } from '@/components/ai-assistant/ai-assistant-utils';
import type { GeneratedCodeDisplayProps } from '@/components/ai-assistant/types';
import { useIde } from '@/contexts/ide-context'; // For getFileSystemNode

export const GeneratedCodeDisplay: React.FC<GeneratedCodeDisplayProps> = ({
  msg,
  isLoading,
  activeFilePath,
  getFileSystemNode,
  handleCopyCode,
  copiedStates,
  handleApplyToEditor,
  actionAppliedStates,
  loadingStates,
  handleCreateFileAndInsert,
  handleFileOperationSuggestionAction,
  toggleCodePreview,
  expandedCodePreviews,
  forceReplaceState,
  setForceReplaceState,
}) => {
  const applyEditorKey = `${msg.id}-apply-editor`;
  const createFileKey = `${msg.id}-create-file`;

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap">{msg.content}</p>
      {msg.code && (
        <>
          <CodeBlock
            code={msg.code}
            messageId={msg.id}
            actionKeySuffix="code"
            handleCopyCode={handleCopyCode}
            copiedStates={copiedStates}
            isExpanded={expandedCodePreviews[msg.id]}
            onToggleExpand={() => toggleCodePreview(msg.id)}
          />
          {expandedCodePreviews[msg.id] && (
            <div className="flex items-center gap-2 flex-wrap">
              {msg.type === 'newFileSuggestion' && msg.suggestedFileName && (
                <ActionButton
                  onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id, createFileKey)}
                  isLoading={loadingStates[createFileKey]}
                  isApplied={actionAppliedStates[createFileKey]}
                  disabled={isLoading}
                  icon={FilePlus2}
                  buttonKey={createFileKey}
                  title="Create file and insert code"
                >
                  Create File & Insert
                </ActionButton>
              )}
              {(msg.type === 'generatedCode' || msg.type === 'enhancedCodeGeneration') && (
                <>
                <ActionButton
                    onClick={async () => await handleApplyToEditor(msg.code!, msg.id, applyEditorKey, msg.targetPath, 'Generated code from AI assistant', forceReplaceState[applyEditorKey])}
                    isLoading={loadingStates[applyEditorKey]}
                    isApplied={actionAppliedStates[applyEditorKey]}
                    disabled={isLoading || (!msg.targetPath && !activeFilePath)}
                    icon={Edit}
                    buttonKey={applyEditorKey}
                    title={(() => {
                        const targetPath = msg.targetPath || activeFilePath;
                        if (!targetPath) return 'Insert (No file open)';
                        const targetNode = getFileSystemNode(targetPath);
                        const fileName = (targetNode && !Array.isArray(targetNode)) ? targetNode.name : 'Editor';
                        return forceReplaceState[applyEditorKey] ? `Replace in ${fileName}` : `Insert into ${fileName}`;
                    })()}
                >
                    {(() => {
                        const targetPath = msg.targetPath || activeFilePath;
                        if (!targetPath) return 'Insert (No file open)';
                        const targetNode = getFileSystemNode(targetPath);
                        const fileName = (targetNode && !Array.isArray(targetNode)) ? targetNode.name : 'Editor';
                        return forceReplaceState[applyEditorKey] ? `Replace in ${fileName}` : `Insert into ${fileName}`;
                    })()}
                </ActionButton>
                 {actionAppliedStates[applyEditorKey] && (msg.targetPath || activeFilePath) && (
                     <Button
                       size="icon"
                       variant="ghost"
                       onClick={async () => {
                        setForceReplaceState(prev => ({...prev, [applyEditorKey]: !prev[applyEditorKey]}));
                        await handleApplyToEditor(msg.code!, msg.id, applyEditorKey, msg.targetPath, 'Generated code from AI assistant', !forceReplaceState[applyEditorKey]);
                       }}
                       disabled={isLoading || loadingStates[applyEditorKey]}
                       title={forceReplaceState[applyEditorKey] ? "Undo Force Replace & Re-apply (Merge)" : "Force Replace & Re-apply"}
                       className="h-7 w-7 hover:bg-transparent"
                     >
                       <RotateCcw className="h-4 w-4" />
                     </Button>
                   )}
                </>
              )}
            </div>
          )}
        </>
      )}
      {msg.type === 'enhancedCodeGeneration' && (
        <div className="mt-3 space-y-2">
          {msg.fileOperationSuggestion && msg.fileOperationSuggestion.type !== 'none' && (
            <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
              <CardContent className="p-2">
                <div className="flex items-center gap-2 mb-1">
                  <FilePlus2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary dark:text-primary">File Operation Suggestion</span>
                  <span className="text-xs text-primary/80 dark:text-primary/90">({Math.round(msg.fileOperationSuggestion.confidence * 100)}% confidence)</span>
                </div>
                <p className="text-xs text-primary/90 dark:text-primary/90">{msg.fileOperationSuggestion.reasoning}</p>
                <ActionButton
                  onClick={() => handleFileOperationSuggestionAction(
                    msg.fileOperationSuggestion!.type as 'create' | 'rename' | 'delete' | 'move',
                    msg.fileOperationSuggestion!.targetPath,
                    msg.fileOperationSuggestion!.newName,
                    msg.fileOperationSuggestion!.fileType,
                    `${msg.id}-fos`,
                    (msg.fileOperationSuggestion as any).destinationPath
                  )}
                  isLoading={loadingStates[`${msg.id}-fos`]}
                  isApplied={actionAppliedStates[`${msg.id}-fos`]}
                  disabled={isLoading}
                  icon={Wand2}
                  buttonKey={`${msg.id}-fos`}
                  className="mt-2"
                >
                  Execute: {msg.fileOperationSuggestion.type}
                </ActionButton>
              </CardContent>
            </Card>
          )}
          {msg.alternativeOptions && msg.alternativeOptions.length > 0 && (
            <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
              <CardContent className="p-2">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary dark:text-primary">Alternative Options</span>
                </div>
                <div className="space-y-1">
                  {msg.alternativeOptions.slice(0, 2).map((option, idx) => (
                    <div key={idx} className="text-xs text-primary/90 dark:text-primary/90">• {option.description}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {msg.codeQuality && msg.code && (() => {
            const dynamicQuality = getDynamicCodeQuality(msg.codeQuality!, msg.code!);
            return (
              <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                <CardContent className="p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-primary dark:text-primary">Code Quality</span>
                    <span className="text-xs text-primary/80 dark:text-primary/90 capitalize">({dynamicQuality.complexity} complexity)</span>
                  </div>
                  <div className="text-xs text-primary/90 dark:text-primary/90 mb-2 flex items-center gap-3">
                    <span>{dynamicQuality.languageSpecific.languageIcon} {dynamicQuality.language}</span>
                    <span>📊 {dynamicQuality.functionCount} function{dynamicQuality.functionCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className={cn("flex items-center gap-1", dynamicQuality.languageSpecific.languageCheck ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                      {dynamicQuality.languageSpecific.languageCheck ? "✓" : "○"} {dynamicQuality.languageSpecific.languageLabel}
                    </div>
                    <div className={cn("flex items-center gap-1", dynamicQuality.codeStandards ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                      {dynamicQuality.codeStandards ? "✓" : "○"} Code Standards
                    </div>
                    <div className={cn("flex items-center gap-1", dynamicQuality.isWellRefactored ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                      {dynamicQuality.isWellRefactored ? "✓" : "○"} Well Refactored
                    </div>
                    <div className={cn("flex items-center gap-1", msg.codeQuality!.isWellDocumented ? "text-primary dark:text-primary" : "text-orange-500 dark:text-orange-400")}>
                      {msg.codeQuality!.isWellDocumented ? "✓" : "○"} Documented
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
};
