'use client';

import type { ChatMessage } from '@/hooks/useChat';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--assistant'}`}>
      <p className="chat-bubble__text">{message.text}</p>
      {message.aiResponse?.followUpQuestion && (
        <p className="chat-bubble__followup">{message.aiResponse.followUpQuestion}</p>
      )}
    </div>
  );
}
