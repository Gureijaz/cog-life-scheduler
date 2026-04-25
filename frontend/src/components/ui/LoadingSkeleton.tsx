'use client';

interface LoadingSkeletonProps {
  variant: 'block' | 'card' | 'text' | 'column';
  count?: number;
}

export default function LoadingSkeleton({ variant, count = 1 }: LoadingSkeletonProps) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton skeleton--${variant}`} />
      ))}
    </div>
  );
}
