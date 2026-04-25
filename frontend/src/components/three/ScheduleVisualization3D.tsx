'use client';

import { useMemo, useRef, useState, type JSX } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ScheduleBlock, SourceType } from '@/lib/types';

const SOURCE_COLORS: Record<SourceType, { color: string; emissive: string }> = {
  fixed_event:   { color: '#6366f1', emissive: '#4338ca' },
  flexible_task: { color: '#10b981', emissive: '#059669' },
  assignment:    { color: '#f59e0b', emissive: '#d97706' },
  travel_buffer: { color: '#94a3b8', emissive: '#64748b' },
};

const START_HOUR = 6;
const DAY_WIDTH = 2;
const HOUR_HEIGHT = 0.5;
const BAR_DEPTH = 1.2;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

interface ScheduleVisualization3DProps {
  blocksByDate: Map<string, ScheduleBlock[]>;
  dates: string[];
  onBlockSelect: (block: ScheduleBlock) => void;
  active: boolean;
}

interface BarData {
  block: ScheduleBlock;
  dayIndex: number;
  position: [number, number, number];
  height: number;
  color: string;
  emissive: string;
}

function ScheduleBar({ bar, onSelect }: { bar: BarData; onSelect: (b: ScheduleBlock) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <group position={bar.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(bar.block); }}
      >
        <boxGeometry args={[DAY_WIDTH * 0.8, bar.height, BAR_DEPTH]} />
        <meshStandardMaterial
          color={bar.color}
          emissive={bar.emissive}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          transparent
          opacity={0.85}
        />
      </mesh>
      {hovered && (
        <Html center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'sans-serif',
          }}>
            {bar.block.title}<br />
            {bar.block.startTime} – {bar.block.endTime}
          </div>
        </Html>
      )}
    </group>
  );
}

function GridLines({ dates }: { dates: string[] }) {
  const lines = useMemo(() => {
    const geom: JSX.Element[] = [];
    const totalWidth = dates.length * DAY_WIDTH;
    const totalHeight = 18 * HOUR_HEIGHT;

    // Hour lines
    for (let h = 0; h <= 18; h++) {
      const y = -h * HOUR_HEIGHT;
      geom.push(
        <line key={`h-${h}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([-totalWidth / 2, y, 0, totalWidth / 2, y, 0]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#444" transparent opacity={0.3} />
        </line>
      );
    }

    // Day lines
    for (let d = 0; d <= dates.length; d++) {
      const x = (d - dates.length / 2) * DAY_WIDTH;
      geom.push(
        <line key={`d-${d}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([x, 0, 0, x, -totalHeight, 0]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#444" transparent opacity={0.3} />
        </line>
      );
    }

    return geom;
  }, [dates.length]);

  return <group>{lines}</group>;
}

export default function ScheduleVisualization3D({ blocksByDate, dates, onBlockSelect, active }: ScheduleVisualization3DProps) {
  const bars = useMemo(() => {
    const result: BarData[] = [];
    dates.forEach((date, dayIndex) => {
      const blocks = blocksByDate.get(date) ?? [];
      for (const block of blocks) {
        const startMin = timeToMinutes(block.startTime);
        const endMin = timeToMinutes(block.endTime);
        const startOffset = (startMin - START_HOUR * 60) / 60;
        const durationHours = (endMin - startMin) / 60;
        const height = durationHours * HOUR_HEIGHT;
        const colors = SOURCE_COLORS[block.sourceType] ?? SOURCE_COLORS.fixed_event;

        const x = (dayIndex - dates.length / 2 + 0.5) * DAY_WIDTH;
        const y = -(startOffset * HOUR_HEIGHT + height / 2);

        result.push({
          block,
          dayIndex,
          position: [x, y, 0],
          height,
          color: colors.color,
          emissive: colors.emissive,
        });
      }
    });
    return result;
  }, [blocksByDate, dates]);

  if (!active) return null;

  return (
    <div style={{ width: '100%', height: 500, borderRadius: 12, overflow: 'hidden' }}>
      <Canvas camera={{ fov: 50, position: [0, -4, 14] }} style={{ background: 'rgba(0,0,0,0.3)' }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <pointLight position={[-5, 5, 5]} intensity={0.3} color="#6366f1" />

        <OrbitControls enableDamping dampingFactor={0.1} />

        <GridLines dates={dates} />

        {bars.map((bar) => (
          <ScheduleBar key={bar.block.id} bar={bar} onSelect={onBlockSelect} />
        ))}
      </Canvas>
    </div>
  );
}
