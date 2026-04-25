'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import type { TimeOfDay } from '@/hooks/useTimeOfDay';

const GEOMETRY_TYPES = ['icosahedron', 'octahedron', 'torus', 'torusKnot', 'dodecahedron'] as const;

const PALETTE: Record<TimeOfDay, string[]> = {
  morning:   ['#FFD54F', '#FF9800', '#FFF176', '#FFE082', '#FFCC80'],
  afternoon: ['#64B5F6', '#42A5F5', '#90CAF9', '#4FC3F7', '#81D4FA'],
  evening:   ['#CE93D8', '#F48FB1', '#FFAB91', '#BA68C8', '#EF5350'],
  night:     ['#5C6BC0', '#7986CB', '#3F51B5', '#9FA8DA', '#7C4DFF'],
};

interface FloatingGeometriesProps {
  count?: number;
  spread?: number;
  timeOfDay: TimeOfDay;
}

interface GeoData {
  id: string;
  type: typeof GEOMETRY_TYPES[number];
  position: [number, number, number];
  scale: number;
  color: string;
  speed: number;
  floatIntensity: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function FloatingGeometries({ count = 15, spread = 30, timeOfDay }: FloatingGeometriesProps) {
  const geometries = useMemo(() => {
    const rand = seededRandom(42);
    const geos: GeoData[] = [];
    const colors = PALETTE[timeOfDay] || PALETTE.night;
    for (let i = 0; i < count; i++) {
      geos.push({
        id: `geo-${i}`,
        type: GEOMETRY_TYPES[i % GEOMETRY_TYPES.length],
        position: [
          (rand() - 0.5) * spread,
          (rand() - 0.5) * spread,
          (rand() - 0.5) * spread * 0.5 - 10,
        ],
        scale: 0.3 + rand() * 0.8,
        color: colors[i % colors.length],
        speed: 0.1 + rand() * 0.4,
        floatIntensity: 0.5 + rand() * 1.5,
      });
    }
    return geos;
  }, [count, spread, timeOfDay]);

  return (
    <group>
      {geometries.map((geo) => (
        <Float key={geo.id} speed={geo.speed * 2} floatIntensity={geo.floatIntensity} rotationIntensity={geo.speed}>
          <GeometryMesh geo={geo} />
        </Float>
      ))}
    </group>
  );
}

function GeometryMesh({ geo }: { geo: GeoData }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * geo.speed * 0.5;
      meshRef.current.rotation.y += delta * geo.speed * 0.3;
    }
  });

  const geometry = useMemo(() => {
    switch (geo.type) {
      case 'icosahedron': return <icosahedronGeometry args={[1, 0]} />;
      case 'octahedron': return <octahedronGeometry args={[1, 0]} />;
      case 'torus': return <torusGeometry args={[1, 0.3, 8, 16]} />;
      case 'torusKnot': return <torusKnotGeometry args={[0.8, 0.25, 64, 8]} />;
      case 'dodecahedron': return <dodecahedronGeometry args={[1, 0]} />;
    }
  }, [geo.type]);

  return (
    <mesh ref={meshRef} position={geo.position} scale={geo.scale}>
      {geometry}
      <meshStandardMaterial
        color={geo.color}
        emissive={geo.color}
        emissiveIntensity={0.3}
        wireframe
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
