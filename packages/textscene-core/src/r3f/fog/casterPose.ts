/**
 * The pose of every mesh that casts a shadow: its geometry, its world matrix, its instances, its
 * bones and its morph weights. The fog volume redraws a still view only when this moves, since its
 * shadows read maps the casters draw.
 */

import * as THREE from 'three';
import { visibleInTree } from '../visibleInTree.js';

export class CasterPose {
  /** The values the last update took, `length` of them, then unused space. */
  private values = new Float64Array(64);
  private length = 0;
  /** Where the update in progress writes next. */
  private cursor = 0;
  private hasChanged = false;

  /** Takes the pose of `meshes` that cast, and answers whether it differs from the last one taken. */
  update(meshes: readonly THREE.Mesh[]): boolean {
    this.cursor = 0;
    this.hasChanged = false;
    for (const mesh of meshes) {
      if (!mesh.castShadow || !visibleInTree(mesh)) continue;
      this.take(mesh.id);
      this.take(mesh.geometry.id);
      this.takeAll(mesh.matrixWorld.elements);
      this.takePose(mesh);
    }
    const hasChanged = this.hasChanged || this.cursor !== this.length;
    this.length = this.cursor;
    return hasChanged;
  }

  /** What moves a mesh's surface without moving its world matrix. */
  private takePose(mesh: THREE.Mesh): void {
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const instanced = mesh as THREE.InstancedMesh;
      this.take(instanced.count);
      this.take(instanced.instanceMatrix.version);
    }
    const bones = (mesh as THREE.SkinnedMesh).skeleton?.boneMatrices;
    if (bones) this.takeAll(bones);
    if (mesh.morphTargetInfluences) this.takeAll(mesh.morphTargetInfluences);
  }

  private takeAll(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) this.take(values[i]!);
  }

  private take(value: number): void {
    if (this.cursor === this.values.length) {
      const grown = new Float64Array(this.values.length * 2);
      grown.set(this.values);
      this.values = grown;
    }
    if (this.cursor >= this.length || this.values[this.cursor] !== value) this.hasChanged = true;
    this.values[this.cursor++] = value;
  }
}
