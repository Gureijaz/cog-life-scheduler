'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export const PAGE_CAMERA_POSITIONS: Record<string, {
  position: [number, number, number];
  lookAt: [number, number, number];
}> = {
  '/':         { position: [0, 0, 20],   lookAt: [0, 0, 0] },
  '/week':     { position: [15, 5, -10],  lookAt: [15, 0, -15] },
  '/tasks':    { position: [-10, 8, 5],   lookAt: [-10, 0, 0] },
  '/settings': { position: [0, -5, 30],   lookAt: [0, -5, 25] },
};

const DEFAULT_CAMERA = PAGE_CAMERA_POSITIONS['/'];

export function useCinematicNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const currentRoute = pathname;
  const cameraTarget = PAGE_CAMERA_POSITIONS[pathname] ?? DEFAULT_CAMERA;

  const navigateTo = useCallback((route: string) => {
    if (route === pathname) return;

    if (reducedMotion.current) {
      router.push(route);
      return;
    }

    setIsTransitioning(true);
    router.push(route);

    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 800);
  }, [pathname, router]);

  // Reset transitioning when pathname changes
  useEffect(() => {
    const timer = setTimeout(() => setIsTransitioning(false), 900);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  return { currentRoute, cameraTarget, isTransitioning, navigateTo };
}
