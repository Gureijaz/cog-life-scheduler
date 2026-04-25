'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { TimeOfDay } from '@/hooks/useTimeOfDay';
import { TIME_GRADIENTS } from '@/hooks/useTimeOfDay';

interface GradientMeshBackgroundProps {
  timeOfDay: TimeOfDay;
  animationSpeed?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export default function GradientMeshBackground({ timeOfDay, animationSpeed = 0.0005 }: GradientMeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const currentColors = useRef<[number, number, number][]>(
    TIME_GRADIENTS[timeOfDay].colors.map(hexToRgb)
  );
  const targetColors = useRef<[number, number, number][]>(
    TIME_GRADIENTS[timeOfDay].colors.map(hexToRgb)
  );
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    targetColors.current = TIME_GRADIENTS[timeOfDay].colors.map(hexToRgb);
  }, [timeOfDay]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
    // Interpolate current toward target
    for (let i = 0; i < 4; i++) {
      for (let c = 0; c < 3; c++) {
        currentColors.current[i][c] += (targetColors.current[i][c] - currentColors.current[i][c]) * 0.005;
      }
    }

    const cols = currentColors.current;
    const sinT = reducedMotion.current ? 0 : Math.sin(time * animationSpeed);
    const cosT = reducedMotion.current ? 0 : Math.cos(time * animationSpeed * 0.7);

    // Animated control point offsets
    const offsets = [
      { x: sinT * w * 0.1, y: cosT * h * 0.1 },
      { x: -cosT * w * 0.1, y: sinT * h * 0.08 },
      { x: cosT * w * 0.08, y: -sinT * h * 0.1 },
      { x: -sinT * w * 0.12, y: -cosT * h * 0.06 },
    ];

    // Draw 4 radial gradients blended together
    ctx.clearRect(0, 0, w, h);

    const positions = [
      [w * 0.25 + offsets[0].x, h * 0.25 + offsets[0].y],
      [w * 0.75 + offsets[1].x, h * 0.25 + offsets[1].y],
      [w * 0.25 + offsets[2].x, h * 0.75 + offsets[2].y],
      [w * 0.75 + offsets[3].x, h * 0.75 + offsets[3].y],
    ];

    ctx.globalCompositeOperation = 'source-over';
    const radius = Math.max(w, h) * 0.7;

    for (let i = 0; i < 4; i++) {
      const [cx, cy] = positions[i];
      const [r, g, b] = cols[i];
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.8)`);
      grad.addColorStop(1, `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }, [animationSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let startTime = performance.now();

    const animate = (time: number) => {
      draw(ctx, canvas.width, canvas.height, time - startTime);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
