
import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { TextMessageDisplayProps } from '@/components/ai-assistant/types';

export const TextMessageDisplay: React.FC<TextMessageDisplayProps> = ({ msg }) => {
  return <div className="whitespace-pre-wrap"><ReactMarkdown>{msg.content}</ReactMarkdown></div>;
};

