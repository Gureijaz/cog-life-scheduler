'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PreferenceProfile } from '@/lib/types';
import { users, getCurrentUserId } from '@/lib/api';
import PreferenceForm from '@/components/settings/PreferenceForm';
import LocationManager from '@/components/settings/LocationManager';

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<PreferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = getCurrentUserId() ?? 'default';

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await users.get(userId);
      // Preferences are fetched via the user endpoint or a separate call
      // For now we'll try to get them; if the API returns them embedded, great
      setPrefs((user as unknown as { preferences?: PreferenceProfile }).preferences ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">Settings</h1>
      </header>

      {loading && <p className="tasks-page__status">Loading…</p>}
      {error && <p className="tasks-page__status tasks-page__status--error">{error}</p>}

      <div className="settings-page__sections">
        <PreferenceForm userId={userId} initial={prefs} onSaved={setPrefs} />
        <LocationManager />
      </div>
    </div>
  );
}
