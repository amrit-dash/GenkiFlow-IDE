import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2, Edit, RotateCcw, Check, Wand2, FileText, Merge } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { ActionButton } from './ActionButton';
import type { GeneratedCodeDisplayProps } from '@/components/ai-assistant/types';
import { getDynamicCodeQuality } from '@/components/ai-assistant/ai-assistant-utils';

export const GeneratedCodeDisplay: React.FC<GeneratedCodeDisplayProps> = ({
  msg,
  isLoading,
  activeFilePath,
  currentCode,
  getFileSystemNode,
  handleApplyToEditor,
  handleCreateFileAndInsert,
  handleFileOperationSuggestionAction,
  copiedStates,
  actionAppliedStates,
  loadingStates,
  expandedCodePreviews,
  toggleCodePreview,
  forceReplaceState,
  setForceReplaceState,
  handleCopyCode,
}) => {
  // Simple approach - access properties directly with type assertions where needed
  const messageId = (msg as any).id;
  const messageContent = (msg as any).content;
  const messageCode = (msg as any).code;
  const messageType = (msg as any).type;

  const applyEditorKey = `${messageId}-apply-editor`;
  const createFileKey = `${messageId}-create-file`;
  const mergeFileKey = `${messageId}-merge-file`;
  const chooseLocationKey = `${messageId}-choose-location`;

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap">{messageContent}</p>
      
      {messageCode && (
        <>
          <CodeBlock
            code={messageCode}
            messageId={messageId}
            actionKeySuffix="code"
            handleCopyCode={handleCopyCode}
            copiedStates={copiedStates}
            isExpanded={expandedCodePreviews[messageId]}
            onToggleExpand={() => toggleCodePreview(messageId)}
          />
          
          {/* Interactive Options for New File Creation */}
          {messageType === 'newFileSuggestion' && expandedCodePreviews[messageId] && (
            <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary dark:text-primary">
                    How would you like to use this code?
                  </span>
                </div>
                
                <div className="space-y-2">
                  {/* Create New File Option */}
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border">
                    <div className="flex items-center gap-2">
                      <FilePlus2 className="h-4 w-4 text-primary" />
                      <div>
                        <div className="text-sm font-medium">Create New File</div>
                        <div className="text-xs text-muted-foreground">
                          {(msg as any).suggestedFileName || 'new-file.ts'}
                        </div>
                      </div>
                    </div>
                    <ActionButton
                      onClick={() => handleCreateFileAndInsert(
                        (msg as any).suggestedFileName || 'new-file.ts', 
                        messageCode!, 
                        createFileKey
                      )}
                      isLoading={loadingStates[createFileKey]}
                      isApplied={actionAppliedStates[createFileKey]}
                      disabled={isLoading}
                      icon={FilePlus2}
                      buttonKey={createFileKey}
                      size="sm"
                    >
                      Create File
                    </ActionButton>
                  </div>

                  {/* Merge with Current File Option */}
                  {activeFilePath && (
                    <div className="flex items-center justify-between p-2 bg-background/50 rounded border">
                      <div className="flex items-center gap-2">
                        <Merge className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-medium">Merge with Current File</div>
                          <div className="text-xs text-muted-foreground">
                            {(() => {
                              const activeNode = getFileSystemNode(activeFilePath);
                              return (activeNode && !Array.isArray(activeNode)) ? activeNode.name : 'Active file';
                            })()}
                          </div>
                        </div>
                      </div>
                      <ActionButton
                        onClick={() => handleApplyToEditor(
                          messageCode!, 
                          mergeFileKey, 
                          activeFilePath, 
                          'Generated code merge', 
                          forceReplaceState[mergeFileKey]
                        )}
                        isLoading={loadingStates[mergeFileKey]}
                        isApplied={actionAppliedStates[mergeFileKey]}
                        disabled={isLoading}
                        icon={Merge}
                        buttonKey={mergeFileKey}
                        size="sm"
                      >
                        Merge
                      </ActionButton>
                    </div>
                  )}

                  {/* View Generated Code Option */}
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <div className="text-sm font-medium">View Generated Code</div>
                        <div className="text-xs text-muted-foreground">
                          Preview code in a dedicated viewer
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Toggle the code preview to show the generated code
                        if (!expandedCodePreviews[messageId]) {
                          toggleCodePreview(messageId);
                        }
                        // Scroll to the code block
                        const codeElement = document.querySelector(`[data-message-id="${messageId}"] .code-block`);
                        if (codeElement) {
                          codeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View Code
                    </Button>
                  </div>
                </div>

                {/* Alternative Options */}
                {(msg as any).alternativeOptions && (msg as any).alternativeOptions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary/20">
                    <div className="text-xs font-medium text-primary/80 mb-2">
                      Alternative Options:
                    </div>
                    <div className="space-y-1">
                      {(msg as any).alternativeOptions.slice(0, 2).map((option: any, idx: number) => (
                        <div key={idx} className="text-xs text-primary/70">
                          • {option.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Standard Options for Generated Code */}
          {(messageType === 'generatedCode' || messageType === 'enhancedCodeGeneration') && expandedCodePreviews[messageId] && (
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton
                onClick={async () => await handleApplyToEditor(
                  messageCode!, 
                  applyEditorKey, 
                  (msg as any).targetPath, 
                  'Generated code from AI assistant', 
                  forceReplaceState[applyEditorKey]
                )}
                isLoading={loadingStates[applyEditorKey]}
                isApplied={actionAppliedStates[applyEditorKey]}
                disabled={isLoading || (!(msg as any).targetPath && !activeFilePath)}
                icon={Edit}
                buttonKey={applyEditorKey}
                title={(() => {
                  const targetPath = (msg as any).targetPath || activeFilePath;
                  if (!targetPath) return 'Insert (No file open)';
                  const targetNode = getFileSystemNode(targetPath);
                  const fileName = (targetNode && !Array.isArray(targetNode)) ? targetNode.name : 'Editor';
                  return forceReplaceState[applyEditorKey] ? `Replace in ${fileName}` : `Insert into ${fileName}`;
                })()}
              >
                {(() => {
                  const targetPath = (msg as any).targetPath || activeFilePath;
                  if (!targetPath) return 'Insert (No file open)';
                  const targetNode = getFileSystemNode(targetPath);
                  const fileName = (targetNode && !Array.isArray(targetNode)) ? targetNode.name : 'Editor';
                  return forceReplaceState[applyEditorKey] ? `Replace in ${fileName}` : `Insert into ${fileName}`;
                })()}
              </ActionButton>
            </div>
          )}
        </>
      )}

      {/* Enhanced Code Generation Additional Features */}
      {messageType === 'enhancedCodeGeneration' && (
        <div className="mt-3 space-y-2">
          {(msg as any).fileOperationSuggestion && (msg as any).fileOperationSuggestion.type !== 'none' && (
            <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
              <CardContent className="p-2">
                <div className="flex items-center gap-2 mb-1">
                  <FilePlus2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary dark:text-primary">File Operation Suggestion</span>
                  <span className="text-xs text-primary/80 dark:text-primary/90">({Math.round((msg as any).fileOperationSuggestion.confidence * 100)}% confidence)</span>
                </div>
                <p className="text-xs text-primary/90 dark:text-primary/90">{(msg as any).fileOperationSuggestion.reasoning}</p>
                <ActionButton
                  onClick={() => handleFileOperationSuggestionAction(
                    (msg as any).fileOperationSuggestion!.type as 'create' | 'rename' | 'delete' | 'move',
                    (msg as any).fileOperationSuggestion!.targetPath,
                    (msg as any).fileOperationSuggestion!.newName,
                    (msg as any).fileOperationSuggestion!.fileType,
                    `${messageId}-fos`,
                    (msg as any).fileOperationSuggestion.destinationPath,
                    (msg as any).fileOperationSuggestion.content || messageCode
                  )}
                  isLoading={loadingStates[`${messageId}-fos`]}
                  isApplied={actionAppliedStates[`${messageId}-fos`]}
                  disabled={isLoading}
                  icon={Wand2}
                  buttonKey={`${messageId}-fos`}
                  className="mt-2"
                >
                  Execute: {(msg as any).fileOperationSuggestion.type}
                </ActionButton>
              </CardContent>
            </Card>
          )}

          {(msg as any).alternativeOptions && (msg as any).alternativeOptions.length > 0 && (
            <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
              <CardContent className="p-2">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary dark:text-primary">Alternative Options</span>
                </div>
                <div className="space-y-1">
                  {(msg as any).alternativeOptions.slice(0, 2).map((option: any, idx: number) => (
                    <div key={idx} className="text-xs text-primary/90 dark:text-primary/90">• {option.description}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(msg as any).codeQuality && messageCode && (() => {
            const dynamicQuality = getDynamicCodeQuality((msg as any).codeQuality!, messageCode!);
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
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${dynamicQuality.codeStandards ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span>Code Standards</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${dynamicQuality.languageSpecific.languageCheck ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>{dynamicQuality.languageSpecific.languageLabel}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${dynamicQuality.isWellRefactored ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span>Well Refactored</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${(msg as any).codeQuality?.isWellDocumented ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span>Documented</span>
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
