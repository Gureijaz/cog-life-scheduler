'use client';

import { useCallback, useState } from 'react';
import type { AIResponse } from '@/lib/types';
import { ai, ApiRequestError } from '@/lib/api';

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
  onDataChanged?: () => void;
}

let msgCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export function useChat(onDataChanged?: () => void): UseChatReturn {
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
      const isUnavailable =
        err instanceof ApiRequestError && (err.status === 503 || err.status === 500);
      const errorText = isUnavailable
        ? 'The AI assistant is currently unavailable. Please check that OPENAI_API_KEY is configured.'
        : `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorText);
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: errorText,
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
      // Trigger data refresh after confirmed action
      onDataChanged?.();
    } catch (err: unknown) {
      const isUnavailable =
        err instanceof ApiRequestError && (err.status === 503 || err.status === 500);
      const errorText = isUnavailable
        ? 'The AI assistant is currently unavailable. Please check that OPENAI_API_KEY is configured.'
        : `Confirmation failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorText);
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: errorText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [onDataChanged]);

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
