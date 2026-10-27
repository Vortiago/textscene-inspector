/**
 * A PrimitiveMesh sub-resource's one surface in Godot's arrays: the slice a `type=` names builds
 * it, then this applies what `PrimitiveMesh::_update` applies to every type. This folder holds that
 * shared PrimitiveMesh base, not a registered Resource slice. MeshInstance3D and CSGMesh3D both
 * read the surface.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { vec2iOr } from '../../../parser/valueParsers';
import { storedReal } from '../../../godot/math/real';
import { perObject } from '../../../utils/perObject';
import type { Vector2 } from '../../../godot/math/vector';
import { resourceContentKey } from '../../resourceContentKey';
import { referencedFilePath, resolveReference, resolveReferencedResource } from '../../resolveReference';
import type { LoadedFont, ResolvableResource, ScopedResource } from '../../scopedResource';
import type { GodotSurface } from '../godotSurface';
import { decodePrimitiveMesh } from './decode';
import { flipFaces } from './flipFaces';
import { withFallbackUv2 } from './fallbackUv2';
import { decodeBoxMesh } from '../boxmesh/decode';
import { buildBoxMeshSurface } from '../boxmesh/build';
import { decodeSphereMesh } from '../spheremesh/decode';
import { buildSphereMeshSurface } from '../spheremesh/build';
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
import { decodeTubeTrailMesh } from '../tubetrailmesh/decode';
import { buildTubeTrailMeshSurface } from '../tubetrailmesh/build';
import { decodeRibbonTrailMesh } from '../ribbontrailmesh/decode';
import { buildRibbonTrailMeshSurface } from '../ribbontrailmesh/build';
import { buildTextMeshSurface } from '../textmesh/build';
import { decodeTextMesh } from '../textmesh/decode';
import {
  textMeshFont,
  textMeshFontFiles,
  textMeshFontKey,
  type TextMeshFont,
} from '../textmesh/textMeshFont';

/** What a type's build reads: its properties, and the resources those properties name. */
interface BuildInput {
  data: Record<string, string>;
  /** In world units, or null for a mesh with no UV2 (`add_uv2` off). */
  uv2Padding: number | null;
  /**
   * The resource each property the type declares in `references` names, or null for none, an unknown
   * id, or a file not loaded.
   */
  references: Readonly<Record<string, TscnInternalResource | null>>;
  /** The font of a type that declares `font`, null for any other. */
  font: TextMeshFont | null;
}

/** A type's `lightmap_size_hint` once Godot's loader has set its properties in file order. */
type LightmapSizeHint = (data: Record<string, string>, texelSize: number) => Vector2;

/** How one PrimitiveMesh type builds, and what its build reads beyond its own properties. */
interface PrimitiveMeshType {
  /** The slice's surface in Godot's arrays, or null for a mesh Godot builds no surface for. */
  build: (input: BuildInput) => GodotSurface | null;
  /** The properties of the type that name a resource its build reads. */
  references?: readonly string[];
  /** The font the build extrudes, which has to load first: the files it names and how far it has loaded. */
  font?: {
    files: (scoped: ScopedResource, loadedFont: LoadedFont) => string[];
    read: (mesh: ResolvableResource) => TextMeshFont;
  };
  /**
   * The lightmap size hint of a type whose builder writes no UV2: `PrimitiveMesh::_update` scales
   * its UV by it instead. PlaneMesh and its QuadMesh subclass derive it as they set their
   * properties (`primitive_meshes.cpp:1416`). A trail mesh keeps the authored hint.
   */
  lightmapSizeHint?: LightmapSizeHint;
}

/** The property of a trail mesh that names the one resource its build reads. */
const CURVE_PROPERTY = 'curve';

/**
 * The lightmap size hint of a type that does not override `_update_lightmap_size`: the authored
 * one, which `set_lightmap_size_hint` stores as it is.
 */
function authoredLightmapSizeHint(type: string): LightmapSizeHint {
  return (data) => vec2iOr(data.lightmap_size_hint, { x: 0, y: 0 }, `${type} lightmap_size_hint`);
}

/**
 * A trail mesh builds from its properties and its Curve, and keeps the authored lightmap size hint,
 * as neither overrides `_update_lightmap_size`.
 */
