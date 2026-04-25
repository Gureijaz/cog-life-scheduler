'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type QualityLevel = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = full quality
// 1 = disable post-processing
// 2 = reduce particles 50%
// 3 = reduce geometries
// 4 = disable parallax
// 5 = static fallback (2D only)

const STORAGE_KEY = 'cog-quality-level';
const FPS_THRESHOLD = 30;
const LOW_FPS_DURATION_MS = 3000;

export interface QualitySettings {
  level: QualityLevel;
  postProcessing: boolean;
  particleMultiplier: number;
  geometryCount: number;
  parallaxEnabled: boolean;
  sceneEnabled: boolean;
}

function getSettingsForLevel(level: QualityLevel): QualitySettings {
  switch (level) {
    case 0: return { level, postProcessing: true, particleMultiplier: 1, geometryCount: 15, parallaxEnabled: true, sceneEnabled: true };
    case 1: return { level, postProcessing: false, particleMultiplier: 1, geometryCount: 15, parallaxEnabled: true, sceneEnabled: true };
    case 2: return { level, postProcessing: false, particleMultiplier: 0.5, geometryCount: 15, parallaxEnabled: true, sceneEnabled: true };
    case 3: return { level, postProcessing: false, particleMultiplier: 0.5, geometryCount: 8, parallaxEnabled: true, sceneEnabled: true };
    case 4: return { level, postProcessing: false, particleMultiplier: 0.5, geometryCount: 8, parallaxEnabled: false, sceneEnabled: true };
    case 5: return { level, postProcessing: false, particleMultiplier: 0, geometryCount: 0, parallaxEnabled: false, sceneEnabled: false };
  }
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function useAdaptiveQuality(): QualitySettings {
  const [level, setLevel] = useState<QualityLevel>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 0 && parsed <= 5) return parsed as QualityLevel;
    }
    return isMobileDevice() ? 2 : 0;
  });

  const fpsHistory = useRef<number[]>([]);
  const lastFrameTime = useRef(performance.now());
  const lowFpsStart = useRef<number | null>(null);

  const degradeQuality = useCallback(() => {
    setLevel(prev => {
      const next = Math.min(5, prev + 1) as QualityLevel;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number;

    const measure = () => {
      const now = performance.now();
      const delta = now - lastFrameTime.current;
      lastFrameTime.current = now;

      if (delta > 0) {
        const fps = 1000 / delta;
        fpsHistory.current.push(fps);
        if (fpsHistory.current.length > 60) fpsHistory.current.shift();

        const avgFps = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length;

        if (avgFps < FPS_THRESHOLD) {
          if (!lowFpsStart.current) lowFpsStart.current = now;
          else if (now - lowFpsStart.current > LOW_FPS_DURATION_MS) {
            degradeQuality();
            lowFpsStart.current = null;
            fpsHistory.current = [];
          }
        } else {
          lowFpsStart.current = null;
        }
      }

      rafId = requestAnimationFrame(measure);
    };

    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, [degradeQuality]);

  return getSettingsForLevel(level);
}
