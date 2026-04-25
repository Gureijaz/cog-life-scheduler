'use client';

import dynamic from 'next/dynamic';

const DynamicGradientMesh = dynamic(
  () => import('./GradientMeshBackground'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          background: 'linear-gradient(135deg, #1A237E 0%, #283593 50%, #0D47A1 100%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    ),
  }
);

export default DynamicGradientMesh;
