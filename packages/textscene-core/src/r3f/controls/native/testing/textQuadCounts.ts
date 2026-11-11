/** The glyph quad count of each text mesh in a rendered scene, in draw order: one entry per drawn label line. */
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';

export function textQuadCounts(scene: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined)
    .map((m) => m.geometry.attributes.position!.count / 4);
}
