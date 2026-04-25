'use client';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface RecurrenceSelectorProps {
  value: string | null;
  onChange: (rule: string | null) => void;
}

export default function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
  const enabled = value !== null && value !== '';
  const selectedDays = value ? value.split(',').filter(Boolean) : [];

  const toggleEnabled = () => {
    onChange(enabled ? null : '');
  };

  const toggleDay = (day: string) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    onChange(next.length > 0 ? next.join(',') : '');
  };

  return (
    <div className="recurrence-selector">
      <label className="form-checkbox">
        <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
        <span>Recurring weekly</span>
      </label>
      {enabled && (
        <div className="recurrence-selector__days">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`recurrence-selector__day${selectedDays.includes(day) ? ' recurrence-selector__day--active' : ''}`}
              onClick={() => toggleDay(day)}
              aria-pressed={selectedDays.includes(day)}
            >
              {day}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
