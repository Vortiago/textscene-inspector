/**
 * A ReflectionProbe node in the scene graph, which its scene's probes find, capture and draw
 * (`sceneProbes.ts`). It carries its node's world transform, the properties it draws with and its place in the tree.
 */

import * as THREE from 'three';
import type { ReflectionProbeProperties } from '../../nodes/3d/reflectionprobe/types.js';
import type { TreeOrder } from '../contexts/TreeOrderContext.js';

export class ReflectionProbeObject extends THREE.Object3D {
  readonly isReflectionProbe = true;
  /** Set by the probe's component before the scene's probes first read it. */
  probe!: ReflectionProbeProperties;
  /** Set by the probe's component. Godot orders equal boxes by it, and the mount order differs. */
  treeOrder!: TreeOrder;
}

export function isReflectionProbe(object: THREE.Object3D): object is ReflectionProbeObject {
  return (object as ReflectionProbeObject).isReflectionProbe === true;
}
