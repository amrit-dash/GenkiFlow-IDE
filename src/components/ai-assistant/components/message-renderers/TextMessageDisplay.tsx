import React from 'react';
import { FileText, Folder, Paperclip, FileCode } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import type { TextMessageDisplayProps } from '../../types';

// Helper component to display attachment indicators
const AttachmentDisplay: React.FC<{ attachments: NonNullable<TextMessageDisplayProps['msg']['attachments']> }> = ({ attachments }) => {
  const getFileIcon = (name: string, type: 'file' | 'folder') => {
    if (type === 'folder') return Folder;
    
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'cs':
      case 'php':
      case 'rb':
      case 'go':
      case 'rs':
        return FileCode;
      default:
        return FileText;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium text-primary">
          Attached Context ({attachments.length} item{attachments.length > 1 ? 's' : ''})
        </span>
      </div>
      
      <div className="space-y-1">
        {attachments.map((attachment, idx) => {
          const IconComponent = getFileIcon(attachment.name, attachment.type);
          
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <IconComponent className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground truncate">
                {attachment.name}
              </span>
              
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <Badge variant="secondary" className="text-xs h-4 px-1">
                  {attachment.type}
                </Badge>
                
                {attachment.type === 'file' && attachment.size && (
                  <span className="text-muted-foreground">
                    {formatSize(attachment.size)}
                  </span>
                )}
                
                {attachment.type === 'folder' && attachment.fileCount !== undefined && (
                  <span className="text-muted-foreground">
                    {attachment.fileCount} files
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TextMessageDisplay: React.FC<TextMessageDisplayProps> = ({ msg }) => {
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap">{msg.content}</p>
      
      {/* Show attachments if present */}
      {msg.attachments && msg.attachments.length > 0 && (
        <AttachmentDisplay attachments={msg.attachments} />
      )}
    </div>
  );
};
