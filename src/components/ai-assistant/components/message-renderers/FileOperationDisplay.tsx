
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, XCircle, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileOperationDisplayProps } from '@/components/ai-assistant/types';

export const FileOperationDisplay: React.FC<FileOperationDisplayProps> = ({
  msg,
  undoStack,
  executeUndo,
  setUndoStack,
}) => {
  if (!msg.fileOperationData) return <p>{msg.content}</p>;

  const { success, operation, targetPath, newName, destinationPath, filesFound, message } = msg.fileOperationData;
  const canUndo = success && undoStack.find(op =>
    op.type === operation &&
    ( (op.data.originalPath === targetPath && op.data.newPath === msg.fileOperationData?.newPath ) || // For rename/move
      (op.data.originalPath === targetPath && operation === 'delete') || // For delete
      (op.data.path === targetPath && operation === 'create') // for create
    )
  );


  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap">{msg.content}</p>
      <Card className={cn("border-2", success ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800")}>
        <CardContent className={cn("p-3 relative", operation === 'rename' && success && "pr-10")}>
          <div className="flex items-center gap-2 mb-1">
            {success ? <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
            <span className="text-sm font-medium capitalize flex-grow">{operation} Operation</span>
          </div>
          <div className="pl-6">
            {targetPath && <div className="text-xs text-muted-foreground mt-0.5"><strong>Target:</strong> {targetPath}</div>}
            {newName && <div className="text-xs text-muted-foreground"><strong>New Name:</strong> {newName}</div>}
            {destinationPath && <div className="text-xs text-muted-foreground"><strong>Destination:</strong> {destinationPath}</div>}
          </div>
          {canUndo && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-transparent shrink-0 absolute top-3 right-3"
              onClick={() => {
                const recentOp = undoStack.find(op =>
                    op.type === operation &&
                    ( (op.data.originalPath === targetPath && op.data.newPath === msg.fileOperationData?.newPath ) ||
                      (op.data.originalPath === targetPath && operation === 'delete') ||
                      (op.data.path === targetPath && operation === 'create')
                    )
                );
                if (recentOp) {
                  executeUndo(recentOp);
                  setUndoStack(prev => prev.filter(op => op.timestamp !== recentOp.timestamp));
                }
              }}
              title={`Undo ${operation}`}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {filesFound && filesFound.length > 0 && (
            <div className="text-xs mt-2 pl-6"><strong>Items Found ({filesFound.length}):</strong>
              <ScrollArea className="mt-1 max-h-32 themed-scrollbar">
                <div className="space-y-1 pr-2">
                    {filesFound.slice(0, 10).map((file, idx) => (<div key={idx} className="text-muted-foreground">• {file}</div>))}
                    {filesFound.length > 10 && (<div className="text-muted-foreground">... and {filesFound.length - 10} more</div>)}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
