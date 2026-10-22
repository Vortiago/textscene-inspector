/**
 * A PrimitiveMesh sub-resource's one surface in Godot's arrays: the slice a `type=` names builds
 * it, then this applies what `PrimitiveMesh::_update` applies to every type. This folder holds that
 * shared PrimitiveMesh base, not a registered Resource slice. MeshInstance3D and CSGMesh3D both
 * read the surface.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { vec2iOr } from '../../../parser/valueParsers';
import { storedReal } from '../../../godot/math/real';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { resourceContentKey } from '../../resourceContentKey';
import type { ScopedResource } from '../../useSubOrExtResource';
import type { GodotSurface } from '../godotSurface';
import { decodePrimitiveMesh } from './decode';
import { flipFaces } from './flipFaces';
import { withFallbackUv2 } from './fallbackUv2';
import { decodeBoxMesh } from '../boxmesh/decode';
import { buildBoxMeshSurface } from '../boxmesh/build';
import { decodeSphereMesh } from '../spheremesh/decode';
import { buildSphereMeshSurface } from '../spheremesh/build';
import type { Vector2 } from '../../../godot/math/vector';
import { decodePlaneMesh } from '../planemesh/decode';
import { buildPlaneMeshSurface } from '../planemesh/build';
import { planeMeshLightmapSizeHint } from '../planemesh/lightmapSizeHint';
import { decodeQuadMesh, QUAD_MESH_DEFAULTS } from '../quadmesh/decode';
import { decodeCylinderMesh } from '../cylindermesh/decode';
import { buildCylinderMeshSurface } from '../cylindermesh/build';
import { decodeCapsuleMesh } from '../capsulemesh/decode';
import { buildCapsuleMeshSurface } from '../capsulemesh/build';
import { decodeTorusMesh } from '../torusmesh/decode';
import { buildTorusMeshSurface } from '../torusmesh/build';
import { decodePrismMesh } from '../prismmesh/decode';
import { buildPrismMeshSurface } from '../prismmesh/build';
import { buildPointMeshSurface } from '../pointmesh/build';
import { CURVE_PROPERTY, decodeTubeTrailMesh } from '../tubetrailmesh/decode';
import { buildTubeTrailMeshSurface } from '../tubetrailmesh/build';

/**
 * A slice's surface in Godot's arrays, or null for a mesh Godot builds no surface for.
 * `uv2Padding` is in world units, or null for a mesh with no UV2. `internalResources` is the table
 * a sub-resource the mesh names resolves in.
 */
type SurfaceBuilder = (
  data: Record<string, string>,
  uv2Padding: number | null,
  internalResources: readonly TscnInternalResource[]
) => GodotSurface | null;

/**
 * Godot `type=` → the slice that decodes and builds it. QuadMesh has no `build.ts` of its own: it
 * is a PlaneMesh subclass differing only in defaults, so it decodes with its own defaults and
 * builds through PlaneMesh's surface.
 */
const BUILDERS: Record<string, SurfaceBuilder> = {
  BoxMesh: (data, uv2Padding) => buildBoxMeshSurface(decodeBoxMesh(data), uv2Padding),
  SphereMesh: (data, uv2Padding) => buildSphereMeshSurface(decodeSphereMesh(data), uv2Padding),
  PlaneMesh: (data) => buildPlaneMeshSurface(decodePlaneMesh(data)),
  QuadMesh: (data) => buildPlaneMeshSurface(decodeQuadMesh(data)),
  CylinderMesh: (data, uv2Padding) => buildCylinderMeshSurface(decodeCylinderMesh(data), uv2Padding),
  CapsuleMesh: (data, uv2Padding) => buildCapsuleMeshSurface(decodeCapsuleMesh(data), uv2Padding),
  TorusMesh: (data, uv2Padding) => buildTorusMeshSurface(decodeTorusMesh(data), uv2Padding),
  PrismMesh: (data, uv2Padding) => buildPrismMeshSurface(decodePrismMesh(data), uv2Padding),
  PointMesh: buildPointMeshSurface,
  TubeTrailMesh: (data, _uv2Padding, internalResources) =>
    buildTubeTrailMeshSurface(decodeTubeTrailMesh(data, internalResources)),
};

/**
 * The properties of each type that name a sub-resource its builder reads. A mesh's own content
 * leaves that sub-resource out, so a key over the mesh follows these too.
 */
