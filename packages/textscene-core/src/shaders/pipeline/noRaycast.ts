/** The raycast of a draw that picking skips. */

import type * as THREE from 'three';

/**
 * Opts a draw out of picking: three calls `raycast` and collects nothing. The base draw is the
 * node's pickable body, and a coincident second hit would report the same node twice.
 *
 * @canonical A draw that picking skips
 */
export const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};
