'use client';

import { useState } from 'react';
import type { FlexibleTask, Assignment, Priority, EnergyLevel } from '@/lib/types';
import { flexibleTasks, assignments, ApiRequestError } from '@/lib/api';
import type { CreateFlexibleTaskInput, CreateAssignmentInput } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Mode = 'task' | 'assignment';

interface TaskFormProps {
  mode?: Mode;
  initialTask?: FlexibleTask | null;
  initialAssignment?: Assignment | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function TaskForm({ mode: initialMode, initialTask, initialAssignment, onSaved, onCancel }: TaskFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (initialAssignment ? 'assignment' : 'task'));
  const isEditTask = !!initialTask;
  const isEditAssignment = !!initialAssignment;
  const { addToast } = useToast();

  const [title, setTitle] = useState(initialTask?.title ?? initialAssignment?.title ?? '');
  const [category, setCategory] = useState(initialTask?.category ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(initialTask?.estimatedMinutes ?? 60);
  const [minSessionMinutes, setMinSessionMinutes] = useState(initialTask?.minSessionMinutes ?? 15);
  const [priority, setPriority] = useState<Priority>(initialTask?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? '');
  const [energyRequirement, setEnergyRequirement] = useState<EnergyLevel>(initialTask?.energyRequirement ?? 'medium');

  const [subject, setSubject] = useState(initialAssignment?.subject ?? '');
  const [deadline, setDeadline] = useState(initialAssignment?.deadline?.slice(0, 16) ?? '');
  const [totalMinutes, setTotalMinutes] = useState(initialAssignment?.estimatedTotalMinutes ?? 120);
  const [progressPercent, setProgressPercent] = useState(initialAssignment?.progressPercent ?? 0);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      if (mode === 'task') {
        const data: CreateFlexibleTaskInput = {
          title, category, estimatedMinutes, minSessionMinutes, priority, energyRequirement,
          dueDate: dueDate || null,
        };
        if (isEditTask) {
          await flexibleTasks.update(initialTask!.id, data);
        } else {
          await flexibleTasks.create(data);
        }
        addToast('success', isEditTask ? 'Task updated' : 'Task created');
      } else {
        const data: CreateAssignmentInput = {
          title, subject, deadline: new Date(deadline).toISOString(),
          estimatedTotalMinutes: totalMinutes, progressPercent,
        };
        if (isEditAssignment) {
          await assignments.update(initialAssignment!.id, data);
        } else {
          await assignments.create(data);
        }
        addToast('success', isEditAssignment ? 'Assignment updated' : 'Assignment created');
      }
      onSaved?.();
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 400) {
        setErrors(err.body.error?.details ?? { _form: err.message });
      } else {
        setErrors({ _form: err instanceof Error ? err.message : 'Save failed' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <h2 className="entity-form__title">
        {isEditTask ? 'Edit Task' : isEditAssignment ? 'Edit Assignment' : mode === 'task' ? 'New Flexible Task' : 'New Assignment'}
      </h2>

      {!isEditTask && !isEditAssignment && (
        <div className="entity-form__tabs">
          <button type="button" className={`entity-form__tab${mode === 'task' ? ' entity-form__tab--active' : ''}`} onClick={() => setMode('task')}>Task</button>
          <button type="button" className={`entity-form__tab${mode === 'assignment' ? ' entity-form__tab--active' : ''}`} onClick={() => setMode('assignment')}>Assignment</button>
        </div>
      )}

      {errors._form && <p className="entity-form__error">{errors._form}</p>}

      <label className="form-field">
        <span className="form-field__label">Title</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        {errors.title && <span className="form-field__error">{errors.title}</span>}
      </label>

      {mode === 'task' ? (
        <>
          <label className="form-field">
            <span className="form-field__label">Category</span>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. study, workout, errand" />
          </label>
          <div className="form-row">
            <label className="form-field">
              <span className="form-field__label">Estimated (min)</span>
              <input type="number" min={1} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} required />
              {errors.estimatedMinutes && <span className="form-field__error">{errors.estimatedMinutes}</span>}
            </label>
            <label className="form-field">
              <span className="form-field__label">Min session (min)</span>
              <input type="number" min={1} value={minSessionMinutes} onChange={(e) => setMinSessionMinutes(Number(e.target.value))} />
              {errors.minSessionMinutes && <span className="form-field__error">{errors.minSessionMinutes}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-field">
              <span className="form-field__label">Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">Energy</span>
              <select value={energyRequirement} onChange={(e) => setEnergyRequirement(e.target.value as EnergyLevel)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="form-field">
            <span className="form-field__label">Due date (optional)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {errors.dueDate && <span className="form-field__error">{errors.dueDate}</span>}
          </label>
        </>
      ) : (
        <>
          <label className="form-field">
            <span className="form-field__label">Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Math, CS101" />
            {errors.subject && <span className="form-field__error">{errors.subject}</span>}
          </label>
          <label className="form-field">
            <span className="form-field__label">Deadline</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
            {errors.deadline && <span className="form-field__error">{errors.deadline}</span>}
          </label>
          <div className="form-row">
            <label className="form-field">
              <span className="form-field__label">Total estimated (min)</span>
              <input type="number" min={1} value={totalMinutes} onChange={(e) => setTotalMinutes(Number(e.target.value))} required />
              {errors.estimatedTotalMinutes && <span className="form-field__error">{errors.estimatedTotalMinutes}</span>}
            </label>
            <label className="form-field">
              <span className="form-field__label">Progress %</span>
              <input type="number" min={0} max={100} value={progressPercent} onChange={(e) => setProgressPercent(Number(e.target.value))} />
              {errors.progressPercent && <span className="form-field__error">{errors.progressPercent}</span>}
            </label>
          </div>
        </>
      )}

      <div className="entity-form__actions">
        {onCancel && <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving && <span className="btn__spinner" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
