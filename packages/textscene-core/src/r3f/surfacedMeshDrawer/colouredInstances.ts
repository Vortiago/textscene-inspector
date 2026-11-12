/**
 * Instances that each carry a colour and custom data of their own: the buffer of a particle emitter
 * and of a MultiMesh. The colour multiplies the vertex colour (`scene_forward_clustered.glsl:309,326`)
 * and the custom data is `INSTANCE_CUSTOM`.
 */

import * as THREE from 'three';
import type { InstanceArrays } from '../../resources/meshes/multimesh';
import { PARTICLE_COLOR_ATTRIBUTE } from '../materials/godotParticles';
import { withParticleDraw } from '../materials/godotParticlesProgram';
import { INSTANCE_CUSTOM_ATTRIBUTE, instanceMatrices, sharedInstances } from '../meshes/sharedInstances';
import type { MeshInstances } from './meshInstances';

/** Floats in a colour and in a custom data vector. */
const VEC4_FLOATS = 4;

/**
 * `arrays` as the instances the surfaced mesh drawer draws a mesh at. The program draws billboards
 * that the matrices do not hold, so the instances have no bounds and the scene cull's box culls them.
 */
export function colouredInstances(arrays: InstanceArrays): MeshInstances {
  return {
    count: arrays.count,
    geometryOver: colouredGeometry,
    write: (geometry) => writeArrays(geometry, arrays),
    boundsOver: unbounded,
    particles: withParticleDraw,
  };
}

/** One function for every buffer, so a new buffer leaves the draws of the last one as they are. */
function unbounded(): null {
  return null;
}

/**
 * `source` at `count` instances, each with a colour and custom data of its own. Its instance
 * matrices are an InstancedMesh's too, so one write places both a draw and its overlay.
 */
function colouredGeometry(source: THREE.BufferGeometry, count: number): THREE.InstancedBufferGeometry {
  const geometry = sharedInstances(source, count);
  for (const name of [PARTICLE_COLOR_ATTRIBUTE, INSTANCE_CUSTOM_ATTRIBUTE]) {
    geometry.setAttribute(
      name,
      new THREE.InstancedBufferAttribute(new Float32Array(count * VEC4_FLOATS), VEC4_FLOATS)
    );
  }
  return geometry;
}

function writeArrays(geometry: THREE.BufferGeometry, arrays: InstanceArrays): void {
  const matrices = instanceMatrices(geometry);
  matrices.array.set(arrays.matrices);
  matrices.needsUpdate = true;
  writeAttribute(geometry.getAttribute(PARTICLE_COLOR_ATTRIBUTE), arrays.colours);
  writeAttribute(geometry.getAttribute(INSTANCE_CUSTOM_ATTRIBUTE), arrays.customs);
}

function writeAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  values: Float32Array
): void {
  attribute.array.set(values);
  (attribute as THREE.BufferAttribute).needsUpdate = true;
}
