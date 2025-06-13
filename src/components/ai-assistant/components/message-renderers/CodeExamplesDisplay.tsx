
import React from 'react';
import { CodeBlock } from './CodeBlock';
import type { CodeExamplesDisplayProps } from '@/components/ai-assistant/types';

export const CodeExamplesDisplay: React.FC<CodeExamplesDisplayProps> = ({
  msg,
  handleCopyCode,
  copiedStates,
}) => {
  if (!msg.examples || msg.examples.length === 0) {
    return <p className="whitespace-pre-wrap">{msg.content || "No examples found."}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-muted-foreground mb-1">{msg.content}</p>
      {msg.examples.map((ex, i) => (
        <CodeBlock
          key={i}
          code={ex}
          messageId={msg.id}
          actionKeySuffix={`example-${i}`}
          handleCopyCode={handleCopyCode}
          copiedStates={copiedStates}
          maxHeightClass="max-h-40"
        />
      ))}
    </div>
  );
};
