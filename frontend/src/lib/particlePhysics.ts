import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  targetPosition?: THREE.Vector3;
  phase: 'burst' | 'coalesce' | 'dissolve' | 'sparkle';
}

export interface ParticleConfig {
  maxParticles: number;
  gravity: THREE.Vector3;
  damping: number;
  fadeSpeed: number;
}

export const DEFAULT_CONFIG: ParticleConfig = {
  maxParticles: 10000,
  gravity: new THREE.Vector3(0, -0.5, 0),
  damping: 0.98,
  fadeSpeed: 1.0,
};

export function updateParticles(particles: Particle[], deltaTime: number, config: ParticleConfig): Particle[] {
  const surviving: Particle[] = [];

  for (const p of particles) {
    switch (p.phase) {
      case 'burst':
        p.velocity.add(config.gravity.clone().multiplyScalar(deltaTime));
        p.velocity.multiplyScalar(config.damping);
        break;
      case 'coalesce':
        if (p.targetPosition) {
          const toTarget = p.targetPosition.clone().sub(p.position);
          p.velocity.add(toTarget.multiplyScalar(3.0 * deltaTime));
          p.velocity.multiplyScalar(0.95);
        }
        break;
      case 'dissolve':
        p.velocity.y += Math.abs(config.gravity.y) * 0.5 * deltaTime;
        p.velocity.x += (Math.random() - 0.5) * 0.3 * deltaTime;
        p.velocity.multiplyScalar(config.damping);
        break;
      case 'sparkle':
        p.size = 0.03 + 0.02 * Math.sin(p.life * 20);
        p.velocity.multiplyScalar(0.99);
        break;
    }

    p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
    p.life -= config.fadeSpeed * deltaTime;

    if (p.life > 0) surviving.push(p);
  }

  return surviving;
}

export function spawnExplosion(origin: THREE.Vector3, count: number, speed: number = 5, color: THREE.Color): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const v = speed * (0.5 + Math.random() * 0.5);
    particles.push({
      position: origin.clone(),
      velocity: new THREE.Vector3(
        v * Math.sin(phi) * Math.cos(theta),
        v * Math.sin(phi) * Math.sin(theta),
        v * Math.cos(phi)
      ),
      color: color.clone(),
      size: 0.03 + Math.random() * 0.04,
      life: 1.0 + Math.random() * 0.5,
      maxLife: 1.5,
      phase: 'burst',
    });
  }
  return particles;
}

export function spawnDissolution(origin: THREE.Vector3, count: number, color: THREE.Color): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      position: origin.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 0.5
      )),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 0.3
      ),
      color: color.clone(),
      size: 0.02 + Math.random() * 0.03,
      life: 1.0 + Math.random() * 0.5,
      maxLife: 1.5,
      phase: 'dissolve',
    });
  }
  return particles;
}

export function spawnSparkle(origin: THREE.Vector3, count: number, color: THREE.Color): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      position: origin.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.2
      )),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        0
      ),
      color: color.clone(),
      size: 0.02 + Math.random() * 0.02,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      phase: 'sparkle',
    });
  }
  return particles;
}
