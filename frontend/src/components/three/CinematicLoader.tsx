'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CinematicLoaderProps {
  onComplete: () => void;
  duration?: number;
}

// Generate target positions for "COG" text using simple grid sampling
function generateLetterPositions(letter: string, offsetX: number, particlesPerLetter: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  // Simple bitmap approach for C, O, G
  const bitmaps: Record<string, number[][]> = {
    C: [
      [0,1,1,1,1],
      [1,1,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,1,0,0,0],
      [0,1,1,1,1],
    ],
    O: [
      [0,1,1,1,0],
      [1,1,0,1,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,1,0,1,1],
      [0,1,1,1,0],
    ],
    G: [
      [0,1,1,1,1],
      [1,1,0,0,0],
      [1,0,0,0,0],
      [1,0,0,1,1],
      [1,1,0,0,1],
      [0,1,1,1,1],
    ],
  };

  const bitmap = bitmaps[letter] || bitmaps['O'];
  const cellSize = 0.6;
  const filledCells: [number, number][] = [];

  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (bitmap[row][col]) filledCells.push([col, row]);
    }
  }

  for (let i = 0; i < particlesPerLetter; i++) {
    const cell = filledCells[i % filledCells.length];
    const x = offsetX + cell[0] * cellSize + (Math.random() - 0.5) * cellSize * 0.8;
    const y = -(cell[1] * cellSize) + (Math.random() - 0.5) * cellSize * 0.8;
    const z = (Math.random() - 0.5) * 0.3;
    positions.push(new THREE.Vector3(x, y, z));
  }

  return positions;
}

function LogoParticles({ onComplete, duration = 3.5 }: { onComplete: () => void; duration: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const completedRef = useRef(false);
  const particleCount = 2000;

  const { targets, initPositions, positions, colors, sizes } = useMemo(() => {
    const perLetter = Math.floor(particleCount / 3);
    const cTargets = generateLetterPositions('C', -5, perLetter);
    const oTargets = generateLetterPositions('O', -1.5, perLetter);
    const gTargets = generateLetterPositions('G', 2, perLetter + (particleCount - perLetter * 3));
    const allTargets = [...cTargets, ...oTargets, ...gTargets];

    // Center
    const cx = allTargets.reduce((s, p) => s + p.x, 0) / allTargets.length;
    const cy = allTargets.reduce((s, p) => s + p.y, 0) / allTargets.length;
    allTargets.forEach(p => { p.x -= cx; p.y -= cy; });

    const initPos = allTargets.map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 20
    ));

    return {
      targets: allTargets,
      initPositions: initPos,
      positions: new Float32Array(allTargets.length * 3),
      colors: new Float32Array(allTargets.length * 3),
      sizes: new Float32Array(allTargets.length),
    };
  }, []);

  // Init colors
  useEffect(() => {
    const color = new THREE.Color('#6366f1');
    for (let i = 0; i < targets.length; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = 0.08;
    }
  }, [targets, colors, sizes]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    for (let i = 0; i < targets.length; i++) {
      let x: number, y: number, z: number;
      let size = 0.08;

      if (t < 2) {
        // Phase 1: converge
        const progress = Math.min(1, t / 2);
        const ease = 1 - Math.pow(1 - progress, 3);
        x = initPositions[i].x + (targets[i].x - initPositions[i].x) * ease;
        y = initPositions[i].y + (targets[i].y - initPositions[i].y) * ease;
        z = initPositions[i].z + (targets[i].z - initPositions[i].z) * ease;
      } else if (t < 3) {
        // Phase 2: hold with glow pulse
        x = targets[i].x;
        y = targets[i].y;
        z = targets[i].z;
        size = 0.08 + 0.03 * Math.sin((t - 2) * Math.PI * 3);
      } else {
        // Phase 3: explode
        const progress = Math.min(1, (t - 3) / 0.5);
        const dir = targets[i].clone().normalize();
        const explodeSpeed = 15 * progress;
        x = targets[i].x + dir.x * explodeSpeed;
        y = targets[i].y + dir.y * explodeSpeed;
        z = targets[i].z + dir.z * explodeSpeed;
        size = 0.08 * (1 - progress);
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = size;
    }

    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
    }

    if (t >= duration && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0.9}
        size={0.08}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function CinematicLoader({ onComplete, duration = 3.5 }: CinematicLoaderProps) {
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReducedMotion(true);
      onComplete();
    }
  }, [onComplete]);

  const handleComplete = useCallback(() => {
    setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 200);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    setVisible(false);
    onComplete();
  }, [onComplete]);

  if (reducedMotion || !visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a0a0a',
        cursor: 'pointer',
      }}
      onClick={handleSkip}
      role="button"
      aria-label="Skip loading animation"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSkip(); }}
    >
      <Canvas camera={{ fov: 50, position: [0, 0, 10] }}>
        <ambientLight intensity={0.3} />
        <LogoParticles onComplete={handleComplete} duration={duration} />
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: 32,
        width: '100%',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
      }}>
        Click to skip
      </div>
    </div>
  );
}
