
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Brain, User, BotIcon, ClipboardCopy, Check, FilePlus2, Edit, RotateCcw, Undo2, AlertTriangle, FolderOpen, FileText, Wand2, CheckCircle2, TerminalSquare, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMessageItemProps, FilenameSuggestionDataForPanel } from './types'; // Ensure this path is correct
import { getDynamicCodeQuality, getDisplayName, cleanFolderName } from './ai-assistant-utils';
import { useIde } from '@/contexts/ide-context'; // For getFileOrFolderIcon


const getFileOrFolderIcon = (itemType: 'file' | 'folder') => {
  if (itemType === 'folder') return <FolderOpen className="inline h-4 w-4 mr-1 text-primary shrink-0" />;
  return <FileText className="inline h-4 w-4 mr-1 text-primary shrink-0" />;
};


export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  msg,
  isLoading,
  activeFilePath,
  openedFiles,
  fileSystem,
  getFileSystemNode,
  handleCopyCode,
  copiedStates,
  handleApplyToEditor,
  actionAppliedStates,
  loadingStates,
  handleCreateFileAndInsert,
  handleFileOperationSuggestionAction,
  undoStack,
  executeUndo,
  setUndoStack,
  handleFileOperation,
  setChatHistory,
  toggleCodePreview,
  expandedCodePreviews,
  forceReplaceState,
  setForceReplaceState
}) => {

  const applyEditorKey = `${msg.id}-apply-editor`;
  const createFileKey = `${msg.id}-create-file`;
  const applyGeneratedCodeKey = `${msg.id}-apply-generated`;

  const anySuggestionApplied = (messageId: string, prefix: string) => {
    return Object.keys(actionAppliedStates).some(k => k.startsWith(`${messageId}-${prefix}-`) && actionAppliedStates[k]);
  };
  

  return (
    <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
      <Card className={cn("max-w-[85%] p-0 shadow-sm overflow-x-hidden", msg.role === 'user' ? "bg-primary/20" : "bg-card/90")}>
        <CardHeader className="p-3 pb-2 flex flex-row items-center gap-2">
          {msg.role === 'assistant' && <BotIcon className="w-5 h-5 text-primary" />}
          {msg.role === 'user' && <User className="w-5 h-5 text-primary" />}
          <CardDescription className={cn("text-xs", msg.role === 'user' ? "text-primary-foreground/90" : "text-muted-foreground")}>
            {msg.role === 'user' ? 'You' : 'AI Assistant'} {msg.type === 'loading' ? 'is thinking...' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm">
          {msg.type === 'loading' && <Brain className="h-5 w-5 animate-pulse text-primary" />}
          {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}
          {msg.type === 'error' && <p className="text-destructive whitespace-pre-wrap">{msg.content}</p>}

          {(msg.type === 'generatedCode' || msg.type === 'newFileSuggestion' || msg.type === 'enhancedCodeGeneration') && msg.code && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="mb-1"
                onClick={() => toggleCodePreview(msg.id)}
              >
                {expandedCodePreviews[msg.id] ? 'Hide Generated Code' : 'View Generated Code'}
              </Button>
              {expandedCodePreviews[msg.id] && (
                <div className="relative bg-muted p-2 rounded-md group themed-scrollbar mt-1">
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap max-h-60 font-code themed-scrollbar"><code>{msg.code}</code></pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent"
                    onClick={() => handleCopyCode(msg.code!, `${msg.id}-code`)}
                    title={copiedStates[`${msg.id}-code`] ? "Copied!" : "Copy code"}
                  >
                    {copiedStates[`${msg.id}-code`] ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
              {msg.type === 'newFileSuggestion' && msg.suggestedFileName && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id, createFileKey)}
                    disabled={isLoading || actionAppliedStates[createFileKey] || loadingStates[createFileKey]}
                  >
                    {actionAppliedStates[createFileKey] ? (
                      <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                    ) : (
                      <><FilePlus2 className="mr-1.5 h-4 w-4" /> Create File & Insert</>
                    )}
                    {loadingStates[createFileKey] && <Brain className="h-4 w-4 animate-pulse ml-1" />}
                  </Button>
                  {actionAppliedStates[createFileKey] && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCreateFileAndInsert(msg.suggestedFileName!, msg.code!, msg.id, createFileKey)}
                      disabled={isLoading || loadingStates[createFileKey]}
                      title="Re-apply: Create File & Insert"
                      className="h-7 w-7 hover:bg-transparent"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {(msg.type === 'generatedCode' || msg.type === 'enhancedCodeGeneration') && (
                 <div className="flex items-center gap-2">
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={async () => await handleApplyToEditor(msg.code!, msg.id, applyGeneratedCodeKey, msg.targetPath, 'Generated code from AI assistant', forceReplaceState[applyGeneratedCodeKey])}
                     disabled={isLoading || (!msg.targetPath && !activeFilePath) || actionAppliedStates[applyGeneratedCodeKey] || loadingStates[applyGeneratedCodeKey]}
                   >
                     {actionAppliedStates[applyGeneratedCodeKey] ? (
                       <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                     ) : (
                       <><Edit className="mr-1.5 h-4 w-4" /> { (() => {
                         const targetPath = msg.targetPath || activeFilePath;
                         if (!targetPath) return 'Insert (No file open)';
                         const targetNode = getFileSystemNode(targetPath);
                         const fileName = (targetNode && !Array.isArray(targetNode)) ? targetNode.name : 'Editor';
                         return forceReplaceState[applyGeneratedCodeKey] ? `Replace in ${fileName}` : `Insert into ${fileName}`;
                       })()}
                       {loadingStates[applyGeneratedCodeKey] && <Brain className="h-4 w-4 animate-pulse ml-1" />}
                       </>
                     )}
                   </Button>
                   {actionAppliedStates[applyGeneratedCodeKey] && (msg.targetPath || activeFilePath) && (
                     <Button
                       size="icon"
                       variant="ghost"
                       onClick={async () => {
                        setForceReplaceState(prev => ({...prev, [applyGeneratedCodeKey]: !prev[applyGeneratedCodeKey]})); 
                        await handleApplyToEditor(msg.code!, msg.id, applyGeneratedCodeKey, msg.targetPath, 'Generated code from AI assistant', !forceReplaceState[applyGeneratedCodeKey]);
                       }}
                       disabled={isLoading || loadingStates[applyGeneratedCodeKey]}
                       title={forceReplaceState[applyGeneratedCodeKey] ? "Undo Force Replace & Re-apply (Merge)" : "Force Replace & Re-apply"}
                       className="h-7 w-7 hover:bg-transparent"
                     >
                       <RotateCcw className="h-4 w-4" />
                     </Button>
                   )}
                 </div>
              )}

              {msg.type === 'enhancedCodeGeneration' && (
                <div className="mt-3 space-y-2">
                  {msg.fileOperationSuggestion && msg.fileOperationSuggestion.type !== 'none' && (
                    <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                      <CardContent className="p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <FilePlus2 className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-primary dark:text-primary">
                            File Operation Suggestion
                          </span>
                          <span className="text-xs text-primary/80 dark:text-primary/90">
                            ({Math.round(msg.fileOperationSuggestion.confidence * 100)}% confidence)
                          </span>
                        </div>
                        <p className="text-xs text-primary/90 dark:text-primary/90">{msg.fileOperationSuggestion.reasoning}</p>
                         <Button 
                            size="sm" 
                            variant="outline" 
                            className="mt-2"
                            onClick={() => handleFileOperationSuggestionAction(
                                msg.fileOperationSuggestion!.type as 'create' | 'rename' | 'delete' | 'move',
                                msg.fileOperationSuggestion!.targetPath,
                                msg.fileOperationSuggestion!.newName,
                                msg.fileOperationSuggestion!.fileType,
                                `${msg.id}-fos`,
                                (msg.fileOperationSuggestion as any).destinationPath
                            )}
                            disabled={isLoading || actionAppliedStates[`${msg.id}-fos`] || loadingStates[`${msg.id}-fos`]}
                            >
                             {loadingStates[`${msg.id}-fos`] ? <Brain className="mr-1.5 h-4 w-4 animate-pulse" /> : 
                              actionAppliedStates[`${msg.id}-fos`] ? <Check className="mr-1.5 h-4 w-4 text-green-500" /> : 
                              <Wand2 className="mr-1.5 h-4 w-4" />
                             }
                             {actionAppliedStates[`${msg.id}-fos`] ? 'Applied' : `Execute: ${msg.fileOperationSuggestion.type}`}
                         </Button>
                      </CardContent>
                    </Card>
                  )}

                  {msg.alternativeOptions && msg.alternativeOptions.length > 0 && (
                    <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                      <CardContent className="p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <RotateCcw className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-primary dark:text-primary">
                            Alternative Options
                          </span>
                        </div>
                        <div className="space-y-1">
                          {msg.alternativeOptions.slice(0, 2).map((option, idx) => (
                            <div key={idx} className="text-xs text-primary/90 dark:text-primary/90">
                              • {option.description}
                            </div>
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
                          <span className="text-xs font-medium text-primary dark:text-primary">
                            Code Quality
                          </span>
                          <span className="text-xs text-primary/80 dark:text-primary/90 capitalize">
                              ({dynamicQuality.complexity} complexity)
                          </span>
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
          )}

          {msg.type === 'smartCodePlacement' && msg.smartPlacementData && (
            <div className="space-y-3 mt-3">
              <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary dark:text-primary">
                      Smart Code Placement
                    </span>
                    <span className="text-xs text-primary/80 dark:text-primary/90 capitalize">
                      ({msg.smartPlacementData.codeType})
                    </span>
                  </div>
                  
                  {msg.smartPlacementData.analysis.topSuggestion && (
                    <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
                      <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                        🎯 Best Match: {msg.smartPlacementData.analysis.topSuggestion.fileName}
                      </div>
                      <div className="text-xs text-primary/90 dark:text-primary/90">
                        Confidence: {Math.round(msg.smartPlacementData.analysis.topSuggestion.confidence * 100)}%
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {msg.smartPlacementData.analysis.topSuggestion && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={async () => await handleApplyToEditor(
                          msg.code!, 
                          msg.id, 
                          `${msg.id}-smart-suggested`,
                          msg.smartPlacementData!.analysis.topSuggestion!.filePath,
                          'Smart code placement suggestion'
                        )}
                        disabled={isLoading || actionAppliedStates[`${msg.id}-smart-suggested`] || loadingStates[`${msg.id}-smart-suggested`]}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {actionAppliedStates[`${msg.id}-smart-suggested`] ? (
                          <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                        ) : (
                          <><FilePlus2 className="mr-1.5 h-4 w-4" /> Add to {msg.smartPlacementData.analysis.topSuggestion.fileName}</>
                        )}
                        {loadingStates[`${msg.id}-smart-suggested`] && <Brain className="h-4 w-4 animate-pulse ml-1" />}
                      </Button>
                    )}

                    {activeFilePath && activeFilePath !== msg.smartPlacementData.analysis.topSuggestion?.filePath && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => await handleApplyToEditor(
                          msg.code!, 
                          msg.id, 
                          `${msg.id}-smart-current`,
                          activeFilePath,
                          'Smart code placement to current file'
                        )}
                        disabled={isLoading || actionAppliedStates[`${msg.id}-smart-current`] || loadingStates[`${msg.id}-smart-current`]}
                      >
                        {actionAppliedStates[`${msg.id}-smart-current`] ? (
                          <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Applied</>
                        ) : (
                          <><Edit className="mr-1.5 h-4 w-4" /> Add to {(() => {
                            const currentNode = getFileSystemNode(activeFilePath);
                            return currentNode && !Array.isArray(currentNode) ? currentNode.name : 'Current File';
                          })()}</>
                        )}
                        {loadingStates[`${msg.id}-smart-current`] && <Brain className="h-4 w-4 animate-pulse ml-1" />}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateFileAndInsert(
                        msg.suggestedFileName || `new-${msg.smartPlacementData!.codeType}.${detectMainLanguage(msg.code!).toLowerCase() === 'typescript' ? 'ts' : 'js'}`,
                        msg.code!,
                        msg.id,
                        `${msg.id}-smart-new`
                      )}
                      disabled={isLoading || actionAppliedStates[`${msg.id}-smart-new`] || loadingStates[`${msg.id}-smart-new`]}
                    >
                      {actionAppliedStates[`${msg.id}-smart-new`] ? (
                        <><Check className="mr-1.5 h-4 w-4 text-green-500" /> Created</>
                      ) : (
                        <><FilePlus2 className="mr-1.5 h-4 w-4" /> Create New File</>
                      )}
                      {loadingStates[`${msg.id}-smart-new`] && <Brain className="h-4 w-4 animate-pulse ml-1" />}
                    </Button>
                  </div>

                  {msg.smartPlacementData.suggestedFiles.length > 1 && (
                    <div className="mt-3 pt-2 border-t border-primary/20 dark:border-primary/30">
                      <div className="text-xs font-medium text-primary dark:text-primary mb-2">
                        Other Suggestions:
                      </div>
                      <div className="space-y-1">
                        {msg.smartPlacementData.suggestedFiles.slice(1, 3).map((suggestion, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-primary/90 dark:text-primary/90">
                              {suggestion.fileName} ({Math.round(suggestion.confidence * 100)}%)
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs hover:bg-transparent"
                              onClick={async () => await handleApplyToEditor(
                                msg.code!,
                                msg.id,
                                `${msg.id}-alt-${idx}`,
                                suggestion.filePath,
                                'Alternative smart placement suggestion'
                              )}
                              disabled={isLoading || actionAppliedStates[`${msg.id}-alt-${idx}`] || loadingStates[`${msg.id}-alt-${idx}`]}
                            >
                              {actionAppliedStates[`${msg.id}-alt-${idx}`] ? 'Applied' : 'Add'}
                              {loadingStates[`${msg.id}-alt-${idx}`] && <Brain className="h-3 w-3 animate-pulse ml-1" />}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {msg.type === 'refactorSuggestion' && msg.suggestion && (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
              <Card className="bg-muted/60 shadow-none">
                <CardHeader className="p-2">
                  <CardDescription className="text-xs">{msg.suggestion.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <div className="relative bg-background/70 p-1.5 rounded-md group themed-scrollbar mb-1.5">
                    <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap font-code themed-scrollbar"><code>{msg.suggestion.proposedCode}</code></pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent"
                      onClick={() => handleCopyCode(msg.suggestion!.proposedCode, `${msg.id}-suggestion`)}
                      title={copiedStates[`${msg.id}-suggestion`] ? "Copied!" : "Copy code"}
                    >
                      {copiedStates[`${msg.id}-suggestion`] ? <Check className="h-3 w-3 text-green-500" /> : <ClipboardCopy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={async () => await handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath, 'Refactoring suggestion')}
                      disabled={isLoading || (!msg.targetPath && !activeFilePath) || actionAppliedStates[applyEditorKey]}
                    >
                      {actionAppliedStates[applyEditorKey] ? (
                        <><Check className="mr-1.5 h-3 w-3 text-green-500" /> Applied</>
                      ) : (
                        <>{(msg.targetPath || activeFilePath) ? 'Apply to Editor' : 'Apply (No file open)'}</>
                      )}
                       {loadingStates[applyEditorKey] && <Brain className="h-4 w-4 animate-pulse ml-1" />}
                    </Button>
                    {actionAppliedStates[applyEditorKey] && (msg.targetPath || activeFilePath) && (
                       <Button
                         size="icon"
                         variant="ghost"
                         onClick={async () => await handleApplyToEditor(msg.suggestion!.proposedCode, msg.id, applyEditorKey, msg.targetPath, 'Refactoring suggestion')}
                         disabled={isLoading || loadingStates[applyEditorKey]}
                         title="Re-apply: Apply to Editor"
                         className="h-6 w-6 mt-1 hover:bg-transparent"
                       >
                         <RotateCcw className="h-3.5 w-3.5" />
                       </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {msg.type === 'refactorSuggestion' && !msg.suggestion && (
               <p className="whitespace-pre-wrap">No specific refactoring suggestion found.</p>
          )}

          {msg.type === 'codeExamples' && msg.examples && (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
              {msg.examples.map((ex, i) => (
                <div key={i} className="relative bg-muted p-2 rounded-md group themed-scrollbar">
                  <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap font-code themed-scrollbar"><code>{ex}</code></pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent"
                    onClick={() => handleCopyCode(ex, `${msg.id}-example-${i}`)}
                    title={copiedStates[`${msg.id}-example-${i}`] ? "Copied!" : "Copy code"}
                  >
                    {copiedStates[`${msg.id}-example-${i}`] ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {msg.type === 'fileOperationExecution' && msg.fileOperationData && (
            <div className="space-y-2">
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <Card className={cn("border-2", msg.fileOperationData.success ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800")}>
                    <CardContent className={cn("p-3", msg.fileOperationData.operation === 'rename' && msg.fileOperationData.success && "relative")}>
                        <div className="flex items-center gap-2 mb-1">
                            {msg.fileOperationData.success ? <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                            <span className="text-sm font-medium capitalize flex-grow">
                                {msg.fileOperationData.operation} Operation
                            </span>
                        </div>
                        <div className="pl-6">
                            {msg.fileOperationData.targetPath && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    <strong>Target:</strong> {msg.fileOperationData.targetPath}
                                </div>
                            )}
                            {msg.fileOperationData.newName && (
                                <div className="text-xs text-muted-foreground">
                                    <strong>New Name:</strong> {msg.fileOperationData.newName}
                                </div>
                            )}
                            {msg.fileOperationData.destinationPath && (
                              <div className="text-xs text-muted-foreground">
                                  <strong>Destination:</strong> {msg.fileOperationData.destinationPath}
                              </div>
                            )}
                        </div>
                         {msg.fileOperationData.success && undoStack.find(op => op.type === msg.fileOperationData?.operation && op.data.originalPath === msg.fileOperationData?.targetPath && op.data.newPath === msg.fileOperationData?.newPath) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-transparent shrink-0 absolute top-3 right-3"
                              onClick={() => {
                                  const recentOp = undoStack.find(op => 
                                      op.type === msg.fileOperationData?.operation && 
                                      op.data.originalPath === msg.fileOperationData?.targetPath &&
                                      op.data.newPath === msg.fileOperationData?.newPath
                                  );
                                  if (recentOp) { 
                                      executeUndo(recentOp); 
                                      setUndoStack(prev => prev.filter(op => op.timestamp !== recentOp.timestamp)); 
                                  }
                              }}
                              title={`Undo ${msg.fileOperationData.operation}`}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {msg.fileOperationData.filesFound && msg.fileOperationData.filesFound.length > 0 && (
                            <div className="text-xs mt-2 pl-6"><strong>Items Found ({msg.fileOperationData.filesFound.length}):</strong>
                                <div className="mt-1 max-h-32 overflow-y-auto space-y-1 themed-scrollbar">
                                    {msg.fileOperationData.filesFound.slice(0, 10).map((file, idx) => (<div key={idx} className="text-muted-foreground">• {file}</div>))}
                                    {msg.fileOperationData.filesFound.length > 10 && (<div className="text-muted-foreground">... and {msg.fileOperationData.filesFound.length - 10} more</div>)}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
          )}

          {msg.type === 'terminalCommandExecution' && msg.terminalCommandData && (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <Card className="bg-slate-50/50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TerminalSquare className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium">Terminal Command</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      msg.terminalCommandData.status === 'completed' 
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : msg.terminalCommandData.status === 'failed'
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    )}>
                      {msg.terminalCommandData.status}
                    </span>
                  </div>
                  
                  <div className="text-xs font-mono bg-background/70 p-2 rounded mb-2">
                    $ {msg.terminalCommandData.command}
                  </div>
                  
                  {msg.terminalCommandData.output && (
                    <div className="text-xs">
                      <strong>Output:</strong>
                      <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">{msg.terminalCommandData.output}</pre>
                    </div>
                  )}
                  
                  {msg.terminalCommandData.error && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      <strong>Error:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{msg.terminalCommandData.error}</pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {msg.type === 'smartFolderOperation' && msg.smartFolderOperationData && (
            <div className="space-y-3">
              <div className="whitespace-pre-wrap font-medium text-sm mb-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              
              <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary dark:text-primary">
                      Smart {msg.smartFolderOperationData.operation.charAt(0).toUpperCase() + msg.smartFolderOperationData.operation.slice(1)} Suggestions
                    </span>
                    <span className="text-xs text-primary/80 dark:text-primary/90">
                      ({Math.round(msg.smartFolderOperationData.confidence * 100)}% confidence)
                    </span>
                  </div>
                  
                  {msg.smartFolderOperationData.folderAnalysis && (
                    <div className="mb-3 p-2 bg-primary/5 dark:bg-primary/10 rounded">
                      <div className="text-xs font-medium text-primary dark:text-primary mb-1">
                        📁 Folder Analysis: {msg.smartFolderOperationData.folderAnalysis.totalFiles} files, {msg.smartFolderOperationData.folderAnalysis.languages.join(', ')}
                      </div>
                      <div className="text-xs text-primary/90 dark:text-primary/90">
                        Purpose: {msg.smartFolderOperationData.folderAnalysis.primaryPurpose}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {msg.smartFolderOperationData.suggestions.slice(0, 3).map((suggestion, idx) => {
                      const buttonKey = `${msg.id}-folder-${idx}`;
                      const isApplied = actionAppliedStates[buttonKey];
                      const anyApplied = anySuggestionApplied(msg.id, "folder");
                      return (
                        <div key={idx} className="relative flex items-center justify-between p-2 bg-card/80 dark:bg-card/50 rounded border border-border mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{suggestion.folderName}</span>
                              <span className={cn("text-xs px-2 py-1 rounded", "bg-primary/20 text-primary dark:bg-primary/25 dark:text-primary")}>
                                {Math.round(suggestion.confidence * 100)}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {suggestion.reasoning}
                            </div>
                            <div className="text-xs text-primary/90 dark:text-primary/90 mt-1">
                              📂 {suggestion.folderPath}
                            </div>
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
                            title={isApplied ? 'Applied' : `Use this ${msg.smartFolderOperationData?.operation === 'move' ? 'destination' : 'name'}`}
                            disabled={isLoading || (anyApplied && !isApplied) || (anyApplied && isApplied)}
                            onClick={async () => {
                              if (isLoading || (anyApplied && !isApplied) || (anyApplied && isApplied)) return;
                              
                              const opName = msg.smartFolderOperationData?.operation || 'Operation';
                              const opNameCap = opName.charAt(0).toUpperCase() + opName.slice(1);
                              
                              try {
                                let result: any;
                                if (msg.smartFolderOperationData?.operation === 'move') {
                                  result = await handleFileOperation('move', {
                                    targetPath: msg.smartFolderOperationData?.targetPath,
                                    destinationPath: suggestion.folderPath
                                  });
                                } else if (msg.smartFolderOperationData?.operation === 'rename') {
                                  result = await handleFileOperation('rename', {
                                    targetPath: msg.smartFolderOperationData?.targetPath,
                                    newName: suggestion.folderName
                                  });
                                } else if (msg.smartFolderOperationData?.operation === 'delete') {
                                  result = await handleFileOperation('delete', {
                                    targetPath: suggestion.folderPath
                                  });
                                }
                                
                                if (result?.success) {
                                   // Set this specific button as applied
                                   actionAppliedStates[buttonKey] = true;
                                   // Potentially set all buttons for this message group as applied
                                   setChatHistory(prev => prev.map(m => {
                                       if (m.id === msg.id) {
                                            // This is tricky, maybe better to manage 'applied' state at panel level per message
                                            // For now, just local button state.
                                       }
                                       return m;
                                   }));
                                }
                              } catch (error: any) {
                                // Error handling in handleFileOperation will show toast
                                console.error(`AI Assistant: Smart folder operation ${opName} error.`, error);
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
                      🤖 {msg.smartFolderOperationData.reasoning}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {msg.type === 'filenameSuggestion' && msg.filenameSuggestionData && (
            <div className="space-y-3 overflow-x-hidden"> 
              <div className="whitespace-pre-wrap font-medium text-sm mb-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              
              {msg.filenameSuggestionData.analysis.mainFunctions.length > 0 && (
                <div className="p-2 bg-primary/10 dark:bg-primary/15 rounded border border-primary/20 dark:border-primary/30">
                  <div className="text-xs font-medium text-primary dark:text-primary">
                    📝 Functions Found: {msg.filenameSuggestionData.analysis.mainFunctions.join(', ')}
                  </div>
                </div>
              )}

              <Card className="bg-primary/10 border-primary/20 dark:bg-primary/15 dark:border-primary/30">
                <CardContent className="p-3 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary dark:text-primary">
                      AI Filename Analysis
                    </span>
                  </div>
                  <div className="text-xs text-primary/90 dark:text-primary/90 mb-3">
                    {msg.filenameSuggestionData.analysis.detectedLanguage} • {msg.filenameSuggestionData.analysis.codeType}
                    {msg.filenameSuggestionData.itemType === 'folder' && " (Folder)"}
                  </div>
                  
                  <div className="space-y-2">
                    {msg.filenameSuggestionData.suggestions.slice(0, 3).map((suggestion, idx) => {
                      const buttonKey = `${msg.id}-rename-${idx}`;
                      const isApplied = actionAppliedStates[buttonKey];
                      const anyApplied = anySuggestionApplied(msg.id, "rename");
                      
                      let displayName = suggestion.filename;
                      if (msg.filenameSuggestionData?.itemType === 'folder') {
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
                              if (msg.filenameSuggestionData?.targetPath) {
                                try {
                                  const nameToApply = msg.filenameSuggestionData.itemType === 'folder' 
                                    ? cleanFolderName(suggestion.filename)
                                    : suggestion.filename;
                                  const result = await handleFileOperation('rename', {
                                    targetPath: msg.filenameSuggestionData.targetPath,
                                    newName: nameToApply
                                  });
                                  if (result?.success) {
                                    actionAppliedStates[buttonKey] = true;
                                    setChatHistory(prev => prev.map(m => m.id === msg.id ? {...m, filenameSuggestionData: {...m.filenameSuggestionData!, suggestions: m.filenameSuggestionData!.suggestions.map(s => s.filename === suggestion.filename ? {...s, applied: true} : s)}} : m));
                                  } else {
                                    actionAppliedStates[buttonKey] = false; // Explicitly reset on failure
                                  }
                                } catch (error: any) {
                                  actionAppliedStates[buttonKey] = false;
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
                      <div>💡 Current: {msg.filenameSuggestionData.currentFileName}</div>
                       <div>→ Suggested: {
                          msg.filenameSuggestionData.topSuggestion 
                          ? (msg.filenameSuggestionData.itemType === 'folder'
                            ? cleanFolderName(msg.filenameSuggestionData.topSuggestion.filename)
                            : msg.filenameSuggestionData.topSuggestion.filename)
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
