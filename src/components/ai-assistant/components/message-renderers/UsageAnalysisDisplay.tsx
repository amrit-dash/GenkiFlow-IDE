
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code, Link2 } from 'lucide-react';
import type { UsageAnalysisDisplayProps } from '@/components/ai-assistant/types';
import { CodeBlock } from './CodeBlock';

export const UsageAnalysisDisplay: React.FC<UsageAnalysisDisplayProps> = ({
  msg,
  handleCopyCode,
  copiedStates,
}) => {
  if (!msg.usageAnalysisData) return <p>{msg.content}</p>;

  const { symbolInfo, usages, relatedSymbols, summary } = msg.usageAnalysisData;

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="p-3">
          <CardTitle className="text-base flex items-center">
            <Code className="h-4 w-4 mr-2 text-primary"/> Usage of: {symbolInfo.name}
          </CardTitle>
          <CardDescription className="text-xs">Type: {symbolInfo.type} | Total Usages: {summary.totalUsages} in {summary.filesWithUsages} file(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3 text-xs">
          {symbolInfo.definition && (
            <div className="p-2 bg-card/80 dark:bg-card/60 rounded border">
              <h4 className="font-semibold mb-1">Definition:</h4>
              <p className="text-muted-foreground">Path: {symbolInfo.definition.filePath} (Line: {symbolInfo.definition.line})</p>
              <CodeBlock
                code={symbolInfo.definition.code}
                messageId={msg.id}
                actionKeySuffix="definition"
                handleCopyCode={handleCopyCode}
                copiedStates={copiedStates}
                maxHeightClass="max-h-24"
              />
            </div>
          )}

          {usages.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1">Usages ({usages.length}):</h4>
              <ScrollArea className="h-40 themed-scrollbar border rounded-md p-2 bg-background/30">
                <ul className="space-y-2">
                  {usages.map((use, idx) => (
                    <li key={idx} className="p-1.5 bg-card/90 rounded text-xs">
                      <p className="text-muted-foreground font-medium">{use.filePath} (Line: {use.line}) - <span className="italic">{use.usageType}</span></p>
                      <CodeBlock
                        code={use.context}
                        messageId={msg.id}
                        actionKeySuffix={`usage-${idx}`}
                        handleCopyCode={handleCopyCode}
                        copiedStates={copiedStates}
                        maxHeightClass="max-h-16"
                      />
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {relatedSymbols && relatedSymbols.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1 mt-2 flex items-center"><Link2 className="h-3 w-3 mr-1.5 text-primary"/>Related Symbols:</h4>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                {relatedSymbols.map((rel, idx) => (
                  <li key={idx} className="text-muted-foreground/90">
                    {rel.name} ({rel.relationship}) in {rel.filePath}
                  </li>
                ))}
              </ul>
            </div>
          )}
           {summary.mostUsedIn && <p className="text-xs text-muted-foreground mt-1">Most used in: {summary.mostUsedIn}</p>}
        </CardContent>
      </Card>
    </div>
  );
};
