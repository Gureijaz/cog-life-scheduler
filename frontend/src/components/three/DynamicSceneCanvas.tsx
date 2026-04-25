'use client';

import dynamic from 'next/dynamic';

const DynamicSceneCanvas = dynamic(
  () => import('./SceneCanvas'),
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
          zIndex: 1,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    ),
  }
);

export default DynamicSceneCanvas;
