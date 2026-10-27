/**
 * A Decal node in the scene graph, which its scene's decals find and draw (`sceneDecals.ts`). It
 * carries its node's world transform, the properties it draws with, its albedo texture and its
 * place in the tree. Its size scales nothing: the box is a property, not a transform.
 */

import * as THREE from 'three';
import type { TreeOrder } from '../contexts/TreeOrderContext.js';
import type { DecalLook } from './decalRows.js';

export class DecalObject extends THREE.Object3D {
  readonly isDecal = true;
  /** Set by the decal's component before the scene's decals first read it. */
  decal!: DecalLook;
  /** The `texture_albedo` that the decal atlas holds for this decal, null while none loaded. */
  albedo: THREE.Texture | null = null;
  /** Set by the decal's component. Decals at one distance draw in it, and the mount order differs. */
  treeOrder!: TreeOrder;
}

export function isDecal(object: THREE.Object3D): object is DecalObject {
  return (object as DecalObject).isDecal === true;
}
