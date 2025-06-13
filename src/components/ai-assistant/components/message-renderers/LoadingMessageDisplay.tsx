
import React from 'react';
import { Brain } from 'lucide-react';
import type { LoadingMessageDisplayProps } from '@/components/ai-assistant/types';

export const LoadingMessageDisplay: React.FC<LoadingMessageDisplayProps> = ({ msg }) => {
  return <Brain className="h-5 w-5 animate-pulse text-primary" />;
};
