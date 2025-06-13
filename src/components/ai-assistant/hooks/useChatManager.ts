
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { generateId } from '../ai-assistant-utils';

export function useChatManager() {
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UI states for individual message actions
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({}); // Tracks copy success for code blocks
  const [actionAppliedStates, setActionAppliedStates] = useState<Record<string, boolean>>({}); // Tracks if an action (e.g., apply to editor) has been applied
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({}); // Tracks loading state for specific actions
  const [expandedCodePreviews, setExpandedCodePreviews] = useState<Record<string, boolean>>({}); // Tracks if a code preview is expanded
  const [forceReplaceState, setForceReplaceState] = useState<Record<string, boolean>>({}); // Tracks if "force replace" is active for an apply action

  const handleNewChat = useCallback(() => {
    setChatHistory([]);
    setPrompt('');
    setIsLoading(false);
    setCopiedStates({});
    setActionAppliedStates({});
    setLoadingStates({});
    setExpandedCodePreviews({});
    setForceReplaceState({});
    // Optionally, you might want to clear attached files here if that state is managed by a parent or another hook.
  }, []);

  const toggleCodePreview = useCallback((messageId: string) => {
    setExpandedCodePreviews(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of chat history
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory, isLoading]);

  return {
    prompt,
    setPrompt,
    chatHistory,
    setChatHistory,
    isLoading,
    setIsLoading,
    scrollAreaRef,
    textareaRef,
    copiedStates,
    setCopiedStates,
    actionAppliedStates,
    setActionAppliedStates,
    loadingStates,
    setLoadingStates,
    expandedCodePreviews,
    setExpandedCodePreviews,
    toggleCodePreview,
    forceReplaceState,
    setForceReplaceState,
    handleNewChat,
  };
}
