/**
 * The material a CSG face carries, as one string the evaluation cache can key on. Godot's CSG brush
 * interns its faces' materials (`csg.cpp:52-91`) and the root draws one surface per distinct one,
 * so two faces with equal addresses share a surface.
 */

import { fileMaterialSource, resolveMaterialSource, type MaterialSource } from '../materials/materialSource';
import type { SceneResources } from '../SceneResourcesContext';

/**
 * A reference in the scene's tables, or the `res://` path of a material a mesh `.tres` holds, as
 * `resolveRefToResourcePath` writes it. Undefined is a face with no material.
 */
export type CsgMaterialAddress = string | undefined;

const RES_PATH = 'res://';

/** The source an address names, resolving a reference against the scene's `pools`. */
export function resolveCsgMaterial(
  address: CsgMaterialAddress,
  pools: SceneResources
): MaterialSource | undefined {
  if (address?.startsWith(RES_PATH)) return fileMaterialSource(address);
  return resolveMaterialSource(address, pools);
}
