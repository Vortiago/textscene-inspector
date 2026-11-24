import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import { stringToInt } from '../../godot/string/string.js';
import { strToVar } from '../../godot/variant/strToVar.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { TscnInternalResource } from '../../parser/types.js';
import type { GetOutcome } from '../propertyAccess.js';
import type { ListedReads } from './listedProperties.js';

const PREFIX = 'surface_material_override/';

/** The surface a name addresses: `get_slicec('/', 1).to_int()`, so `…/0/x` and `…/a` name surface 0. */
function surfaceOf(property: string): number {
  return stringToInt(property.slice(PREFIX.length).split('/')[0]!);
}

/** `Mesh::get_surface_count`: one for a PrimitiveMesh, the `_surfaces` of an ArrayMesh, else none. */
function surfaceCountOf(mesh: TscnInternalResource | null): number {
  if (!mesh) return 0;
  if (descendsFromClass(mesh.type, 'PrimitiveMesh')) return 1;
  if (mesh.type !== 'ArrayMesh' || mesh.data._surfaces === undefined) return 0;
  const surfaces = strToVar(mesh.data._surfaces);
  return surfaces.type === T.ARRAY ? surfaces.elements.length : 0;
}

function meshOf({ stored, subResource }: ListedReads): TscnInternalResource | null {
  const mesh: VariantValue = stored('mesh');
  return mesh.type === T.OBJECT && mesh.resource ? subResource(mesh.resource.path) : null;
}

/** `MeshInstance3D::_get` (mesh_instance_3d.cpp:88-98): `set_mesh` sizes the overrides to the surfaces. */
export function meshSurfaceOverrides(property: string, reads: ListedReads): GetOutcome {
  if (!property.startsWith(PREFIX)) return { kind: 'unknown' };
  const surface = surfaceOf(property);
  if (surface < 0 || surface >= surfaceCountOf(meshOf(reads))) return { kind: 'refused' };
  // The last key that names the surface wins, as `_set` applies the keys in file order.
  const key = Object.keys(reads.texts)
    .filter((text) => text.startsWith(PREFIX) && surfaceOf(text) === surface)
    .at(-1);
  return { kind: 'value', value: key ? reads.stored(key) : { type: T.OBJECT } };
}
