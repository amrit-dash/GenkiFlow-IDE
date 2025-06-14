
import React from 'react';
import { Loader2 } from 'lucide-react'; // Changed from Brain to Loader2
import type { LoadingMessageDisplayProps } from '@/components/ai-assistant/types';

export const LoadingMessageDisplay: React.FC<LoadingMessageDisplayProps> = ({ msg }) => {
  return (
    <div className="flex justify-center items-center py-3"> {/* Added padding and centering */}
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
};
