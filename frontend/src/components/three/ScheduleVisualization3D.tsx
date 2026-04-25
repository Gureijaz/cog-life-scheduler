'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ScheduleBlock, SourceType } from '@/lib/types';

const SOURCE_COLORS: Record<SourceType, string> = {
  fixed_event: '#6366f1',
  flexible_task: '#10b981',
  assignment: '#f59e0b',
  travel_buffer: '#94a3b8',
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

interface NodeData {
  block: ScheduleBlock;
  position: THREE.Vector3;
  radius: number;
  color: string;
  brightness: number;
}

interface ConnectionData {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
}

interface ScheduleVisualization3DProps {
  blocksByDate: Map<string, ScheduleBlock[]>;
  dates: string[];
  onBlockSelect: (block: ScheduleBlock) => void;
  active: boolean;
}

/**
 * Distribute blocks as nodes in a brain-like ellipsoidal shape with two hemispheres.
 */
function buildBrainLayout(
  blocksByDate: Map<string, ScheduleBlock[]>,
  dates: string[],
): { nodes: NodeData[]; connections: ConnectionData[] } {
  const allBlocks: { block: ScheduleBlock; dayIndex: number }[] = [];
  dates.forEach((date, dayIndex) => {
    const blocks = blocksByDate.get(date) ?? [];
    for (const block of blocks) {
      allBlocks.push({ block, dayIndex });
    }
  });

  if (allBlocks.length === 0) return { nodes: [], connections: [] };

  const nodes: NodeData[] = [];
  const total = allBlocks.length;

  // Golden angle distribution on an ellipsoid (brain shape)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  allBlocks.forEach(({ block, dayIndex }, i) => {
    const durationMin = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
    const clampedDuration = Math.max(15, Math.min(durationMin, 180));
    const radius = 0.15 + (clampedDuration / 180) * 0.25;

    // Determine hemisphere: first half of week = left, second half = right
    const hemisphere = dayIndex < dates.length / 2 ? -1 : 1;

    // Distribute within hemisphere using golden spiral on ellipsoid
    const t = total > 1 ? i / (total - 1) : 0.5;
    const phi = goldenAngle * i;
    const theta = Math.acos(1 - 2 * t);

    // Brain ellipsoid radii: wider (x), tall (y), deep (z)
    const rx = 3.5;
    const ry = 2.5;
    const rz = 2.8;

    let x = rx * Math.sin(theta) * Math.cos(phi);
    const y = ry * Math.cos(theta);
    let z = rz * Math.sin(theta) * Math.sin(phi);

    // Push toward the correct hemisphere
    x = Math.abs(x) * hemisphere * 0.6 + x * 0.4;

    // Add slight jitter for organic feel
    x += (Math.random() - 0.5) * 0.3;
    z += (Math.random() - 0.5) * 0.3;

    const color = SOURCE_COLORS[block.sourceType] ?? SOURCE_COLORS.fixed_event;

    // Brightness based on time-of-day (morning = brighter)
    const startMin = timeToMinutes(block.startTime);
    const brightness = 0.4 + (1 - startMin / (24 * 60)) * 0.6;

    nodes.push({
      block,
      position: new THREE.Vector3(x, y, z),
      radius,
      color,
      brightness,
    });
  });

  // Build connections: connect blocks that are on the same day or adjacent times
  const connections: ConnectionData[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = nodes[i].position.distanceTo(nodes[j].position);
      const sameDayI = allBlocks[i].dayIndex;
      const sameDayJ = allBlocks[j].dayIndex;
      const sameDay = sameDayI === sameDayJ;
      const adjacentDay = Math.abs(sameDayI - sameDayJ) === 1;

      // Connect same-day blocks or nearby blocks
      if ((sameDay && dist < 5) || (adjacentDay && dist < 3)) {
        const mixedColor = new THREE.Color(nodes[i].color).lerp(
          new THREE.Color(nodes[j].color),
          0.5,
        );
        connections.push({
          from: nodes[i].position,
          to: nodes[j].position,
          color: '#' + mixedColor.getHexString(),
        });
      }
    }
  }

  return { nodes, connections };
}

/* ── Glowing Brain Node ─────────────────────────────────────────── */

function BrainNode({
  node,
  onSelect,
}: {
  node: NodeData;
  onSelect: (b: ScheduleBlock) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Gentle pulse
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 2 + node.position.x * 3) * 0.08;
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(clock.getElapsedTime() * 1.5 + node.position.y * 2) * 0.15;
      glowRef.current.scale.setScalar(glowPulse);
    }
  });

  return (
    <group position={node.position}>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[node.radius * 1.8, 16, 16]} />
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={hovered ? 0.25 : 0.1}
          depthWrite={false}
        />
      </mesh>
      {/* Core sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.block);
        }}
      >
        <sphereGeometry args={[node.radius, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={hovered ? 1.2 : node.brightness * 0.6}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      {/* Tooltip on hover */}
      {hovered && (
        <Html center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.9)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'sans-serif',
              border: `1px solid ${node.color}`,
              boxShadow: `0 0 12px ${node.color}40`,
            }}
          >
            <strong>{node.block.title}</strong>
            <br />
            {node.block.startTime} – {node.block.endTime}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Synapse Connection with flowing energy ─────────────────────── */

function Synapse({ connection }: { connection: ConnectionData }) {
  const lineRef = useRef<THREE.Line>(null);
  const dashOffset = useRef(0);

  const lineObj = useMemo(() => {
    const points = [connection.from, connection.to];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
      color: connection.color,
      transparent: true,
      opacity: 0.35,
      dashSize: 0.3,
      gapSize: 0.15,
    });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    return line;
  }, [connection.from, connection.to, connection.color]);

  useFrame((_, delta) => {
    const mat = lineObj.material as THREE.LineDashedMaterial;
    dashOffset.current -= delta * 2;
    (mat as unknown as { dashOffset: number }).dashOffset = dashOffset.current;
  });

  return <primitive ref={lineRef} object={lineObj} />;
}

/* ── Slowly rotating brain group ────────────────────────────────── */

function RotatingBrain({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

/* ── Main Component ─────────────────────────────────────────────── */

export default function ScheduleVisualization3D({
  blocksByDate,
  dates,
  onBlockSelect,
  active,
}: ScheduleVisualization3DProps) {
  const { nodes, connections } = useMemo(
    () => buildBrainLayout(blocksByDate, dates),
    [blocksByDate, dates],
  );

  if (!active) return null;

  return (
    <div style={{ width: '100%', height: 550, borderRadius: 12, overflow: 'hidden' }}>
      <Canvas
        camera={{ fov: 50, position: [0, 2, 10] }}
        style={{ background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #000 100%)' }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 8, 5]} intensity={0.6} color="#6366f1" />
        <pointLight position={[-5, -3, 5]} intensity={0.4} color="#10b981" />
        <pointLight position={[0, 0, -5]} intensity={0.3} color="#f59e0b" />

        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={4}
          maxDistance={20}
        />

        <RotatingBrain>
          {connections.map((conn, i) => (
            <Synapse key={`syn-${i}`} connection={conn} />
          ))}
          {nodes.map((node) => (
            <BrainNode
              key={node.block.id}
              node={node}
              onSelect={onBlockSelect}
            />
          ))}
        </RotatingBrain>
      </Canvas>
    </div>
  );
}
