'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ParallaxConfig {
  intensity?: number;
  smoothing?: number;
  enabled?: boolean;
}

export function useMouseParallax(config: ParallaxConfig = {}) {
  const { intensity = 1.5, smoothing = 0.08, enabled = true } = config;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: (e.clientX / window.innerWidth) * 2 - 1,
      y: -(e.clientY / window.innerHeight) * 2 + 1,
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, handleMouseMove]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const animate = () => {
      if (reducedMotion.current) {
        offsetRef.current = { x: 0, y: 0 };
        setOffset({ x: 0, y: 0 });
      } else {
        const targetX = mouseRef.current.x * intensity;
        const targetY = mouseRef.current.y * intensity;
        const prev = offsetRef.current;
        const newX = prev.x + (targetX - prev.x) * smoothing;
        const newY = prev.y + (targetY - prev.y) * smoothing;
        offsetRef.current = { x: newX, y: newY };
        setOffset({ x: newX, y: newY });
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, intensity, smoothing]);

  if (!enabled) return { x: 0, y: 0 };
  return offset;
}
