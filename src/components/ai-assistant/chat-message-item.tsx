
"use client";

import React from 'react';
import type { ChatMessageItemProps } from './types';
import { ChatMessageWrapper } from './components/message-renderers/ChatMessageWrapper';
import { TextMessageDisplay } from './components/message-renderers/TextMessageDisplay';
import { ErrorMessageDisplay } from './components/message-renderers/ErrorMessageDisplay';
import { LoadingMessageDisplay } from './components/message-renderers/LoadingMessageDisplay';
import { GeneratedCodeDisplay } from './components/message-renderers/GeneratedCodeDisplay';
import { RefactorSuggestionDisplay } from './components/message-renderers/RefactorSuggestionDisplay';
import { CodeExamplesDisplay } from './components/message-renderers/CodeExamplesDisplay';
import { FileOperationDisplay } from './components/message-renderers/FileOperationDisplay';
import { TerminalCommandDisplay } from './components/message-renderers/TerminalCommandDisplay';
import { SmartCodePlacementDisplay } from './components/message-renderers/SmartCodePlacementDisplay';
import { FilenameSuggestionDisplay } from './components/message-renderers/FilenameSuggestionDisplay';
import { SmartFolderOperationDisplay } from './components/message-renderers/SmartFolderOperationDisplay';
import { ErrorValidationDisplay } from './components/message-renderers/ErrorValidationDisplay';
import { UsageAnalysisDisplay } from './components/message-renderers/UsageAnalysisDisplay';
import { ProgressUpdateDisplay } from './components/message-renderers/ProgressUpdateDisplay';


export const ChatMessageItem: React.FC<ChatMessageItemProps> = (props) => {
  const { msg } = props;

  const renderMessageContent = () => {
    switch (msg.type) {
      case 'text':
        return <TextMessageDisplay msg={msg} />;
      case 'error':
        return <ErrorMessageDisplay msg={msg} />;
      case 'loading':
        return <LoadingMessageDisplay msg={msg} />;
      case 'generatedCode':
      case 'newFileSuggestion':
      case 'enhancedCodeGeneration':
        return <GeneratedCodeDisplay {...props} msg={msg} />;
      case 'refactorSuggestion':
        return <RefactorSuggestionDisplay {...props} msg={msg} />;
      case 'codeExamples':
        return <CodeExamplesDisplay {...props} msg={msg} />;
      case 'fileOperationExecution':
        return <FileOperationDisplay {...props} msg={msg} />;
      case 'terminalCommandExecution':
        return <TerminalCommandDisplay {...props} msg={msg} />;
      case 'smartCodePlacement':
        return <SmartCodePlacementDisplay {...props} msg={msg} />;
      case 'filenameSuggestion':
        return <FilenameSuggestionDisplay {...props} msg={msg} />;
      case 'smartFolderOperation':
        return <SmartFolderOperationDisplay {...props} msg={msg} />;
      case 'errorValidation':
        return <ErrorValidationDisplay {...props} msg={msg}/>;
      case 'usageAnalysis':
        return <UsageAnalysisDisplay {...props} msg={msg}/>;
      case 'progressUpdate':
        return <ProgressUpdateDisplay {...props} msg={msg}/>;
      default:
        // Fallback for any unknown message types
        return <p className="whitespace-pre-wrap">{(msg as any).content || 'Unsupported message type'}</p>;
    }
  };

  return (
    <ChatMessageWrapper msg={msg}>
      {renderMessageContent()}
    </ChatMessageWrapper>
  );
};