function curveTrailMeshType(
  type: string,
  build: (data: Record<string, string>, curve: TscnInternalResource | null) => GodotSurface
): PrimitiveMeshType {
  return {
    build: ({ data, references }) => build(data, references[CURVE_PROPERTY] ?? null),
    references: [CURVE_PROPERTY],
    lightmapSizeHint: authoredLightmapSizeHint(type),
  };
}

/**
 * Godot `type=` → the slice that decodes and builds it. QuadMesh has no `build.ts` of its own: it
 * is a PlaneMesh subclass differing only in defaults, so it decodes with its own defaults and
 * builds through PlaneMesh's surface.
 */
const TYPES: Record<string, PrimitiveMeshType> = {
  BoxMesh: { build: ({ data, uv2Padding }) => buildBoxMeshSurface(decodeBoxMesh(data), uv2Padding) },
  SphereMesh: { build: ({ data, uv2Padding }) => buildSphereMeshSurface(decodeSphereMesh(data), uv2Padding) },
  PlaneMesh: {
    build: ({ data }) => buildPlaneMeshSurface(decodePlaneMesh(data)),
    lightmapSizeHint: planeMeshLightmapSizeHint,
  },
  QuadMesh: {
    build: ({ data }) => buildPlaneMeshSurface(decodeQuadMesh(data)),
    lightmapSizeHint: (data, texelSize) => planeMeshLightmapSizeHint(data, texelSize, QUAD_MESH_DEFAULTS),
  },
  CylinderMesh: {
    build: ({ data, uv2Padding }) => buildCylinderMeshSurface(decodeCylinderMesh(data), uv2Padding),
  },
  CapsuleMesh: {
    build: ({ data, uv2Padding }) => buildCapsuleMeshSurface(decodeCapsuleMesh(data), uv2Padding),
  },
  TorusMesh: { build: ({ data, uv2Padding }) => buildTorusMeshSurface(decodeTorusMesh(data), uv2Padding) },
  PrismMesh: { build: ({ data, uv2Padding }) => buildPrismMeshSurface(decodePrismMesh(data), uv2Padding) },
  PointMesh: { build: () => buildPointMeshSurface() },
  TubeTrailMesh: curveTrailMeshType('TubeTrailMesh', (data, curve) =>
    buildTubeTrailMeshSurface(decodeTubeTrailMesh(data, curve))
  ),
  RibbonTrailMesh: curveTrailMeshType('RibbonTrailMesh', (data, curve) =>
    buildRibbonTrailMeshSurface(decodeRibbonTrailMesh(data, curve))
  ),
  // No face to extrude without a font, so the build gives none: `isDrawablePrimitiveMesh` tells that
  // from a mesh that is empty. TextMesh writes no UV2 and keeps the authored lightmap size hint.
  TextMesh: {
    build: ({ data, font }) =>
      font?.status === 'ready' ? buildTextMeshSurface(decodeTextMesh(data), font.face) : null,
    font: { files: textMeshFontFiles, read: textMeshFont },
    lightmapSizeHint: authoredLightmapSizeHint('TextMesh'),
  },
};

/**
 * The `type=` names a slice here builds. A set, not an index into TYPES: the name is one a
 * file chooses, and bare indexing hands back `Object` for `constructor`.
 */
const PRIMITIVE_MESH_TYPES: ReadonlySet<string> = new Set(Object.keys(TYPES));

/** Whether a slice here builds `type`. */
export function isPrimitiveMeshType(type: string): boolean {
  return PRIMITIVE_MESH_TYPES.has(type);
}

/** The properties of `type` that name a resource its build reads. */
function referencesOf(type: string): readonly string[] {
  return TYPES[type]?.references ?? [];
}

/** The files the mesh's ExtResource references load from, which its build reads once they load. */
export function primitiveMeshFiles({ resource, resources }: ScopedResource): string[] {
  return referencesOf(resource.type).flatMap(
    (property) => referencedFilePath(resource.data[property], resources) ?? []
  );
}

/** Whether the build of `type` reads the font of the mesh, which loads on the font bus. */
export function primitiveMeshReadsFont(type: string): boolean {
  return TYPES[type]?.font !== undefined;
}

/** The font files the mesh's `font` names, for a type that reads one. Its build reads them once they load. */
export function primitiveMeshFontFiles(scoped: ScopedResource, loadedFont: LoadedFont): string[] {
  return TYPES[scoped.resource.type]?.font?.files(scoped, loadedFont) ?? [];
}

