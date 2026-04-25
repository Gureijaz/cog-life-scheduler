'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ParticleEventType = 'explosion' | 'dissolution' | 'sparkle' | 'logoAssembly';

export interface ParticleEvent {
  id: string;
  type: ParticleEventType;
  origin: { x: number; y: number; z: number };
  color: string;
  count: number;
  targetPositions?: { x: number; y: number; z: number }[];
  duration: number;
  timestamp: number;
}

let eventCounter = 0;

function domToWorld(rect: DOMRect): { x: number; y: number; z: number } {
  const x = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
  const y = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
  return { x: x * 10, y: y * 10, z: 0 };
}

export function useParticleController() {
  const [events, setEvents] = useState<ParticleEvent[]>([]);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const triggerExplosion = useCallback((origin: DOMRect, color: string, targets?: DOMRect[]) => {
    if (reducedMotion.current) return;
    const worldOrigin = domToWorld(origin);
    const targetPositions = targets?.map(domToWorld);
    const event: ParticleEvent = {
      id: `explosion-${++eventCounter}`,
      type: 'explosion',
      origin: worldOrigin,
      color,
      count: 500,
      targetPositions,
      duration: 1.5,
      timestamp: Date.now(),
    };
    setEvents(prev => [...prev, event]);
  }, []);

  const triggerDissolve = useCallback((bounds: DOMRect, color: string) => {
    if (reducedMotion.current) return;
    const worldOrigin = domToWorld(bounds);
    const event: ParticleEvent = {
      id: `dissolve-${++eventCounter}`,
      type: 'dissolution',
      origin: worldOrigin,
      color,
      count: 300,
      duration: 1.5,
      timestamp: Date.now(),
    };
    setEvents(prev => [...prev, event]);
  }, []);

  const triggerSparkle = useCallback((path: { x: number; y: number }[], color: string) => {
    if (reducedMotion.current) return;
    const origin = path.length > 0
      ? { x: (path[0].x / window.innerWidth) * 20 - 10, y: -(path[0].y / window.innerHeight) * 20 + 10, z: 0 }
      : { x: 0, y: 0, z: 0 };
    const event: ParticleEvent = {
      id: `sparkle-${++eventCounter}`,
      type: 'sparkle',
      origin,
      color,
      count: 50,
      duration: 0.8,
      timestamp: Date.now(),
    };
    setEvents(prev => [...prev, event]);
  }, []);

  const clearCompleted = useCallback(() => {
    const now = Date.now();
    setEvents(prev => prev.filter(e => now - e.timestamp < e.duration * 1000));
  }, []);

  return { events, triggerExplosion, triggerDissolve, triggerSparkle, clearCompleted };
}
