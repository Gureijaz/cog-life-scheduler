'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import type { TimeOfDay } from '@/hooks/useTimeOfDay';
import { LIGHTING_PRESETS } from '@/hooks/useTimeOfDay';
import type { ParticleEvent } from '@/hooks/useParticleController';
import FloatingGeometries from './FloatingGeometries';
import CinematicCamera from './CinematicCamera';
import ParticleSystem from './ParticleSystem';

interface SceneCanvasProps {
  currentRoute: string;
  mousePosition: { x: number; y: number };
  timeOfDay: TimeOfDay;
  particleEvents: ParticleEvent[];
  cameraTarget?: { position: [number, number, number]; lookAt: [number, number, number] };
  quality?: {
    postProcessing: boolean;
    geometryCount: number;
    particleMultiplier: number;
    sceneEnabled: boolean;
  };
  onParticleEventComplete?: (id: string) => void;
}

export default function SceneCanvas({
  currentRoute,
  mousePosition,
  timeOfDay,
  particleEvents,
  cameraTarget = { position: [0, 0, 20], lookAt: [0, 0, 0] },
  quality = { postProcessing: true, geometryCount: 15, sceneEnabled: true, particleMultiplier: 1 },
  onParticleEventComplete,
}: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const restoreAttempts = useRef(0);

  const lighting = LIGHTING_PRESETS[timeOfDay];

  // WebGL context loss handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      restoreAttempts.current++;
      if (restoreAttempts.current <= 3) {
        setContextLost(false);
      }
    };

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, []);

  if (!quality.sceneEnabled) return null;

  return (
    <div
      ref={containerRef}
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
    >
      {contextLost && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 12,
          zIndex: 10,
        }}>
          3D effects paused
        </div>
      )}
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        camera={{ fov: 60, near: 0.1, far: 200, position: [0, 0, 20] }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <CinematicCamera
            targetPosition={cameraTarget.position}
            targetLookAt={cameraTarget.lookAt}
            parallaxOffset={mousePosition}
          />

          <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity} />
          <directionalLight
            color={lighting.directionalColor}
            intensity={lighting.directionalIntensity}
            position={lighting.directionalPosition}
          />

          <Stars
            radius={80}
            depth={50}
            count={2000}
            factor={4}
            saturation={0}
            fade
          />

          <FloatingGeometries
            count={quality.geometryCount}
            spread={30}
            timeOfDay={timeOfDay}
          />

          <ParticleSystem
            events={particleEvents}
            onEventComplete={onParticleEventComplete ?? (() => {})}
          />

          {quality.postProcessing && (
            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.5}
                luminanceThreshold={0.6}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={new THREE.Vector2(0.0005, 0.0005)}
                radialModulation={false}
                modulationOffset={0}
              />
              <Vignette eskil={false} offset={0.1} darkness={0.5} />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
