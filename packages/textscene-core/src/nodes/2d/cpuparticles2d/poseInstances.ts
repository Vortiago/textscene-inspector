/**
 * A frozen CPUParticles2D pose as the MultiMesh Godot draws it: one quad for the texture, and one
 * instance for each particle. `canvasInstancesGeometry` merges the two into the drawn geometry.
 */

import * as THREE from 'three';
import type { MultiMeshInstance } from '../../../resources/meshes/multimesh';
import type { RenderedParticle } from './simulate';

/** Each particle as the instance `_update_internal` writes (`cpu_particles_2d.cpp:1212-1220`). */
export function poseInstances(pose: readonly RenderedParticle[]): MultiMeshInstance[] {
  return pose.map(({ transform: { a, b, c, d, tx, ty }, color, custom, active }) => ({
    transform: active ? new Float32Array([a, c, 0, tx, b, d, 0, ty]) : new Float32Array(8),
    color: new Float32Array([color.r, color.g, color.b, color.a]),
    customData: new Float32Array(custom),
  }));
}

/**
 * The quad of `_update_mesh_texture` for a texture of `width` by `height`, centred on the origin
 * (`cpu_particles_2d.cpp:184-229`), as three loads a Godot mesh: Godot's positions, and V up. Its
 * vertex colours are white, so the geometry carries none.
 */
export function particleQuad(width: number, height: number): THREE.BufferGeometry {
  const x = width / 2;
  const y = height / 2;
  const quad = new THREE.BufferGeometry();
  quad.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0], 3)
  );
  quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  quad.setIndex([0, 1, 2, 2, 3, 0]);
  return quad;
}
