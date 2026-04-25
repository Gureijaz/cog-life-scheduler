'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { useParticleController } from '@/hooks/useParticleController';
import MessageBubble from './MessageBubble';
import ConfirmationCard from './ConfirmationCard';

const EXAMPLE_PROMPTS = [
  'Create a gym session tomorrow at 6 PM',
  'Reschedule my morning lecture to 10 AM',
  'Explain why my study block was placed at 2 PM',
];

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export default function ChatPanel({ open, onClose, onDataChanged }: ChatPanelProps) {
  const { messages, sending, sendMessage, confirmAction, rejectAction } = useChat(onDataChanged);
  const { triggerSparkle } = useParticleController();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    // Trigger sparkle on new AI messages
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && listRef.current) {
      const rect = listRef.current.getBoundingClientRect();
      const path = [
        { x: rect.left + rect.width * 0.3, y: rect.bottom - 40 },
        { x: rect.left + rect.width * 0.7, y: rect.bottom - 40 },
      ];
      triggerSparkle(path, '#6366f1');
    }
  }, [messages, triggerSparkle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (!text || sending) return;
      setInput('');
      sendMessage(text);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  if (!open) return null;

  return (
    <aside className="chat-panel glassmorphism-panel" role="complementary" aria-label="AI Assistant">
      <div className="chat-panel__header">
        <h2 className="chat-panel__title">Cog Assistant</h2>
        <button type="button" className="block-detail__close" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>

      <div className="chat-panel__messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-panel__empty">
            <p className="chat-panel__empty-title">Welcome to Cog Assistant</p>
            <p className="chat-panel__empty-text">
              Ask me to create events, reschedule tasks, or explain your schedule.
            </p>
            <div className="chat-panel__prompts">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chat-panel__prompt-btn"
                  onClick={() => handlePromptClick(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
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
        {sending && (
          <div className="chat-panel__typing" aria-label="Assistant is typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      <form className="chat-panel__input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
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
