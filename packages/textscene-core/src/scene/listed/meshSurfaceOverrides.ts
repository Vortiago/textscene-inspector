import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import { stringToInt } from '../../godot/string/string.js';
import { strToVar } from '../../godot/variant/strToVar.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { GetOutcome } from '../propertyAccess.js';
import type { ListedReads, LoadedResource } from './listedProperties.js';

const PREFIX = 'surface_material_override/';

/** The surface a name addresses: `get_slicec('/', 1).to_int()`, so `…/0/x` and `…/a` name surface 0. */
function surfaceOf(property: string): number {
  return stringToInt(property.slice(PREFIX.length).split('/')[0]!);
}

/** `Mesh::get_surface_count`, or null for a mesh only its import or an unloaded scene can count. */
function surfaceCountOf(mesh: VariantValue, loaded: LoadedResource | null): number | null {
  if (mesh.type !== T.OBJECT || !mesh.resource) return 0;
  if (!loaded) return null;
  if (descendsFromClass(loaded.type, 'PrimitiveMesh')) return 1;
  if (loaded.type !== 'ArrayMesh' || loaded.properties._surfaces === undefined) return null;
  const surfaces = strToVar(loaded.properties._surfaces);
  return surfaces.type === T.ARRAY ? surfaces.elements.length : null;
}

async function surfaceCount({ stored, resource }: ListedReads): Promise<number | null> {
  const mesh: VariantValue = stored('mesh');
  return surfaceCountOf(
    mesh,
    mesh.type === T.OBJECT && mesh.resource ? await resource(mesh.resource.path) : null
  );
}

/** `MeshInstance3D::_get` (mesh_instance_3d.cpp:88-98): `set_mesh` sizes the overrides to the surfaces. */
export async function meshSurfaceOverrides(property: string, reads: ListedReads): Promise<GetOutcome> {
  if (!property.startsWith(PREFIX)) return { kind: 'unknown' };
  const surface = surfaceOf(property);
  const count = await surfaceCount(reads);
  if (surface < 0 || (count !== null && surface >= count)) return { kind: 'refused' };
  // The last key that names the surface wins, as `_set` applies the keys in file order.
  const key = Object.keys(reads.texts)
    .filter((text) => text.startsWith(PREFIX) && surfaceOf(text) === surface)
    .at(-1);
  if (key) return { kind: 'value', value: reads.stored(key) };
  // With no count, a surface the file sets no override of may not exist.
  return count === null ? { kind: 'refused' } : { kind: 'value', value: { type: T.OBJECT } };
}
