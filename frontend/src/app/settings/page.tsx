'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PreferenceProfile } from '@/lib/types';
import { users, getCurrentUserId } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import PreferenceForm from '@/components/settings/PreferenceForm';
import LocationManager from '@/components/settings/LocationManager';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<PreferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const userId = getCurrentUserId() ?? 'default';

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await users.get(userId);
      setPrefs((user as unknown as { preferences?: PreferenceProfile }).preferences ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const handleSaved = (p: PreferenceProfile) => {
    setPrefs(p);
    addToast('success', 'Settings saved successfully');
  };

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">Settings</h1>
      </header>

      {loading && <LoadingSkeleton variant="text" count={6} />}
      {error && <p className="tasks-page__status tasks-page__status--error">{error}</p>}

      {!loading && (
        <div className="settings-page__sections">
          <PreferenceForm userId={userId} initial={prefs} onSaved={handleSaved} />
          <LocationManager />
        </div>
      )}
    </div>
  );
}