const SUB_RESOURCE_PROPERTIES: ReadonlyMap<string, readonly string[]> = new Map([
  ['TubeTrailMesh', [CURVE_PROPERTY]],
]);

/** A type's `lightmap_size_hint` once Godot's loader has set its properties in file order. */
type LightmapSizeHint = (data: Record<string, string>, texelSize: number) => Vector2;

/**
 * The lightmap size hint of each type whose builder writes no UV2. `PrimitiveMesh::_update` scales
 * their UV by it instead. PlaneMesh and its QuadMesh subclass derive it as they set their
 * properties (`primitive_meshes.cpp:1416`). A TubeTrailMesh keeps the authored hint, as it
 * overrides no `_update_lightmap_size`.
 */
const FALLBACK_UV2_HINTS: Record<string, LightmapSizeHint> = {
  PlaneMesh: (data, texelSize) => planeMeshLightmapSizeHint(data, texelSize),
  QuadMesh: (data, texelSize) => planeMeshLightmapSizeHint(data, texelSize, QUAD_MESH_DEFAULTS),
  TubeTrailMesh: (data) =>
    vec2iOr(data.lightmap_size_hint, { x: 0, y: 0 }, 'TubeTrailMesh lightmap_size_hint'),
};

/**
 * The `type=` names a slice here builds. A set, not an index into BUILDERS: the name is one a
 * file chooses, and bare indexing hands back `Object` for `constructor`.
 */
const PRIMITIVE_MESH_TYPES: ReadonlySet<string> = new Set(Object.keys(BUILDERS));

/** Whether a slice here builds `type`. */
export function isPrimitiveMeshType(type: string): boolean {
  return PRIMITIVE_MESH_TYPES.has(type);
}

/**
 * Written only by `primitiveMeshSurface`, per texel size and sub-resource content. A resource's
 * entries go when the parsed resource does, so the geometry and the AABB of one mesh share one build.
 */
const builtSurfaces = new WeakMap<TscnInternalResource, Map<string, GodotSurface | null>>();

/**
 * A key over the content of each sub-resource the mesh's builder reads, empty for a type that
 * reads none. A sub-resource the tables do not hold is part of the key as missing.
 */
export function subResourceKey({ resource, resources }: ScopedResource): string {
  const properties = SUB_RESOURCE_PROPERTIES.get(resource.type) ?? [];
  return properties
    .map((property) => {
      const named = resolveSubResourceRef(resource.data[property], resources.internalResources);
      return named ? resourceContentKey(named) : 'missing';
    })
    .join('|');
}

/**
 * The surface `_update` hands the rendering server (`primitive_meshes.cpp:45-123`), in Godot's
 * arrays. `mesh` holds the tables its references resolve in. `texelSize` is the project's
 * PrimitiveMesh texel size, which turns `uv2_padding` into world units (`:403-407`). Null for an
 * unknown, external (GLB) or unresolvable type, or a mesh Godot would refuse to build. The surface
 * is shared, so a caller copies before it writes.
 */
export function primitiveMeshSurface(mesh: ScopedResource, texelSize: number): GodotSurface | null {
  const { resource } = mesh;
  if (!isPrimitiveMeshType(resource.type)) return null;
  let byKey = builtSurfaces.get(resource);
  if (!byKey) builtSurfaces.set(resource, (byKey = new Map()));
  const key = `${texelSize}|${subResourceKey(mesh)}`;
  let surface = byKey.get(key);
  if (surface === undefined) byKey.set(key, (surface = buildSurface(mesh, texelSize)));
  return surface;
}

function buildSurface({ resource, resources }: ScopedResource, texelSize: number): GodotSurface | null {
  const build = BUILDERS[resource.type]!;
  const base = decodePrimitiveMesh(resource.data);
  // Godot holds the padding and the texel size in a `float` (`:1065`), so each rounds to single precision.
  const uv2Padding = base.addUv2 ? storedReal(base.uv2Padding * storedReal(texelSize)) : null;
  const built = build(resource.data, uv2Padding, resources.internalResources);
  if (!built) return null;
  const hint = FALLBACK_UV2_HINTS[resource.type];
  const surface =
    base.addUv2 && hint ? withFallbackUv2(built, base.uv2Padding, hint(resource.data, texelSize)) : built;
  return base.flipFaces ? flipFaces(surface) : surface;
}
