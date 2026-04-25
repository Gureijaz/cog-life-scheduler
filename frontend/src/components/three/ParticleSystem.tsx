'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParticleEvent } from '@/hooks/useParticleController';
import {
  updateParticles,
  spawnExplosion,
  spawnDissolution,
  spawnSparkle,
  DEFAULT_CONFIG,
  type Particle,
} from '@/lib/particlePhysics';

interface ParticleSystemProps {
  events: ParticleEvent[];
  onEventComplete: (eventId: string) => void;
}

const MAX_PARTICLES = 10000;

export default function ParticleSystem({ events, onEventComplete }: ParticleSystemProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<Particle[]>([]);
  const processedEvents = useRef(new Set<string>());

  const { positions, colors, sizes } = useMemo(() => {
    return {
      positions: new Float32Array(MAX_PARTICLES * 3),
      colors: new Float32Array(MAX_PARTICLES * 3),
      sizes: new Float32Array(MAX_PARTICLES),
    };
  }, []);

  // Process new events
  useEffect(() => {
    for (const event of events) {
      if (processedEvents.current.has(event.id)) continue;
      processedEvents.current.add(event.id);

      const origin = new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z);
      const color = new THREE.Color(event.color);

      let newParticles: Particle[] = [];
      switch (event.type) {
        case 'explosion':
          newParticles = spawnExplosion(origin, event.count, 5, color);
          break;
        case 'dissolution':
          newParticles = spawnDissolution(origin, event.count, color);
          break;
        case 'sparkle':
          newParticles = spawnSparkle(origin, event.count, color);
          break;
      }

      particlesRef.current = [
        ...particlesRef.current,
        ...newParticles,
      ].slice(-MAX_PARTICLES);
    }
  }, [events]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    particlesRef.current = updateParticles(particlesRef.current, dt, DEFAULT_CONFIG);

    const pts = particlesRef.current;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < pts.length) {
        const p = pts[i];
        positions[i * 3] = p.position.x;
        positions[i * 3 + 1] = p.position.y;
        positions[i * 3 + 2] = p.position.z;
        colors[i * 3] = p.color.r;
        colors[i * 3 + 1] = p.color.g;
        colors[i * 3 + 2] = p.color.b;
        sizes[i] = p.size * (p.life / p.maxLife);
      } else {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
      }
    }

    if (pointsRef.current) {
      const geom = pointsRef.current.geometry;
      geom.attributes.position.needsUpdate = true;
      geom.attributes.color.needsUpdate = true;
      geom.attributes.size.needsUpdate = true;
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
        opacity={0.8}
        size={0.05}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
