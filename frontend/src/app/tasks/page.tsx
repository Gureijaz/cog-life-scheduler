'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FlexibleTask, Assignment } from '@/lib/types';
import { flexibleTasks, assignments } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function TasksPage() {
  const [tasks, setTasks] = useState<FlexibleTask[]>([]);
  const [assignmentList, setAssignmentList] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, a] = await Promise.all([flexibleTasks.list(), assignments.list()]);
      setTasks(t);
      setAssignmentList(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedTasks = [...tasks].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );

  const sortedAssignments = [...assignmentList].sort(
    (a, b) => b.urgencyScore - a.urgencyScore,
  );

  return (
    <div className="tasks-page">
      <header className="tasks-page__header">
        <h1 className="tasks-page__title">Tasks &amp; Assignments</h1>
      </header>

      {loading && <p className="tasks-page__status">Loading…</p>}
      {error && <p className="tasks-page__status tasks-page__status--error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="tasks-page__section">
            <h2 className="tasks-page__section-title">Flexible Tasks</h2>
            {sortedTasks.length === 0 && (
              <p className="tasks-page__empty">No flexible tasks.</p>
            )}
            <div className="tasks-page__list" role="list" aria-label="Flexible tasks">
              {sortedTasks.map((task) => (
                <div key={task.id} className="task-card" role="listitem">
                  <div className="task-card__header">
                    <span className="task-card__title">{task.title}</span>
                    <span className={`task-card__priority task-card__priority--${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="task-card__details">
                    <span>Remaining: {formatDuration(task.remainingMinutes)}</span>
                    {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
                    <span>Min session: {formatDuration(task.minSessionMinutes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="tasks-page__section">
            <h2 className="tasks-page__section-title">Assignments</h2>
            {sortedAssignments.length === 0 && (
              <p className="tasks-page__empty">No assignments.</p>
            )}
            <div className="tasks-page__list" role="list" aria-label="Assignments">
              {sortedAssignments.map((a) => (
                <div key={a.id} className="task-card task-card--assignment" role="listitem">
                  <div className="task-card__header">
                    <span className="task-card__title">{a.title}</span>
                    <span className="task-card__urgency">
                      Urgency: {(a.urgencyScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="task-card__details">
                    <span>Remaining: {formatDuration(a.remainingMinutes)}</span>
                    <span>Due: {formatDate(a.deadline)}</span>
                    <span>Progress: {a.progressPercent}%</span>
                  </div>
                  <div className="task-card__progress-bar">
                    <div
                      className="task-card__progress-fill"
                      style={{ width: `${a.progressPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
