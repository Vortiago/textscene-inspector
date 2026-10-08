/**
 * The material a CSG face carries, as one string the evaluation cache can key on. Godot's CSG brush
 * interns its faces' materials (`csg.cpp:52-91`) and the root draws one surface per distinct one,
 * so two faces with equal addresses share a surface.
 */

/**
 * A reference in the scene's tables, or the `res://` path of a material a mesh `.tres` holds, as
 * `resolveRefToResourcePath` writes it, which `resolveMaterialSource` reads either way. Undefined is a
 * face with no material.
 */
export type CsgMaterialAddress = string | undefined;

/** The index of `address` in `materials`, appending it when new: one slot per distinct material. */
export function internMaterial(materials: CsgMaterialAddress[], address: CsgMaterialAddress): number {
  const existing = materials.indexOf(address);
  if (existing !== -1) return existing;
  materials.push(address);
  return materials.length - 1;
}
