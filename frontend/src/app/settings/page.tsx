'use client';

import { useState } from 'react';
import { getCurrentUserId } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import type { PreferenceProfile } from '@/lib/types';
import PreferenceForm from '@/components/settings/PreferenceForm';
import LocationManager from '@/components/settings/LocationManager';

export default function SettingsPage() {
  const { addToast } = useToast();
  const userId = getCurrentUserId() ?? 'default';
  const [prefs, setPrefs] = useState<PreferenceProfile | null>(null);

  const handleSaved = (p: PreferenceProfile) => {
    setPrefs(p);
    addToast('success', 'Settings saved successfully');
  };

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">Settings</h1>
      </header>

      <div className="settings-page__sections">
        <PreferenceForm userId={userId} initial={prefs} onSaved={handleSaved} />
        <LocationManager />
      </div>
    </div>
  );
}
