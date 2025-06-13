
import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ErrorMessageDisplayProps } from '@/components/ai-assistant/types';

export const ErrorMessageDisplay: React.FC<ErrorMessageDisplayProps> = ({ msg }) => {
  return <p className="text-destructive whitespace-pre-wrap"><ReactMarkdown>{msg.content}</ReactMarkdown></p>;
};
