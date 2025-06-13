
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import type { ProgressUpdateDisplayProps } from '@/components/ai-assistant/types';

export const ProgressUpdateDisplay: React.FC<ProgressUpdateDisplayProps> = ({ msg }) => {
  if (!msg.progressData) return <p>{msg.content || "Processing..."}</p>;

  const {
    operation,
    stage,
    progress,
    explanation,
    technicalDetails,
    nextSteps,
    canCancel,
    requiresInput,
    suggestedActions,
    statusMessage,
    icon,
    estimatedCompletion
  } = msg.progressData;

  const IconComponent =
    icon === 'loading' ? Loader2 :
    icon === 'success' ? CheckCircle :
    icon === 'error' ? AlertTriangle :
    Info;

  return (
    <div className="space-y-2">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <IconComponent className={`h-5 w-5 text-primary ${icon === 'loading' ? 'animate-spin' : ''}`} />
            <div className="flex-grow">
              <p className="font-semibold text-primary">{statusMessage} ({progress}%)</p>
              {estimatedCompletion && <p className="text-xs text-primary/80">{estimatedCompletion}</p>}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-muted-foreground">{explanation}</p>
          {technicalDetails && <p className="text-muted-foreground/70 italic text-[0.7rem]">Details: {technicalDetails}</p>}
          {nextSteps && nextSteps.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground text-[0.75rem]">Next:</p>
              <ul className="list-disc list-inside text-muted-foreground/80 text-[0.7rem]">
                {nextSteps.map((step, i) => <li key={i}>{step}</li>)}
              </ul>
            </div>
          )}
          { (canCancel || requiresInput || (suggestedActions && suggestedActions.length > 0) ) && (
            <div className="pt-1 mt-1 border-t border-primary/20 text-[0.7rem] text-primary/90">
              {requiresInput && <p>Waiting for input...</p>}
              {suggestedActions && suggestedActions.length > 0 && <p>Try: {suggestedActions.join(" | ")}</p>}
              {canCancel && <p className="text-muted-foreground/70">(Operation can be cancelled)</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

