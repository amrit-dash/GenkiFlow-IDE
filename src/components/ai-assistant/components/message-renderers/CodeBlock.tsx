
import React from 'react';
import { Button } from "@/components/ui/button";
import { ClipboardCopy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  messageId: string; // For unique state tracking
  actionKeySuffix: string; // e.g., "code", "suggestion"
  handleCopyCode: (codeToCopy: string, key: string) => void;
  copiedStates: Record<string, boolean>;
  isExpanded?: boolean; // If false, shows a "View Code" button initially
  onToggleExpand?: () => void;
  maxHeightClass?: string; // e.g., 'max-h-60'
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  messageId,
  actionKeySuffix,
  handleCopyCode,
  copiedStates,
  isExpanded = true, // Default to expanded
  onToggleExpand,
  maxHeightClass = 'max-h-60',
}) => {
  const copyKey = `${messageId}-${actionKeySuffix}`;

  if (!isExpanded && onToggleExpand) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="mb-1"
        onClick={onToggleExpand}
      >
        View Code
      </Button>
    );
  }

  return (
    <div className="relative bg-muted p-2 rounded-md group themed-scrollbar mt-1">
      <pre className={cn("text-xs overflow-x-auto whitespace-pre-wrap font-code themed-scrollbar", maxHeightClass)}>
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent"
        onClick={() => handleCopyCode(code, copyKey)}
        title={copiedStates[copyKey] ? "Copied!" : "Copy code"}
      >
        {copiedStates[copyKey] ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};
