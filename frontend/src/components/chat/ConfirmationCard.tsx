'use client';

import type { AIResponse } from '@/lib/types';

interface ConfirmationCardProps {
  response: AIResponse;
  onConfirm: () => void;
  onReject: () => void;
}

export default function ConfirmationCard({ response, onConfirm, onReject }: ConfirmationCardProps) {
  return (
    <div className="confirmation-card">
      <p className="confirmation-card__summary">{response.summary}</p>
      {response.intent !== 'unknown' && (
        <p className="confirmation-card__intent">
          Action: <span className="confirmation-card__intent-value">{response.intent}</span>
        </p>
      )}
      <div className="confirmation-card__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onReject}>
          Cancel
        </button>
      </div>
    </div>
  );
}
