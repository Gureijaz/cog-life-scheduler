'use client';

import type { ScheduleBlock } from '@/lib/types';
import { useExplanation } from '@/hooks/useSchedule';
import { formatTimeRange } from '@/lib/utils';

const SOURCE_LABELS: Record<string, string> = {
  fixed_event: 'Fixed Event',
  flexible_task: 'Flexible Task',
  assignment: 'Assignment',
  travel_buffer: 'Travel Buffer',
};

interface BlockDetailProps {
  block: ScheduleBlock;
  onClose: () => void;
  onLockToggle?: (blockId: string, currentlyLocked: boolean) => void;
}

export default function BlockDetail({ block, onClose, onLockToggle }: BlockDetailProps) {
  const { explanation, loading: explanationLoading, error: explanationError } =
    useExplanation(block.id);

  return (
    <aside className="block-detail" role="complementary" aria-label="Block details">
      <div className="block-detail__header">
        <h2 className="block-detail__title">{block.title}</h2>
        <button
          type="button"
          className="block-detail__close"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <dl className="block-detail__info">
        <div className="block-detail__row">
          <dt>Time</dt>
          <dd>{formatTimeRange(block.startTime, block.endTime)}</dd>
        </div>
        <div className="block-detail__row">
          <dt>Type</dt>
          <dd>{SOURCE_LABELS[block.sourceType] ?? block.sourceType}</dd>
        </div>
        <div className="block-detail__row">
          <dt>Status</dt>
          <dd>{block.locked ? 'Locked' : 'Unlocked'}</dd>
        </div>
      </dl>

      {onLockToggle && (
        <button
          type="button"
          className={`block-detail__lock-btn ${block.locked ? 'block-detail__lock-btn--locked' : ''}`}
          onClick={() => onLockToggle(block.id, block.locked)}
        >
          {block.locked ? 'Unlock Block' : 'Lock Block'}
        </button>
      )}

      <div className="block-detail__explanation">
        <h3 className="block-detail__section-title">Explanation</h3>
        {explanationLoading && <p className="block-detail__loading">Loading explanation…</p>}
        {explanationError && (
          <p className="block-detail__error">{explanationError}</p>
        )}
        {explanation && (
          <p className="block-detail__explanation-text">{explanation.explanationText}</p>
        )}
        {!explanationLoading && !explanationError && !explanation && (
          <p className="block-detail__no-explanation">No explanation available.</p>
        )}
      </div>
    </aside>
  );
}
