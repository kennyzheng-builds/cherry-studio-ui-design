import React from 'react';
import { MessageList } from '@/app/components/shared/Chat/MessageList';
import { Composer } from '@/app/components/shared/Chat/Composer';
import { UserMessage, AgentMessageGroup, useGroupedMessages } from './AgentMessageRenderer';
import { WorkflowPanel } from './WorkflowPanel';
import type { AgentChatMessage } from '@/app/types/agent';
import type { WorkflowStep } from '@/app/types/chat';

// ===========================
// Agent Chat Panel
// ===========================
// Composes MessageList + AgentMessageRenderer + shared Composer input.
// Uses the same `Composer` as Chat / Assistant modes so the input frame is
// visually unified across surfaces — only the left action buttons differ
// per-surface (Agent currently uses the default Plus/Code/Folder set).

export interface ChatPanelProps {
  messages: AgentChatMessage[];
  steps: WorkflowStep[];
  onSendMessage: (text: string) => void;
  onResolveUI?: (msgId: string, value: string) => void;
  onAvatarClick?: () => void;
  /** Click handler for inline file-mention chips. Receives the file path. */
  onOpenFile?: (key: string) => void;
}

export function ChatPanel({
  messages,
  steps,
  onSendMessage,
  onResolveUI,
  onAvatarClick,
  onOpenFile,
}: ChatPanelProps) {
  const grouped = useGroupedMessages(messages);

  return (
    <div className="flex flex-col h-full">
      <MessageList
        scrollDeps={[messages.length]}
        header={steps.length > 0 ? <WorkflowPanel steps={steps} /> : undefined}
      >
        {grouped.map((group) => {
          if (group.type === 'user') {
            return <UserMessage key={group.msg.id} msg={group.msg} onOpenFile={onOpenFile} />;
          }
          return (
            <AgentMessageGroup
              key={group.msgs[0].id}
              msgs={group.msgs}
              onResolve={onResolveUI ?? (() => {})}
              onAvatarClick={onAvatarClick}
              onOpenFile={onOpenFile}
            />
          );
        })}
      </MessageList>

      {/* Unified input: shared Composer (same frame as Chat / Assistant).
          maxHeight 220 ≈ 9 rows at 12px / 1.6 line-height + top/bottom padding. */}
      <Composer
        onSendMessage={onSendMessage}
        placeholder="输入消息..."
        maxHeight={220}
      />
    </div>
  );
}
