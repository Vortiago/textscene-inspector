/**
 * A `THREE.BoxHelper` whose box comes from {@link computeWorldBoundingBox}, not
 * `THREE.Box3.setFromObject`, so a skinned GLB node gets its box at the
 * rendered model, not the world origin. `bounds.ts` says why.
 */
import * as THREE from 'three';
import { computeWorldBoundingBox } from '../bounds.js';

const _helperBox = /*@__PURE__*/ new THREE.Box3();

/**
 * Overrides `update()` with {@link computeWorldBoundingBox} and stays
 * `instanceof THREE.BoxHelper`, so the selection and hover lookups and the
 * `useSceneHelper` lifecycle work unchanged.
 */
export class WorldBoxHelper extends THREE.BoxHelper {
  override update(): void {
    if (this.object === undefined) return;
    computeWorldBoundingBox(this.object, _helperBox);
    if (_helperBox.isEmpty()) return;

    const { min, max } = _helperBox;
    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const array = position.array as Float32Array;

    // Same 8-corner winding THREE.BoxHelper writes (see its source).
    array[0] = max.x; array[1] = max.y; array[2] = max.z;
    array[3] = min.x; array[4] = max.y; array[5] = max.z;
    array[6] = min.x; array[7] = min.y; array[8] = max.z;
    array[9] = max.x; array[10] = min.y; array[11] = max.z;
    array[12] = max.x; array[13] = max.y; array[14] = min.z;
    array[15] = min.x; array[16] = max.y; array[17] = min.z;
    array[18] = min.x; array[19] = min.y; array[20] = min.z;
    array[21] = max.x; array[22] = min.y; array[23] = min.z;

    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
