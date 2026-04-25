'use client';

import type { ChangeSummary } from '@/lib/types';

interface RepairSummaryProps {
  summary: ChangeSummary;
  onDismiss?: () => void;
}

export default function RepairSummary({ summary, onDismiss }: RepairSummaryProps) {
  const { moved, added, removed } = summary;
  const hasChanges = moved.length > 0 || added.length > 0 || removed.length > 0;

  if (!hasChanges) return null;

  return (
    <section className="repair-summary" aria-label="Repair change summary">
      <div className="repair-summary__header">
        <h2 className="repair-summary__title">Schedule Repair Summary</h2>
        {onDismiss && (
          <button
            className="repair-summary__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss repair summary"
          >
            ✕
          </button>
        )}
      </div>

      {moved.length > 0 && (
        <div className="repair-summary__section">
          <h3 className="repair-summary__section-title">
            Moved ({moved.length})
          </h3>
          <ul className="repair-summary__list">
            {moved.map((m) => (
              <li key={m.blockId} className="repair-summary__item repair-summary__item--moved">
                Block moved from {m.oldStart} → {m.newStart}
              </li>
            ))}
          </ul>
        </div>
      )}

      {added.length > 0 && (
        <div className="repair-summary__section">
          <h3 className="repair-summary__section-title">
            Added ({added.length})
          </h3>
          <ul className="repair-summary__list">
            {added.map((id) => (
              <li key={id} className="repair-summary__item repair-summary__item--added">
                New block added
              </li>
            ))}
          </ul>
        </div>
      )}

      {removed.length > 0 && (
        <div className="repair-summary__section">
          <h3 className="repair-summary__section-title">
            Removed ({removed.length})
          </h3>
          <ul className="repair-summary__list">
            {removed.map((id) => (
              <li key={id} className="repair-summary__item repair-summary__item--removed">
                Block removed
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
