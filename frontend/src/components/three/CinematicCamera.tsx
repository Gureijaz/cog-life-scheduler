'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CinematicCameraProps {
  targetPosition: [number, number, number];
  targetLookAt: [number, number, number];
  parallaxOffset: { x: number; y: number };
  springConfig?: { stiffness: number; damping: number; mass: number };
}

export default function CinematicCamera({
  targetPosition,
  targetLookAt,
  parallaxOffset,
  springConfig = { stiffness: 40, damping: 15, mass: 1 },
}: CinematicCameraProps) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const currentPos = useRef(new THREE.Vector3(...targetPosition));
  const lookAtTarget = useRef(new THREE.Vector3(...targetLookAt));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // cap delta to avoid instability
    const target = new THREE.Vector3(
      targetPosition[0] + parallaxOffset.x,
      targetPosition[1] + parallaxOffset.y,
      targetPosition[2]
    );

    // Spring physics
    const displacement = currentPos.current.clone().sub(target);
    const springForce = displacement.multiplyScalar(-springConfig.stiffness);
    const dampingForce = velocity.current.clone().multiplyScalar(-springConfig.damping);
    const totalForce = springForce.add(dampingForce);
    const acceleration = totalForce.divideScalar(springConfig.mass);

    velocity.current.add(acceleration.multiplyScalar(dt));
    currentPos.current.add(velocity.current.clone().multiplyScalar(dt));

    // Smoothly interpolate lookAt
    const targetLookAtVec = new THREE.Vector3(...targetLookAt);
    lookAtTarget.current.lerp(targetLookAtVec, dt * 3);

    camera.position.copy(currentPos.current);
    camera.lookAt(lookAtTarget.current);
  });

  return null;
}
