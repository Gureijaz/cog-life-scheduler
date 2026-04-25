import * as THREE from 'three';

/**
 * Convert screen pixel coordinates to Three.js world coordinates
 * at a given depth (targetZ in world space).
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: THREE.PerspectiveCamera,
  targetZ: number = 0
): THREE.Vector3 {
  const ndc = new THREE.Vector3(
    (screenX / window.innerWidth) * 2 - 1,
    -(screenY / window.innerHeight) * 2 + 1,
    0.5
  );

  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const distance = (targetZ - camera.position.z) / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(distance));
}
