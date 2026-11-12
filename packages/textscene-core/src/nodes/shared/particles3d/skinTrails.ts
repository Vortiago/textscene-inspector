/**
 * A trail mesh skinned on the CPU for every particle: the vertex shader of a material with
 * `use_particle_trails` takes each vertex through the copy matrices of the sections it is bound to
 * (`scene_forward_clustered.glsl:268-300`). three has no bone palette for each instance of an
 * InstancedMesh, so the result is one merged geometry, built once for each settle.
 */

import * as THREE from 'three';
import { PARTICLE_COLOR_OFFSET, PARTICLE_FLOATS } from './particleBuffer';

/** A bone slot counts only when its weight is above this; the first always counts (`:276-290`). */
const MIN_BONE_WEIGHT = 0.001;

/** The attributes the skin rewrites. The rest copy to every particle as they are. */
const SKINNED = new Set(['position', 'normal', 'skinIndex', 'skinWeight', 'color']);

/**
 * `source` once for each particle of `copies`, each vertex skinned by the section rows of its
 * particle. `copies` holds `sections` rows for each particle in the layout of the particle buffer,
 * the bind pose already multiplied in. The vertex colour is multiplied by the weighted colour of the
 * sections, and is always written, white where the mesh has none.
 */
export function skinTrailGeometry(
  source: THREE.BufferGeometry,
  copies: Float32Array,
  sections: number
): THREE.BufferGeometry {
  const particles = copies.length / (sections * PARTICLE_FLOATS);
  const skin = skinOf(source);
  const vertexCount = skin.positions.count;
  const merged = new THREE.BufferGeometry();

  const positions = new Float32Array(particles * vertexCount * 3);
  const normals = skin.normals ? new Float32Array(particles * vertexCount * 3) : null;
  const colours = new Float32Array(particles * vertexCount * 4);
  const point = new THREE.Vector3();
  for (let particle = 0; particle < particles; particle++) {
    const firstRow = particle * sections;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const out = particle * vertexCount + vertex;
      skinVertex(skin, vertex, copies, firstRow, point);
      positions.set([point.x, point.y, point.z], out * 3);
      if (normals) {
        skinNormal(skin, vertex, copies, firstRow, point);
        normals.set([point.x, point.y, point.z], out * 3);
      }
      skinColour(skin, vertex, copies, firstRow, colours, out * 4);
    }
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normals) merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colours, 4));
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!SKINNED.has(name))
      merged.setAttribute(name, repeated(attribute as THREE.BufferAttribute, particles));
  }
  merged.setIndex(repeatedIndex(source.getIndex(), vertexCount, particles));
  return merged;
}

interface Skin {
  positions: THREE.BufferAttribute;
  normals: THREE.BufferAttribute | null;
  colours: THREE.BufferAttribute | null;
  indices: THREE.BufferAttribute;
  weights: THREE.BufferAttribute;
}

function skinOf(source: THREE.BufferGeometry): Skin {
  const indices = source.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const weights = source.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  if (!indices || !weights) throw new Error('expected a surface with skinIndex and skinWeight, got none');
  return {
    positions: source.getAttribute('position') as THREE.BufferAttribute,
    normals: (source.getAttribute('normal') as THREE.BufferAttribute | undefined) ?? null,
    colours: (source.getAttribute('color') as THREE.BufferAttribute | undefined) ?? null,
    indices,
    weights,
  };
}

/** The slots that count for a vertex: their section row and their weight. */
function forEachBone(
  skin: Skin,
  vertex: number,
  firstRow: number,
  visit: (row: number, weight: number) => void
): void {
  for (let slot = 0; slot < 4; slot++) {
    const weight = skin.weights.getComponent(vertex, slot);
    if (slot > 0 && weight <= MIN_BONE_WEIGHT) continue;
    visit(firstRow + skin.indices.getComponent(vertex, slot), weight);
  }
}

/** `Σ weight * (M * position)` over the bones of the vertex. */
function skinVertex(
  skin: Skin,
  vertex: number,
  copies: Float32Array,
  firstRow: number,
  into: THREE.Vector3
): void {
  const x = skin.positions.getX(vertex);
  const y = skin.positions.getY(vertex);
  const z = skin.positions.getZ(vertex);
  into.set(0, 0, 0);
  forEachBone(skin, vertex, firstRow, (row, weight) => {
    const at = row * PARTICLE_FLOATS;
    into.x += weight * (copies[at]! * x + copies[at + 1]! * y + copies[at + 2]! * z + copies[at + 3]!);
    into.y += weight * (copies[at + 4]! * x + copies[at + 5]! * y + copies[at + 6]! * z + copies[at + 7]!);
    into.z += weight * (copies[at + 8]! * x + copies[at + 9]! * y + copies[at + 10]! * z + copies[at + 11]!);
  });
}

/** `normalize(Σ weight * (mat3(M) * normal))`. */
function skinNormal(
  skin: Skin,
  vertex: number,
  copies: Float32Array,
  firstRow: number,
  into: THREE.Vector3
): void {
  const x = skin.normals!.getX(vertex);
  const y = skin.normals!.getY(vertex);
  const z = skin.normals!.getZ(vertex);
  into.set(0, 0, 0);
  forEachBone(skin, vertex, firstRow, (row, weight) => {
    const at = row * PARTICLE_FLOATS;
    into.x += weight * (copies[at]! * x + copies[at + 1]! * y + copies[at + 2]! * z);
    into.y += weight * (copies[at + 4]! * x + copies[at + 5]! * y + copies[at + 6]! * z);
    into.z += weight * (copies[at + 8]! * x + copies[at + 9]! * y + copies[at + 10]! * z);
  });
  into.normalize();
}

/** The vertex colour times `Σ weight * colour[bone]`. */
function skinColour(
  skin: Skin,
  vertex: number,
  copies: Float32Array,
  firstRow: number,
  into: Float32Array,
  at: number
): void {
  const trail = [0, 0, 0, 0];
  forEachBone(skin, vertex, firstRow, (row, weight) => {
    for (let channel = 0; channel < 4; channel++) {
      trail[channel]! += weight * copies[row * PARTICLE_FLOATS + PARTICLE_COLOR_OFFSET + channel]!;
    }
  });
  for (let channel = 0; channel < 4; channel++) {
    const own =
      skin.colours && channel < skin.colours.itemSize ? skin.colours.getComponent(vertex, channel) : 1;
    into[at + channel] = own * trail[channel]!;
  }
}

function repeated(attribute: THREE.BufferAttribute, times: number): THREE.BufferAttribute {
  const array = new (attribute.array.constructor as new (length: number) => THREE.TypedArray)(
    attribute.array.length * times
  );
  for (let time = 0; time < times; time++) array.set(attribute.array, time * attribute.array.length);
  return new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized);
}

function repeatedIndex(index: THREE.BufferAttribute | null, vertexCount: number, times: number): number[] {
  const source = index ? Array.from(index.array) : Array.from({ length: vertexCount }, (_, i) => i);
  const merged: number[] = [];
  for (let time = 0; time < times; time++) for (const i of source) merged.push(i + time * vertexCount);
  return merged;
}
