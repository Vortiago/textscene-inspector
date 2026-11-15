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
  const positions = new Float32Array(particles * vertexCount * 3);
  const normals = skin.normals ? new Float32Array(particles * vertexCount * 3) : null;
  const colours = new Float32Array(particles * vertexCount * 4);
  for (let particle = 0; particle < particles; particle++) {
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      skinVertex(skin, vertex, copies, particle * sections, particle * vertexCount + vertex, {
        positions,
        normals,
        colours,
      });
    }
  }

  const merged = new THREE.BufferGeometry();
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

/** What the skin writes: three arrays of `vertexCount * particles` entries. */
interface Skinned {
  positions: Float32Array;
  normals: Float32Array | null;
  colours: Float32Array;
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

/**
 * One vertex of one particle, written at `out`: `Σ weight * (M * position)`, `normalize(Σ weight *
 * (mat3(M) * normal))` and the vertex colour times `Σ weight * colour[bone]`, over the bone slots
 * that count.
 */
function skinVertex(
  skin: Skin,
  vertex: number,
  copies: Float32Array,
  firstRow: number,
  out: number,
  skinned: Skinned
): void {
  const { positions, normals, colours } = skinned;
  const x = skin.positions.getX(vertex);
  const y = skin.positions.getY(vertex);
  const z = skin.positions.getZ(vertex);
  const nx = skin.normals ? skin.normals.getX(vertex) : 0;
  const ny = skin.normals ? skin.normals.getY(vertex) : 0;
  const nz = skin.normals ? skin.normals.getZ(vertex) : 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  let qx = 0;
  let qy = 0;
  let qz = 0;
  for (let slot = 0; slot < 4; slot++) {
    const weight = skin.weights.getComponent(vertex, slot);
    if (slot > 0 && weight <= MIN_BONE_WEIGHT) continue;
    const at = (firstRow + skin.indices.getComponent(vertex, slot)) * PARTICLE_FLOATS;
    px += weight * (copies[at]! * x + copies[at + 1]! * y + copies[at + 2]! * z + copies[at + 3]!);
    py += weight * (copies[at + 4]! * x + copies[at + 5]! * y + copies[at + 6]! * z + copies[at + 7]!);
    pz += weight * (copies[at + 8]! * x + copies[at + 9]! * y + copies[at + 10]! * z + copies[at + 11]!);
    qx += weight * (copies[at]! * nx + copies[at + 1]! * ny + copies[at + 2]! * nz);
    qy += weight * (copies[at + 4]! * nx + copies[at + 5]! * ny + copies[at + 6]! * nz);
    qz += weight * (copies[at + 8]! * nx + copies[at + 9]! * ny + copies[at + 10]! * nz);
    for (let channel = 0; channel < 4; channel++) {
      colours[out * 4 + channel]! += weight * copies[at + PARTICLE_COLOR_OFFSET + channel]!;
    }
  }
  positions[out * 3] = px;
  positions[out * 3 + 1] = py;
  positions[out * 3 + 2] = pz;
  if (normals) {
    const length = Math.hypot(qx, qy, qz) || 1;
    normals[out * 3] = qx / length;
    normals[out * 3 + 1] = qy / length;
    normals[out * 3 + 2] = qz / length;
  }
  for (let channel = 0; channel < 4; channel++) {
    const own =
      skin.colours && channel < skin.colours.itemSize ? skin.colours.getComponent(vertex, channel) : 1;
    colours[out * 4 + channel]! *= own;
  }
}

function repeated(attribute: THREE.BufferAttribute, times: number): THREE.BufferAttribute {
  const array = new (attribute.array.constructor as new (length: number) => THREE.TypedArray)(
    attribute.array.length * times
  );
  for (let time = 0; time < times; time++) array.set(attribute.array, time * attribute.array.length);
  return new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized);
}

/** The index of `times` copies, a typed array wide enough for every merged vertex. */
function repeatedIndex(
  index: THREE.BufferAttribute | null,
  vertexCount: number,
  times: number
): THREE.BufferAttribute {
  const length = index ? index.count : vertexCount;
  const merged = new (times * vertexCount > 65535 ? Uint32Array : Uint16Array)(times * length);
  for (let time = 0; time < times; time++) {
    for (let i = 0; i < length; i++) {
      merged[time * length + i] = (index ? index.getX(i) : i) + time * vertexCount;
    }
  }
  return new THREE.BufferAttribute(merged, 1);
}
