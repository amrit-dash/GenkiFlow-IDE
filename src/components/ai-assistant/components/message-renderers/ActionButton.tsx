
import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, Brain } from 'lucide-react';
import type { ActionButtonProps } from '@/components/ai-assistant/types';
import { cn } from '@/lib/utils';

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  isLoading = false,
  isApplied = false,
  appliedText = "Applied",
  loadingText, // Not used directly here, icon implies loading
  icon: Icon,
  children,
  variant = "outline",
  size = "sm",
  title,
  className,
  buttonKey // Used for managing state, not directly in rendering
}) => {
  const effectiveDisabled = disabled || isLoading || isApplied;

  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={effectiveDisabled}
      title={title || (isApplied ? appliedText : undefined)}
      className={cn(className)}
    >
      {isLoading ? (
        <Brain className="mr-1.5 h-4 w-4 animate-pulse" />
      ) : isApplied ? (
        <Check className="mr-1.5 h-4 w-4 text-green-500" />
      ) : Icon ? (
        <Icon className="mr-1.5 h-4 w-4" />
      ) : null}
      {isApplied ? appliedText : children}
    </Button>
  );
};
