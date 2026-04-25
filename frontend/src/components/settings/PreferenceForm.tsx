'use client';

import { useState } from 'react';
import type { PreferenceProfile, TimeWindow } from '@/lib/types';
import { users, ApiRequestError } from '@/lib/api';
import type { UpdatePreferencesInput } from '@/lib/api';

interface PreferenceFormProps {
  userId: string;
  initial?: PreferenceProfile | null;
  onSaved?: (prefs: PreferenceProfile) => void;
}

function parseWindows(raw: string): TimeWindow[] {
  if (!raw.trim()) return [];
  return raw.split('\n').filter(Boolean).map((line) => {
    const [start, end] = line.split('-').map((s) => s.trim());
    return { start: start || '00:00', end: end || '00:00' };
  });
}

function formatWindows(windows: TimeWindow[]): string {
  return windows.map((w) => `${w.start}-${w.end}`).join('\n');
}

export default function PreferenceForm({ userId, initial, onSaved }: PreferenceFormProps) {
  const [wakeTime, setWakeTime] = useState(initial?.wakeTime ?? '07:00');
  const [sleepTime, setSleepTime] = useState(initial?.sleepTime ?? '23:00');
  const [focusRaw, setFocusRaw] = useState(formatWindows(initial?.focusWindows ?? []));
  const [workoutRaw, setWorkoutRaw] = useState(formatWindows(initial?.workoutWindows ?? []));
  const [minBufferMinutes, setMinBufferMinutes] = useState(initial?.minBufferMinutes ?? 5);
  const [maxDeepWorkMinutes, setMaxDeepWorkMinutes] = useState(initial?.maxDeepWorkMinutes ?? 90);
  const [defaultCommuteMinutes, setDefaultCommuteMinutes] = useState(initial?.defaultCommuteMinutes ?? 15);
  const [autoRepairEnabled, setAutoRepairEnabled] = useState(initial?.autoRepairEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSuccess(false);

    const data: UpdatePreferencesInput = {
      wakeTime, sleepTime,
      focusWindows: parseWindows(focusRaw),
      workoutWindows: parseWindows(workoutRaw),
      minBufferMinutes, maxDeepWorkMinutes, defaultCommuteMinutes, autoRepairEnabled,
    };

    try {
      const result = await users.updatePreferences(userId, data);
      setSuccess(true);
      onSaved?.(result);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 400) {
        setErrors(err.body.fields ?? { _form: err.message });
      } else {
        setErrors({ _form: err instanceof Error ? err.message : 'Save failed' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <h2 className="entity-form__title">Preferences</h2>

      {errors._form && <p className="entity-form__error">{errors._form}</p>}
      {success && <p className="entity-form__success">Preferences saved.</p>}

      <div className="form-row">
        <label className="form-field">
          <span className="form-field__label">Wake time</span>
          <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} required />
          {errors.wakeTime && <span className="form-field__error">{errors.wakeTime}</span>}
        </label>
        <label className="form-field">
          <span className="form-field__label">Sleep time</span>
          <input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} required />
          {errors.sleepTime && <span className="form-field__error">{errors.sleepTime}</span>}
        </label>
      </div>

      <label className="form-field">
        <span className="form-field__label">Focus windows (one per line, HH:mm-HH:mm)</span>
        <textarea value={focusRaw} onChange={(e) => setFocusRaw(e.target.value)} rows={2} placeholder="09:00-12:00" />
      </label>

      <label className="form-field">
        <span className="form-field__label">Workout windows (one per line, HH:mm-HH:mm)</span>
        <textarea value={workoutRaw} onChange={(e) => setWorkoutRaw(e.target.value)} rows={2} placeholder="17:00-18:30" />
      </label>

      <div className="form-row">
        <label className="form-field">
          <span className="form-field__label">Buffer (min)</span>
          <input type="number" min={0} value={minBufferMinutes} onChange={(e) => setMinBufferMinutes(Number(e.target.value))} />
          {errors.minBufferMinutes && <span className="form-field__error">{errors.minBufferMinutes}</span>}
        </label>
        <label className="form-field">
          <span className="form-field__label">Max deep work (min)</span>
          <input type="number" min={1} value={maxDeepWorkMinutes} onChange={(e) => setMaxDeepWorkMinutes(Number(e.target.value))} />
        </label>
      </div>

      <label className="form-field">
        <span className="form-field__label">Default commute (min)</span>
        <input type="number" min={0} value={defaultCommuteMinutes} onChange={(e) => setDefaultCommuteMinutes(Number(e.target.value))} />
      </label>

      <label className="form-checkbox">
        <input type="checkbox" checked={autoRepairEnabled} onChange={(e) => setAutoRepairEnabled(e.target.checked)} />
        <span>Auto-repair schedule on changes</span>
      </label>

      <div className="entity-form__actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}
