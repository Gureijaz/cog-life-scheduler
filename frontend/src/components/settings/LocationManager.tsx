'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Location, TravelRule } from '@/lib/types';
import { locations as locApi, travelRules as trApi, ApiRequestError } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function LocationManager() {
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [rules, setRules] = useState<TravelRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // New location form
  const [locName, setLocName] = useState('');
  const [locLabel, setLocLabel] = useState('');
  const [locType, setLocType] = useState('other');

  // New travel rule form
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');
  const [travelMinutes, setTravelMinutes] = useState(15);

  const fetchData = useCallback(async () => {
    try {
      const [locs, rls] = await Promise.all([locApi.list(), trApi.list()]);
      setLocationList(locs);
      setRules(rls);
    } catch {
      // Silently handle — empty lists are fine
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const getLocationName = (id: string): string => {
    const loc = locationList.find((l) => l.id === id);
    return loc ? loc.name : id;
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loc = await locApi.create({ name: locName, label: locLabel, type: locType });
      setLocationList((prev) => [...prev, loc]);
      setLocName('');
      setLocLabel('');
      addToast('success', 'Location added');
    } catch (err: unknown) {
      addToast('error', err instanceof ApiRequestError ? err.message : 'Failed to create location');
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rule = await trApi.create({ originId, destinationId: destId, travelMinutes });
      setRules((prev) => [...prev, rule]);
      addToast('success', 'Travel rule added');
    } catch (err: unknown) {
      addToast('error', err instanceof ApiRequestError ? err.message : 'Failed to create travel rule');
    }
  };

  if (loading) return null;

  return (
    <div className="location-manager">
      <h2 className="entity-form__title">Locations &amp; Travel Rules</h2>

      <form className="entity-form entity-form--inline" onSubmit={handleAddLocation}>
        <h3 className="form-field__label">Add Location</h3>
        <div className="form-row">
          <label className="form-field">
            <span className="form-field__label">Name</span>
            <input type="text" value={locName} onChange={(e) => setLocName(e.target.value)} required placeholder="Home" />
          </label>
          <label className="form-field">
            <span className="form-field__label">Label</span>
            <input type="text" value={locLabel} onChange={(e) => setLocLabel(e.target.value)} placeholder="My place" />
          </label>
          <label className="form-field">
            <span className="form-field__label">Type</span>
            <select value={locType} onChange={(e) => setLocType(e.target.value)}>
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="school">School</option>
              <option value="gym">Gym</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <button type="submit" className="btn btn--primary">Add Location</button>
      </form>

      {locationList.length > 0 && (
        <ul className="location-manager__list">
          {locationList.map((loc) => (
            <li key={loc.id} className="location-manager__item">
              {loc.name} <span className="location-manager__badge">{loc.type}</span>
            </li>
          ))}
        </ul>
      )}

      {locationList.length >= 2 && (
        <form className="entity-form entity-form--inline" onSubmit={handleAddRule}>
          <h3 className="form-field__label">Add Travel Rule</h3>
          <div className="form-row">
            <label className="form-field">
              <span className="form-field__label">From</span>
              <select value={originId} onChange={(e) => setOriginId(e.target.value)} required>
                <option value="">Select…</option>
                {locationList.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">To</span>
              <select value={destId} onChange={(e) => setDestId(e.target.value)} required>
                <option value="">Select…</option>
                {locationList.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">Minutes</span>
              <input type="number" min={1} value={travelMinutes} onChange={(e) => setTravelMinutes(Number(e.target.value))} required />
            </label>
          </div>
          <button type="submit" className="btn btn--primary">Add Rule</button>
        </form>
      )}

      {rules.length > 0 && (
        <>
          <h3 className="form-field__label" style={{ marginTop: 'var(--space-md)' }}>Travel Rules</h3>
          <ul className="location-manager__list">
            {rules.map((r) => (
              <li key={r.id} className="location-manager__item">
                {getLocationName(r.originId)} → {getLocationName(r.destinationId)}: {r.travelMinutes} min
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
