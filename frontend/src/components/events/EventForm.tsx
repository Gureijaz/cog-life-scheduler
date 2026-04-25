'use client';

import { useState, useEffect, useRef } from 'react';
import type { FixedEvent } from '@/lib/types';
import { fixedEvents, ApiRequestError } from '@/lib/api';
import type { CreateFixedEventInput } from '@/lib/api';
import RecurrenceSelector from './RecurrenceSelector';

interface ConflictWarning {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface EventFormProps {
  initial?: FixedEvent | null;
  onSaved?: (event: FixedEvent) => void;
  onCancel?: () => void;
}

export default function EventForm({ initial, onSaved, onCancel }: EventFormProps) {
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(initial?.recurrenceRule ?? null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [conflictConfirmed, setConflictConfirmed] = useState(false);

  const checkConflicts = async (): Promise<ConflictWarning[]> => {
    if (!eventDate || !startTime || !endTime) return [];
    try {
      const existing = await fixedEvents.list(eventDate);
      const overlapping = existing.filter((ev) => {
        if (isEdit && ev.id === initial!.id) return false;
        return ev.startTime < endTime && ev.endTime > startTime;
      });
      return overlapping.map((ev) => ({
        eventId: ev.id,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
      }));
    } catch {
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    // Check for conflicts before saving (Requirement 2.3)
    if (!conflictConfirmed) {
      const found = await checkConflicts();
      if (found.length > 0) {
        setConflicts(found);
        setSaving(false);
        return;
      }
    }

    const data: CreateFixedEventInput = {
      title,
      eventDate,
      startTime,
      endTime,
      category,
      notes: notes || null,
      recurrenceRule: recurrenceRule || null,
    };

    try {
      const result = isEdit
        ? await fixedEvents.update(initial!.id, data)
        : await fixedEvents.create(data);
      setConflicts([]);
      setConflictConfirmed(false);
      onSaved?.(result);
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

  const handleConflictConfirm = () => {
    setConflictConfirmed(true);
    setConflicts([]);
  };

  const handleConflictCancel = () => {
    setConflicts([]);
    setConflictConfirmed(false);
  };

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (conflictConfirmed && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, [conflictConfirmed]);

  return (
    <form className="entity-form" onSubmit={handleSubmit} ref={formRef}>
      <h2 className="entity-form__title">{isEdit ? 'Edit Event' : 'New Fixed Event'}</h2>

      {errors._form && <p className="entity-form__error">{errors._form}</p>}

      {conflicts.length > 0 && (
        <div className="conflict-warning" role="alert">
          <p className="conflict-warning__title">⚠ Time Conflict Detected</p>
          <ul className="conflict-warning__list">
            {conflicts.map((c) => (
              <li key={c.eventId} className="conflict-warning__item">
                &ldquo;{c.title}&rdquo; ({c.startTime} – {c.endTime})
              </li>
            ))}
          </ul>
          <div className="conflict-warning__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={handleConflictConfirm}>
              Save Anyway
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleConflictCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <label className="form-field">
        <span className="form-field__label">Title</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        {errors.title && <span className="form-field__error">{errors.title}</span>}
      </label>

      <label className="form-field">
        <span className="form-field__label">Date</span>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        {errors.eventDate && <span className="form-field__error">{errors.eventDate}</span>}
      </label>

      <div className="form-row">
        <label className="form-field">
          <span className="form-field__label">Start Time</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          {errors.startTime && <span className="form-field__error">{errors.startTime}</span>}
        </label>
        <label className="form-field">
          <span className="form-field__label">End Time</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          {errors.endTime && <span className="form-field__error">{errors.endTime}</span>}
        </label>
      </div>

      <label className="form-field">
        <span className="form-field__label">Category</span>
        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. class, work, appointment" />
        {errors.category && <span className="form-field__error">{errors.category}</span>}
      </label>

      <label className="form-field">
        <span className="form-field__label">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>

      <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />

      <div className="entity-form__actions">
        {onCancel && <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update Event' : 'Create Event'}
        </button>
      </div>
    </form>
  );
}
