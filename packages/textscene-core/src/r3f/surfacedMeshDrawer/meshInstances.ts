/**
 * A buffer of instances the surfaced mesh drawer draws a mesh at. Each kind of buffer is one
 * `MeshInstances`: matrices alone here, and a particle buffer beside its emitter.
 */

import type * as THREE from 'three';
import type { ParticleProgram } from '../materials/godotParticles';
import {
  instanceMatrices,
  instancesBounds,
  sharedInstances,
  writeInstanceMatrix,
} from '../meshes/sharedInstances';

/** The box and sphere of every instance of a part, which three culls and the framing reads by. */
export type InstancesBounds = ReturnType<typeof instancesBounds>;

export interface MeshInstances {
  /** The drawer builds the geometry and each draw of a part again when this changes. */
  readonly count: number;
  /**
   * `source` for `count` instances, sharing its attributes. One function for each kind of buffer,
   * so a new buffer of the same count keeps its geometry.
   */
  readonly geometryOver: (source: THREE.BufferGeometry, count: number) => THREE.InstancedBufferGeometry;
  /** Writes every instance into a geometry `geometryOver` built, before the paint that draws it. */
  write(geometry: THREE.InstancedBufferGeometry): void;
  /**
   * The bounds of every instance of `source`. Null where the instances move with no rebuild: three
   * then culls none of the draws, the framing reads no box, and the scene cull alone culls them.
   */
  readonly boundsOver: (source: THREE.BufferGeometry) => InstancesBounds | null;
  /** The patch each material takes to read the instance colour and custom data: a particle emitter's and a MultiMesh's draw. Omitted for a plain instance. */
  readonly particles?: ParticleProgram;
}

/**
 * A mesh at each of `matrices`, as Godot draws a MultiMesh of transforms alone.
 *
 * @canonical The instances of a mesh at a list of matrices
 */
export function instancesAt(matrices: readonly THREE.Matrix4[]): MeshInstances {
  return {
    count: matrices.length,
    geometryOver: sharedInstances,
    write(geometry) {
      const attribute = instanceMatrices(geometry);
      matrices.forEach((matrix, place) => writeInstanceMatrix(attribute, place, matrix));
      attribute.needsUpdate = true;
    },
    boundsOver: (source) => instancesBounds(source, matrices),
  };
}
