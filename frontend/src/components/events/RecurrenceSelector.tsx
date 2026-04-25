'use client';

const DAYS = [
  { label: 'Mon', token: 'MON' },
  { label: 'Tue', token: 'TUE' },
  { label: 'Wed', token: 'WED' },
  { label: 'Thu', token: 'THU' },
  { label: 'Fri', token: 'FRI' },
  { label: 'Sat', token: 'SAT' },
  { label: 'Sun', token: 'SUN' },
];

interface RecurrenceSelectorProps {
  value: string | null; // e.g. "WEEKLY:MON,WED,FRI" or null
  onChange: (rule: string | null) => void;
}

function parseRule(rule: string | null): string[] {
  if (!rule || !rule.startsWith('WEEKLY:')) return [];
  return rule.slice(7).split(',').filter(Boolean);
}

function buildRule(tokens: string[]): string {
  return tokens.length > 0 ? `WEEKLY:${tokens.join(',')}` : '';
}

export default function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
  const enabled = value !== null && value !== '';
  const selectedTokens = parseRule(value);

  const toggleEnabled = () => {
    onChange(enabled ? null : '');
  };

  const toggleDay = (token: string) => {
    const next = selectedTokens.includes(token)
      ? selectedTokens.filter((t) => t !== token)
      : [...selectedTokens, token];
    onChange(next.length > 0 ? buildRule(next) : '');
  };

  return (
    <div className="recurrence-selector">
      <label className="form-checkbox">
        <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
        <span>Recurring weekly</span>
      </label>
      {enabled && (
        <div className="recurrence-selector__days">
          {DAYS.map(({ label, token }) => (
            <button
              key={token}
              type="button"
              className={`recurrence-selector__day${selectedTokens.includes(token) ? ' recurrence-selector__day--active' : ''}`}
              onClick={() => toggleDay(token)}
              aria-pressed={selectedTokens.includes(token)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
