'use client';

import { useState, useRef } from 'react';
import type { ScheduleBlock as ScheduleBlockType } from '@/lib/types';
import { useSchedule } from '@/hooks/useSchedule';
import { useToast } from '@/hooks/useToast';
import { useParticleController } from '@/hooks/useParticleController';
import ScheduleBlock from '@/components/calendar/ScheduleBlock';
import BlockDetail from '@/components/calendar/BlockDetail';
import RepairSummary from '@/components/calendar/RepairSummary';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import Modal from '@/components/ui/Modal';
import EventForm from '@/components/events/EventForm';
import TaskForm from '@/components/tasks/TaskForm';
import { getTodayDate, formatDate, formatRelativeDate, formatDuration } from '@/lib/utils';

export default function TodayPage() {
  const [today] = useState(() => getTodayDate());
  const {
    blocks, loading, error, plan,
    lockBlock, unlockBlock,
    generateSchedule, repairSchedule,
    unscheduledItems, atRiskAssignments,
    changeSummary, clearChangeSummary, generating, refresh,
  } = useSchedule(today);
  const { addToast } = useToast();
  const { triggerExplosion } = useParticleController();
  const generateBtnRef = useRef<HTMLButtonElement>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlockType | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const handleBlockClick = (block: ScheduleBlockType) => {
    setSelectedBlock((prev) => (prev?.id === block.id ? null : block));
  };

  const handleLockToggle = async (blockId: string, locked: boolean) => {
    try {
      if (locked) {
        await unlockBlock(blockId);
      } else {
        await lockBlock(blockId);
      }
      setSelectedBlock((prev) =>
        prev && prev.id === blockId ? { ...prev, locked: !locked } : prev,
      );
    } catch {
      addToast('error', `Failed to ${locked ? 'unlock' : 'lock'} block`);
    }
  };

  const handleGenerate = async () => {
    try {
      const btnRect = generateBtnRef.current?.getBoundingClientRect();
      if (btnRect) triggerExplosion(btnRect, '#6366f1');
      await generateSchedule();
      addToast('success', 'Schedule generated successfully');
    } catch {
      addToast('error', 'Failed to generate schedule');
    }
  };

  const handleRepair = async () => {
    try {
      await repairSchedule();
      addToast('success', 'Schedule repaired successfully');
    } catch {
      addToast('error', 'Failed to repair schedule');
    }
  };

  return (
    <div className="today-view">
      <header className="today-view__header">
        <div>
          <h1 className="today-view__title">{formatRelativeDate(today)}</h1>
          <p className="today-view__date">{formatDate(today)}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn--secondary" onClick={() => setShowEventModal(true)}>
            Add Event
          </button>
          <button className="btn btn--secondary" onClick={() => setShowTaskModal(true)}>
            Add Task
          </button>
          <button
            ref={generateBtnRef}
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={generating}
            aria-label="Generate schedule plan for today"
          >
            {generating && <span className="btn__spinner" />}
            {generating ? 'Generating…' : 'Generate Plan'}
          </button>
        </div>
      </header>

      {loading && <LoadingSkeleton variant="block" count={3} />}
      {error && <p className="today-view__status today-view__status--error">{error}</p>}

      {!loading && !error && blocks.length === 0 && (
        <p className="today-view__status">No schedule blocks for today.</p>
      )}

      {/* Repair prompt banner */}
      {plan && !loading && !generating && blocks.length > 0 && (
        <div className="repair-prompt" style={{ display: 'none' }}>
          <span className="repair-prompt__text">Events have changed. Repair your schedule?</span>
          <button className="btn btn--primary btn--sm" onClick={handleRepair}>
            Repair Schedule
          </button>
        </div>
      )}

      <div className="today-view__list" role="list" aria-label="Today's schedule blocks">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            role="listitem"
            style={{ '--stagger-index': index } as React.CSSProperties}
          >
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

      <Modal open={showEventModal} onClose={() => setShowEventModal(false)} ariaLabel="Create event">
        <EventForm
          onSaved={() => { setShowEventModal(false); refresh(); }}
          onCancel={() => setShowEventModal(false)}
        />
      </Modal>

      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} ariaLabel="Create task">
        <TaskForm
          onSaved={() => { setShowTaskModal(false); refresh(); }}
          onCancel={() => setShowTaskModal(false)}
        />
      </Modal>
    </div>
  );
}
