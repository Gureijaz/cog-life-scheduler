'use client';

import { useCallback, useState } from 'react';
import type { AIResponse } from '@/lib/types';
import { ai } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  aiResponse?: AIResponse;
  timestamp: number;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  confirmAction: (messageId: string) => Promise<void>;
  rejectAction: (messageId: string) => void;
}

let msgCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setError(null);

    try {
      const response = await ai.sendMessage(text);
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: response.summary,
        aiResponse: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: `Sorry, something went wrong: ${msg}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, []);

  const confirmAction = useCallback(async (messageId: string) => {
    // Send a confirmation message to the AI
    const confirmMsg: ChatMessage = { id: nextId(), role: 'user', text: 'Yes, confirm.', timestamp: Date.now() };
    setMessages((prev) => [...prev, confirmMsg]);
    setSending(true);

    try {
      const response = await ai.sendMessage('confirm');
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: response.summary,
        aiResponse: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setSending(false);
    }
  }, []);

  const rejectAction = useCallback((messageId: string) => {
    const rejectMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      text: 'Action cancelled.',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, rejectMsg]);
  }, []);

  return { messages, sending, error, sendMessage, confirmAction, rejectAction };
}