/** The font the build of `mesh` reads, or null for a type that reads none. */
function primitiveMeshFont(mesh: ResolvableResource): TextMeshFont | null {
  return TYPES[mesh.resource.type]?.font?.read(mesh) ?? null;
}

/** Whether the font of `mesh` has loaded and its metrics are still to settle, so no surface builds yet. */
export function isAwaitingFontMetrics(mesh: ResolvableResource): boolean {
  return primitiveMeshFont(mesh)?.status === 'awaitingMetrics';
}

/**
 * Whether this previewer can build `mesh`. A type with no slice here cannot, and neither can a
 * mesh whose font has no outlines the previewer reads: Godot draws both. A mesh that builds no
 * surface is drawable and empty.
 */
export function isDrawablePrimitiveMesh(mesh: ResolvableResource): boolean {
  return isPrimitiveMeshType(mesh.resource.type) && primitiveMeshFont(mesh)?.status !== 'unreadable';
}

/**
 * A key over the content of each resource the mesh's build reads, and over its font, empty for a
 * type that reads none. A resource that is not there, or not loaded, is part of the key as missing.
 * A mesh object holds its resources and its lookups for good, so a key is read once per object. A
 * mesh whose font awaits metrics is read each time: its key moves when they settle.
 */
export const referencesKey = perObject(readReferencesKey, {
  keeps: (_value, mesh) => !isAwaitingFontMetrics(mesh),
});

function readReferencesKey(mesh: ResolvableResource): string {
  const { resource, resources, loadedFile } = mesh;
  const font = primitiveMeshFont(mesh);
  return [
    ...referencesOf(resource.type).map((property) => {
      const named = resolveReference(resource.data[property], resources, loadedFile);
      return named ? resourceContentKey(named.resource) : 'missing';
    }),
    ...(font ? [textMeshFontKey(font)] : []),
  ].join('|');
}

/** A surface and the content of the references it was built from. */
interface BuiltSurface {
  referencesKey: string;
  surface: GodotSurface | null;
}

/**
 * Written only by `primitiveMeshSurface`: one entry per resource and texel size, replaced when the
 * resources the build reads change. A resource's entries go when the parsed resource does, so the
 * geometry and the AABB of one mesh share one build.
 */
const builtSurfaces = perObject<TscnInternalResource, Map<number, BuiltSurface>>(() => new Map());

/**
 * The surface `_update` hands the rendering server (`primitive_meshes.cpp:45-123`), in Godot's
 * arrays. `mesh` holds the tables and files its references resolve in. `texelSize` is the project's
 * PrimitiveMesh texel size, which turns `uv2_padding` into world units (`:403-407`). Null for an
 * unknown, external (GLB) or unresolvable type, a mesh Godot would refuse to build, or a font that
 * is not ready. The surface is shared, so a caller copies before it writes.
 */
export function primitiveMeshSurface(mesh: ResolvableResource, texelSize: number): GodotSurface | null {
  const { resource } = mesh;
  if (!isPrimitiveMeshType(resource.type)) return null;
  const byTexelSize = builtSurfaces(resource);
  const key = referencesKey(mesh);
  const built = byTexelSize.get(texelSize);
  if (built?.referencesKey === key) return built.surface;
  const surface = buildSurface(mesh, texelSize);
  byTexelSize.set(texelSize, { referencesKey: key, surface });
  return surface;
}

function buildSurface(mesh: ResolvableResource, texelSize: number): GodotSurface | null {
  const { resource, resources, loadedFile } = mesh;
  const type = TYPES[resource.type]!;
  const base = decodePrimitiveMesh(resource.data);
  // Godot holds the padding and the texel size in a `float` (`:1065`), so each rounds to single precision.
  const uv2Padding = base.addUv2 ? storedReal(base.uv2Padding * storedReal(texelSize)) : null;
  const references = Object.fromEntries(
    referencesOf(resource.type).map((property) => [
      property,
      resolveReferencedResource(resource.data[property], resources, loadedFile),
    ])
  );
  const built = type.build({ data: resource.data, uv2Padding, references, font: primitiveMeshFont(mesh) });
  if (!built) return null;
  const surface =
    base.addUv2 && type.lightmapSizeHint
      ? withFallbackUv2(built, base.uv2Padding, type.lightmapSizeHint(resource.data, texelSize))
      : built;
  return base.flipFaces ? flipFaces(surface) : surface;
}
