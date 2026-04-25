'use client';

import type { ReactNode } from 'react';
import { ToastContext, useToastProvider } from '@/hooks/useToast';
import Toast from './Toast';

interface ToastProviderProps {
  children: ReactNode;
}

export default function ToastProvider({ children }: ToastProviderProps) {
  const ctx = useToastProvider();

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="toast-container" aria-live="polite">
        {ctx.toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={ctx.removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
