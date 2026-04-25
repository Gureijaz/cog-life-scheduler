'use client';

import { useRef, useState, useCallback, useEffect, type ReactNode, type CSSProperties } from 'react';

interface FloatingCard3DProps {
  children: ReactNode;
  className?: string;
  depth?: number;
  rotateIntensity?: number;
  floatAmplitude?: number;
  floatSpeed?: number;
}

export default function FloatingCard3D({
  children,
  className = '',
  depth = 800,
  rotateIntensity = 12,
  floatAmplitude = 4,
  floatSpeed = 4,
}: FloatingCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion.current || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRotate = Math.min(rotateIntensity, 15);
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * maxRotate;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * maxRotate;
    setRotation({ x: rotateX, y: rotateY });
  }, [rotateIntensity]);

  const handleMouseLeave = useCallback(() => {
    setRotation({ x: 0, y: 0 });
    setHovering(false);
  }, []);

  const innerStyle: CSSProperties = {
    transform: hovering
      ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
      : 'rotateX(0deg) rotateY(0deg)',
    animationDuration: `${floatSpeed}s`,
  };

  const shadowX = rotation.y * 0.5;
  const shadowY = -rotation.x * 0.5 + 4;
  const shadowStyle: CSSProperties = {
    boxShadow: hovering
      ? `${shadowX}px ${shadowY}px 20px rgba(0,0,0,0.15)`
      : '0 4px 12px rgba(0,0,0,0.06)',
  };

  return (
    <div
      ref={cardRef}
      className={`floating-card-3d ${className}`}
      style={{ perspective: depth }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="floating-card-3d__inner" style={{ ...innerStyle, ...shadowStyle }}>
        {children}
      </div>
    </div>
  );
}
