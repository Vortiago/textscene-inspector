/**
 * A CPUParticles3D's buffer as three draws it: each particle an instance of the mesh, with its
 * transform, its colour and its custom data. The buffer holds Godot's 3×4 rows, whose bottom row
 * the scene shader fills with `(0, 0, 0, 1)` (`scene_forward_clustered.glsl:320`), so a never-born
 * particle's zero transform sits at the emitter's origin.
 */

import * as THREE from 'three';
import { pointsAtPlaces } from '../../../../r3f/meshes/pointsAtPlaces';
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

/** Each particle's `width` floats at `offset`, each repeated `repeats` times in a row. */
export function particleSlices(
  buffer: Float32Array,
  offset: number,
  width: number,
  repeats = 1
): Float32Array {
  const count = particleCount(buffer);
  const out = new Float32Array(count * repeats * width);
  for (let i = 0; i < count; i++) {
    const at = i * PARTICLE_FLOATS + offset;
    for (let r = 0; r < repeats; r++) {
      for (let k = 0; k < width; k++) out[(i * repeats + r) * width + k] = buffer[at + k]!;
    }
  }
  return out;
}

/**
 * `source` with a colour and a custom attribute per instance, for `count` instances. It shares the
 * source's own attributes and index, which `releaseParticleGeometry` leaves to their owner.
 */
export function particleGeometry(source: THREE.BufferGeometry, count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(source.index);
  for (const { start, count: groupCount, materialIndex } of source.groups) {
    geometry.addGroup(start, groupCount, materialIndex);
  }
  geometry.userData = { ...source.userData };
  for (const name of [PARTICLE_COLOR_ATTRIBUTE, PARTICLE_CUSTOM_ATTRIBUTE]) {
    geometry.setAttribute(
      name,
      new THREE.InstancedBufferAttribute(new Float32Array(count * VEC4_FLOATS), VEC4_FLOATS)
    );
  }
  return geometry;
}

/**
 * Disposes `geometry` without the attributes it shares with `source`. Three frees each attribute
 * of a disposed geometry (`WebGLGeometries.js:8-37`), and the source's draws would read freed buffers.
 */
export function releaseParticleGeometry(geometry: THREE.BufferGeometry, source: THREE.BufferGeometry): void {
  for (const name of Object.keys(source.attributes)) geometry.deleteAttribute(name);
  geometry.setIndex(null);
  geometry.dispose();
}

/** Scratch for one particle's matrix, overwritten by every write. */
const written = new THREE.Matrix4();

/** Writes `buffer`'s transforms into `mesh`'s instance matrices. */
export function writeParticleMatrices(mesh: THREE.InstancedMesh, buffer: Float32Array): void {
  const count = particleCount(buffer);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, particleMatrix(written, buffer, i));
  mesh.instanceMatrix.needsUpdate = true;
}

/** Writes `buffer`'s colours and custom data into the instance attributes of `geometry`. */
export function writeParticleData(geometry: THREE.BufferGeometry, buffer: Float32Array): void {
  writeSlices(geometry.getAttribute(PARTICLE_COLOR_ATTRIBUTE), buffer, PARTICLE_COLOR_OFFSET);
  writeSlices(geometry.getAttribute(PARTICLE_CUSTOM_ATTRIBUTE), buffer, PARTICLE_CUSTOM_OFFSET);
}

function writeSlices(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  buffer: Float32Array,
  offset: number
): void {
  (attribute.array as Float32Array).set(particleSlices(buffer, offset, VEC4_FLOATS));
  (attribute as THREE.BufferAttribute).needsUpdate = true;
}

/**
 * `source`'s points once for each particle, placed by its transform, each vertex carrying its
 * particle's colour and custom data. three has no instanced form of `THREE.Points`.
 */
export function particlePoints(source: THREE.BufferGeometry, buffer: Float32Array): THREE.BufferGeometry {
  const count = particleCount(buffer);
  const matrices = Array.from({ length: count }, (_, i) => particleMatrix(new THREE.Matrix4(), buffer, i));
  const points = pointsAtPlaces(source, matrices);
  const vertices = source.getAttribute('position').count;
  points.setAttribute(
    PARTICLE_COLOR_ATTRIBUTE,
    new THREE.BufferAttribute(
      particleSlices(buffer, PARTICLE_COLOR_OFFSET, VEC4_FLOATS, vertices),
      VEC4_FLOATS
    )
  );
  points.setAttribute(
    PARTICLE_CUSTOM_ATTRIBUTE,
    new THREE.BufferAttribute(
      particleSlices(buffer, PARTICLE_CUSTOM_OFFSET, VEC4_FLOATS, vertices),
      VEC4_FLOATS
    )
  );
  return points;
}
