'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import MessageBubble from './MessageBubble';
import ConfirmationCard from './ConfirmationCard';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ChatPanel({ open, onClose }: ChatPanelProps) {
  const { messages, sending, sendMessage, confirmAction, rejectAction } = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    await sendMessage(text);
  };

  if (!open) return null;

  return (
    <aside className="chat-panel" role="complementary" aria-label="AI Assistant">
      <div className="chat-panel__header">
        <h2 className="chat-panel__title">Cog Assistant</h2>
        <button type="button" className="block-detail__close" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>

      <div className="chat-panel__messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-panel__empty">Ask me to create events, reschedule tasks, or explain your schedule.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble message={msg} />
            {msg.aiResponse?.confirmationRequired && (
              <ConfirmationCard
                response={msg.aiResponse}
                onConfirm={() => confirmAction(msg.id)}
                onReject={() => rejectAction(msg.id)}
              />
            )}
          </div>
        ))}
        {sending && <p className="chat-panel__typing">Thinking…</p>}
      </div>

      <form className="chat-panel__input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={sending}
          aria-label="Chat message input"
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
