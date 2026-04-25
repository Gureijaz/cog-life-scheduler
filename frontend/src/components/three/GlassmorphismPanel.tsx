'use client';

import type { CSSProperties, ReactNode } from 'react';

interface GlassmorphismPanelProps {
  children: ReactNode;
  className?: string;
  blur?: number;
  opacity?: number;
  borderOpacity?: number;
  style?: CSSProperties;
}

export default function GlassmorphismPanel({
  children,
  className = '',
  blur = 12,
  opacity = 0.7,
  borderOpacity = 0.2,
  style,
}: GlassmorphismPanelProps) {
  const panelStyle: CSSProperties = {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    backgroundColor: `rgba(var(--glass-bg-rgb, 255, 255, 255), ${opacity})`,
    border: `1px solid rgba(var(--glass-border-rgb, 255, 255, 255), ${borderOpacity})`,
    ...style,
  };

  return (
    <div className={`glassmorphism-panel ${className}`} style={panelStyle}>
      {children}
    </div>
  );
}
