/**
 * A CPUParticles3D's buffer as three draws it: each particle an instance of the mesh, with its
 * transform, its colour and its custom data. The buffer holds Godot's 3×4 rows, whose bottom row
 * the scene shader fills with `(0, 0, 0, 1)` (`scene_forward_clustered.glsl:320`), so a never-born
 * particle's zero transform sits at the emitter's origin.
 */

import * as THREE from 'three';
import { MATRIX_FLOATS, VEC4_FLOATS } from '../../../resources/meshes/multimesh/types';
import { colouredInstances } from '../../../r3f/surfacedMeshDrawer/colouredInstances';
import type { MeshInstances } from '../../../r3f/surfacedMeshDrawer/meshInstances';
import { PARTICLE_COLOR_OFFSET, PARTICLE_CUSTOM_OFFSET, PARTICLE_FLOATS } from './particleBuffer';

/** The particle count of `buffer`. */
function particleCount(buffer: Float32Array): number {
  return buffer.length / PARTICLE_FLOATS;
}

/** `buffer` as the instances the surfaced mesh drawer draws a mesh at. */
export function particleInstances(buffer: Float32Array): MeshInstances {
  return colouredInstances(particleCount(buffer), () => ({
    matrices: particleMatrices(buffer),
    colours: particleSlices(buffer, PARTICLE_COLOR_OFFSET, VEC4_FLOATS),
    customs: particleSlices(buffer, PARTICLE_CUSTOM_OFFSET, VEC4_FLOATS),
  }));
}

/** Scratch for one particle's matrix, overwritten by every write. */
const written = new THREE.Matrix4();

/** Every particle's transform as a matrix. */
function particleMatrices(buffer: Float32Array): Float32Array {
  const matrices = new Float32Array(particleCount(buffer) * MATRIX_FLOATS);
  for (let i = 0; i < particleCount(buffer); i++) {
    particleMatrix(written, buffer, i).toArray(matrices, i * MATRIX_FLOATS);
  }
  return matrices;
}

/** Particle `i`'s transform as a matrix, written into `target`. */
function particleMatrix(target: THREE.Matrix4, buffer: Float32Array, i: number): THREE.Matrix4 {
  const at = i * PARTICLE_FLOATS;
  return target.set(
    buffer[at]!,
    buffer[at + 1]!,
    buffer[at + 2]!,
    buffer[at + 3]!,
    buffer[at + 4]!,
    buffer[at + 5]!,
    buffer[at + 6]!,
    buffer[at + 7]!,
    buffer[at + 8]!,
    buffer[at + 9]!,
    buffer[at + 10]!,
    buffer[at + 11]!,
    0,
    0,
    0,
    1
  );
}

/** Each particle's `width` floats at `offset`. */
export function particleSlices(buffer: Float32Array, offset: number, width: number): Float32Array {
  const count = particleCount(buffer);
  const slices = new Float32Array(count * width);
  for (let i = 0; i < count; i++) {
    slices.set(
      buffer.subarray(i * PARTICLE_FLOATS + offset, i * PARTICLE_FLOATS + offset + width),
      i * width
    );
  }
  return slices;
}
