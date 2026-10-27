/**
 * A Decal node in the scene graph, which its scene's decals find and draw (`sceneDecals.ts`). It
 * carries its node's world transform, the properties it draws with, its albedo texture and its
 * place in the tree. Its size scales nothing: the box is a property, not a transform.
 */

import * as THREE from 'three';
import { decalAtlasRect, type DecalAtlasRect } from '../../nodes/3d/decal/decalAtlas.js';
import type { TreeOrder } from '../contexts/TreeOrderContext.js';
import type { DecalLook, DrawnDecal } from './decalRows.js';

export class DecalObject extends THREE.Object3D implements DrawnDecal {
  readonly isDecal = true;
  /** Set by the decal's component before the scene's decals first read it. */
  look!: DecalLook;
  /** The `texture_albedo` that the decal atlas holds for this decal, null while none loaded. */
  albedo: THREE.Texture | null = null;
  /** Set by the decal's component. Decals at one distance draw in it, and the mount order differs. */
  treeOrder!: TreeOrder;

  get albedoRect(): DecalAtlasRect | null {
    return (this.albedo && decalAtlasRect(this.albedo)) ?? null;
  }
}

export function isDecal(object: THREE.Object3D): object is DecalObject {
  return (object as DecalObject).isDecal === true;
}
