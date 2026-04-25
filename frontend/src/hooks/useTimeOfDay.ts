'use client';

import { useEffect, useState, useMemo } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface LightingState {
  ambientColor: string;
  ambientIntensity: number;
  directionalColor: string;
  directionalIntensity: number;
  directionalPosition: [number, number, number];
  fogColor: string;
  fogNear: number;
  fogFar: number;
  starOpacity: number;
}

export const LIGHTING_PRESETS: Record<TimeOfDay, LightingState> = {
  morning: {
    ambientColor: '#FFF8E1',
    ambientIntensity: 0.6,
    directionalColor: '#FFD54F',
    directionalIntensity: 1.2,
    directionalPosition: [-5, 10, 5],
    fogColor: '#FFF3E0',
    fogNear: 20,
    fogFar: 80,
    starOpacity: 0,
  },
  afternoon: {
    ambientColor: '#E3F2FD',
    ambientIntensity: 0.8,
    directionalColor: '#90CAF9',
    directionalIntensity: 1.0,
    directionalPosition: [0, 15, 0],
    fogColor: '#BBDEFB',
    fogNear: 25,
    fogFar: 100,
    starOpacity: 0,
  },
  evening: {
    ambientColor: '#F3E5F5',
    ambientIntensity: 0.5,
    directionalColor: '#CE93D8',
    directionalIntensity: 0.8,
    directionalPosition: [10, 5, -5],
    fogColor: '#E1BEE7',
    fogNear: 15,
    fogFar: 70,
    starOpacity: 0.3,
  },
  night: {
    ambientColor: '#1A237E',
    ambientIntensity: 0.2,
    directionalColor: '#5C6BC0',
    directionalIntensity: 0.3,
    directionalPosition: [0, 10, 10],
    fogColor: '#0D1B2A',
    fogNear: 10,
    fogFar: 60,
    starOpacity: 1.0,
  },
};

export const TIME_GRADIENTS: Record<TimeOfDay, { colors: [string, string, string, string] }> = {
  morning:   { colors: ['#FF9A56', '#FFD194', '#FFF3E0', '#FFE0B2'] },
  afternoon: { colors: ['#4FC3F7', '#81D4FA', '#B3E5FC', '#E1F5FE'] },
  evening:   { colors: ['#CE93D8', '#F48FB1', '#FFAB91', '#FFE082'] },
  night:     { colors: ['#1A237E', '#283593', '#0D47A1', '#1B1B3A'] },
};

export function computeTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function interpolateLighting(current: LightingState, target: LightingState, progress: number): LightingState {
  const t = Math.max(0, Math.min(1, progress));
  return {
    ambientColor: lerpColor(current.ambientColor, target.ambientColor, t),
    ambientIntensity: lerp(current.ambientIntensity, target.ambientIntensity, t),
    directionalColor: lerpColor(current.directionalColor, target.directionalColor, t),
    directionalIntensity: lerp(current.directionalIntensity, target.directionalIntensity, t),
    directionalPosition: lerpVec3(current.directionalPosition, target.directionalPosition, t),
    fogColor: lerpColor(current.fogColor, target.fogColor, t),
    fogNear: lerp(current.fogNear, target.fogNear, t),
    fogFar: lerp(current.fogFar, target.fogFar, t),
    starOpacity: lerp(current.starOpacity, target.starOpacity, t),
  };
}

function getProgressInPeriod(hour: number, minute: number): number {
  const totalMin = hour * 60 + minute;
  if (hour >= 6 && hour < 12) return (totalMin - 360) / 360;
  if (hour >= 12 && hour < 17) return (totalMin - 720) / 300;
  if (hour >= 17 && hour < 21) return (totalMin - 1020) / 240;
  // night: 21-6 (9 hours = 540 min)
  const nightMin = hour >= 21 ? totalMin - 1260 : totalMin + 180;
  return nightMin / 540;
}

export function useTimeOfDay(updateIntervalMs: number = 60000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), updateIntervalMs);
    return () => clearInterval(id);
  }, [updateIntervalMs]);

  const timeOfDay = useMemo(() => computeTimeOfDay(now), [now]);
  const progress = useMemo(() => getProgressInPeriod(now.getHours(), now.getMinutes()), [now]);
  const lighting = useMemo(() => LIGHTING_PRESETS[timeOfDay], [timeOfDay]);

  return { timeOfDay, lighting, progress };
}
