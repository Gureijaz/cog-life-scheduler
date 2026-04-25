'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

const CinematicLoader = dynamic(
  () => import('./CinematicLoader'),
  {
    ssr: false,
    loading: () => null,
  }
);

interface DynamicCinematicLoaderProps {
  onComplete: () => void;
}

export default function DynamicCinematicLoader({ onComplete }: DynamicCinematicLoaderProps) {
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the dynamic import fails or takes too long, reveal the app
  useEffect(() => {
    fallbackTimer.current = setTimeout(() => {
      onComplete();
    }, 8000);
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, [onComplete]);

  return <CinematicLoader onComplete={onComplete} />;
}
