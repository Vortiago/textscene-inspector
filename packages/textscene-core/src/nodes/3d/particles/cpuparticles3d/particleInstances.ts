/**
 * A CPUParticles3D's buffer as three draws it: each particle an instance of the mesh, with its
 * transform, its colour and its custom data. The buffer holds Godot's 3×4 rows, whose bottom row
 * the scene shader fills with `(0, 0, 0, 1)` (`scene_forward_clustered.glsl:320`), so a never-born
 * particle's zero transform sits at the emitter's origin.
 */

import * as THREE from 'three';
import {
  instanceMatrices,
  sharedInstances,
  writeInstanceMatrix,
} from '../../../../r3f/meshes/sharedInstances';
import {
  PARTICLE_COLOR_ATTRIBUTE,
  PARTICLE_CUSTOM_ATTRIBUTE,
} from '../../../../r3f/materials/godotParticles';
import { PARTICLE_COLOR_OFFSET, PARTICLE_CUSTOM_OFFSET, PARTICLE_FLOATS } from './particleBuffer';

/** Floats in a particle's colour and in its custom data. */
const VEC4_FLOATS = 4;

/** The particle count of `buffer`. */
export function particleCount(buffer: Float32Array): number {
  return buffer.length / PARTICLE_FLOATS;
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
  const out = new Float32Array(count * width);
  writeSlicesInto(out, buffer, offset, width);
  return out;
}

function writeSlicesInto(
  target: THREE.TypedArray,
  buffer: Float32Array,
  offset: number,
  width: number
): void {
  const count = particleCount(buffer);
  for (let i = 0; i < count; i++) {
    const at = i * PARTICLE_FLOATS + offset;
    for (let k = 0; k < width; k++) target[i * width + k] = buffer[at + k]!;
  }
}

/**
 * `source` at `count` particles, each with a colour and custom data of its own. Its instance
 * matrices are an InstancedMesh's too, so one write places both a draw and its overlay.
 */
export function particleGeometry(source: THREE.BufferGeometry, count: number): THREE.InstancedBufferGeometry {
  const geometry = sharedInstances(source, count);
  for (const name of [PARTICLE_COLOR_ATTRIBUTE, PARTICLE_CUSTOM_ATTRIBUTE]) {
    geometry.setAttribute(
      name,
      new THREE.InstancedBufferAttribute(new Float32Array(count * VEC4_FLOATS), VEC4_FLOATS)
    );
  }
  return geometry;
}

/** Scratch for one particle's matrix, overwritten by every write. */
const written = new THREE.Matrix4();

/** Writes `buffer`'s transforms, colours and custom data into `geometry`'s instance attributes. */
export function writeParticles(geometry: THREE.BufferGeometry, buffer: Float32Array): void {
  const matrices = instanceMatrices(geometry);
  for (let i = 0; i < particleCount(buffer); i++) {
    writeInstanceMatrix(matrices, i, particleMatrix(written, buffer, i));
  }
  matrices.needsUpdate = true;
  writeSlices(geometry.getAttribute(PARTICLE_COLOR_ATTRIBUTE), buffer, PARTICLE_COLOR_OFFSET);
  writeSlices(geometry.getAttribute(PARTICLE_CUSTOM_ATTRIBUTE), buffer, PARTICLE_CUSTOM_OFFSET);
}

function writeSlices(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  buffer: Float32Array,
  offset: number
): void {
  writeSlicesInto(attribute.array, buffer, offset, VEC4_FLOATS);
  (attribute as THREE.BufferAttribute).needsUpdate = true;
}
