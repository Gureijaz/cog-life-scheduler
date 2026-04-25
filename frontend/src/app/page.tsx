'use client';

import { useState } from 'react';
import type { ScheduleBlock as ScheduleBlockType } from '@/lib/types';
import { useSchedule } from '@/hooks/useSchedule';
import ScheduleBlock from '@/components/calendar/ScheduleBlock';
import BlockDetail from '@/components/calendar/BlockDetail';
import RepairSummary from '@/components/calendar/RepairSummary';
import { getTodayDate, formatDate, formatRelativeDate, formatDuration } from '@/lib/utils';

export default function TodayPage() {
  const today = getTodayDate();
  const {
    blocks, loading, error, refresh,
    lockBlock, unlockBlock,
    generateSchedule, repairSchedule,
    unscheduledItems, atRiskAssignments,
    changeSummary, clearChangeSummary, generating,
  } = useSchedule(today);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlockType | null>(null);

  const handleBlockClick = (block: ScheduleBlockType) => {
    setSelectedBlock((prev) => (prev?.id === block.id ? null : block));
  };

  const handleLockToggle = async (blockId: string, locked: boolean) => {
    if (locked) {
      await unlockBlock(blockId);
    } else {
      await lockBlock(blockId);
    }
    setSelectedBlock((prev) =>
      prev && prev.id === blockId ? { ...prev, locked: !locked } : prev,
    );
  };

  return (
    <div className="today-view">
      <header className="today-view__header">
        <div>
          <h1 className="today-view__title">{formatRelativeDate(today)}</h1>
          <p className="today-view__date">{formatDate(today)}</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={generateSchedule}
          disabled={generating}
          aria-label="Generate schedule plan for today"
        >
          {generating ? 'Generating…' : 'Generate Plan'}
        </button>
      </header>

      {loading && <p className="today-view__status">Loading schedule…</p>}
      {error && <p className="today-view__status today-view__status--error">{error}</p>}

      {!loading && !error && blocks.length === 0 && (
        <p className="today-view__status">No schedule blocks for today.</p>
      )}

      <div className="today-view__list" role="list" aria-label="Today's schedule blocks">
        {blocks.map((block) => (
          <div key={block.id} role="listitem">
            <ScheduleBlock block={block} onClick={handleBlockClick} />
          </div>
        ))}
      </div>

      {unscheduledItems.length > 0 && (
        <section className="today-view__warnings" aria-label="Unscheduled items">
          <h2 className="today-view__warnings-title">Unscheduled Items</h2>
          <ul className="today-view__warning-list">
            {unscheduledItems.map((item) => (
              <li key={item.sourceId} className="today-view__warning-item today-view__warning-item--unscheduled">
                <span className="today-view__warning-name">{item.title}</span>
                <span className="today-view__warning-reason">{item.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {atRiskAssignments.length > 0 && (
        <section className="today-view__warnings" aria-label="At-risk assignments">
          <h2 className="today-view__warnings-title">At-Risk Assignments</h2>
          <ul className="today-view__warning-list">
            {atRiskAssignments.map((a) => (
              <li key={a.assignmentId} className="today-view__warning-item today-view__warning-item--at-risk">
                <span className="today-view__warning-name">{a.title}</span>
                <span className="today-view__warning-reason">
                  Shortfall: {formatDuration(a.shortfallMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {changeSummary && (
        <RepairSummary summary={changeSummary} onDismiss={clearChangeSummary} />
      )}

      {selectedBlock && (
        <BlockDetail
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onLockToggle={handleLockToggle}
        />
      )}
    </div>
  );
}
