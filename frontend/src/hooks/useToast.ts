'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: 'success' | 'error', message: string) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

let toastCounter = 0;

export function useToastProvider(): ToastContextValue {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `toast-${Date.now()}-${++toastCounter}`;
    const toast: Toast = { id, type, message };
    const timeout = type === 'success' ? 3000 : 5000;

    setToasts((prev) => {
      const next = [...prev, toast];
      // Max 3 toasts — remove oldest if exceeded
      if (next.length > 3) {
        const removed = next.shift()!;
        const timer = timersRef.current.get(removed.id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(removed.id);
        }
      }
      return next;
    });

    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeout);
    timersRef.current.set(id, timer);
  }, []);

  return { toasts, addToast, removeToast };
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
