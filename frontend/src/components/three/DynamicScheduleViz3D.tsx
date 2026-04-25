'use client';

import dynamic from 'next/dynamic';

const DynamicScheduleViz3D = dynamic(
  () => import('./ScheduleVisualization3D'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: '100%',
        height: 500,
        borderRadius: 12,
        background: 'rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontSize: 14,
      }}>
        Loading 3D visualization…
      </div>
    ),
  }
);

export default DynamicScheduleViz3D;
