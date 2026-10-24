/**
 * What a resolved mesh draws: its geometry and each draw group's own material, whatever kind of
 * mesh it is and wherever it lives. MeshInstance3D and GridMap read a mesh through this one hook.
 * An ArrayMesh with a path decodes once through the ArrayMesh processor. Every other mesh builds in
 * place. A TextMesh builds once its font has loaded.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import { warn } from '../../logger';
import { projectPrimitiveMeshTexelSize } from '../../parser/projectSettingsParser';
import { decodeSceneArrayMesh } from '../../resources/meshes/arraymesh/decode';
import { godotSurfaceParts } from '../../resources/meshes/godotSurface';
import { meshKind, primitiveMaterialAddress, type MeshSource } from '../../resources/meshes/meshSource';
import { isDrawablePrimitiveMesh } from '../../resources/meshes/primitivemesh/surface';
import { useResolvableMesh } from '../../resources/meshes/useResolvableMesh';
import type { ScopedResource } from '../../resources/scopedResource';
import type { ArrayMeshResource } from '../../resources/processors/createArrayMeshProcessor';
import { useResource } from '../../resources/useResource';
import type { ResourceResolution } from '../../resources/useSubOrExtResource';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { fileMaterialSources, resolveMaterialSource, type MaterialSource } from '../materials/materialSource';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { useUndrawnMeshReport } from '../contexts/UndrawnMeshesContext';
import { primitiveMeshGeometry } from './primitiveMeshGeometry';

/** `items` as a list known to hold one, or null for none. */
function nonEmpty<T>(items: readonly T[]): readonly [T, ...T[]] | null {
  const [first, ...rest] = items;
  return first === undefined ? null : [first, ...rest];
}

/** The draw groups of one geometry, which one three object draws, and each group's own material. */
export interface SurfacedPart {
  geometry: THREE.BufferGeometry;
  /** Per draw group, Godot's surface index, which `surface_material_override/N` names. */
  surfaceIndices: readonly number[];
  /** Per draw group, the material the surface names, or undefined for Godot's default surface. */
  materials: readonly (MaterialSource | undefined)[];
}

/**
 * A mesh's surfaces, whichever file holds them. Triangle surfaces and points surfaces draw as
 * different three objects, so a mesh has a part for each kind it holds, triangles first.
 */
export interface SurfacedMesh {
  parts: readonly [SurfacedPart, ...SurfacedPart[]];
  /** The PrimitiveMesh drawn, which a triplanar material tiles against. Absent for an ArrayMesh. */
  primitive?: TscnInternalResource;
}

/** The R3F tag that draws a surface: `THREE.Points` for geometry of Godot's `PRIMITIVE_POINTS`, else a `THREE.Mesh`. */
export function drawnTag(drawsPoints: boolean): 'points' | 'mesh' {
  return drawsPoints ? 'points' : 'mesh';
}

type MeshContent =
  /**
   * A mesh the scene lacks, a file that cannot load, or surfaces that cannot be read. Also a type no
   * slice builds, which Godot draws: the caller's placeholder says this previewer does not.
   */
  | { kind: 'unresolved' }
  /** The property holds no mesh. Godot draws nothing for it, and so does the caller. */
  | { kind: 'none' }
  | { kind: 'loading' }
  /** A mesh with no surface, such as a PlaceholderMesh or a TorusMesh of equal radii: it draws nothing. */
  | { kind: 'empty' }
  | { kind: 'surfaced'; mesh: SurfacedMesh };

const UNRESOLVED: MeshContent = { kind: 'unresolved' };
const NONE: MeshContent = { kind: 'none' };
const LOADING: MeshContent = { kind: 'loading' };
const EMPTY: MeshContent = { kind: 'empty' };

/** The path the ArrayMesh processor decodes, for an ArrayMesh with a path. Null for any other mesh. */
export function arrayMeshPath({ scoped, resourcePath }: ResourceResolution): string | null {
  return resourcePath && scoped && meshKind(scoped.resource.type) === 'arrayMesh' ? resourcePath : null;
}

export function useMeshContent(resolution: ResourceResolution): MeshContent {
  const { scoped, status, resourcePath } = resolution;
  const kind = scoped ? meshKind(scoped.resource.type) : null;
  const processorPath = arrayMeshPath(resolution);
  // `''` requests nothing.
  const fileArrayMesh = useResource<ArrayMeshResource>(processorPath ?? '', 'arraymesh');
  const fileSurfaced = useMemo(
    () => fileArrayMesh.value && withFileMaterials(fileArrayMesh.value),
    [fileArrayMesh.value]
  );
  const sceneSurfaced = useSceneArrayMesh(kind === 'arrayMesh' && !processorPath ? scoped : null);
  const { mesh: resolvable, isLoading: isLoadingReferences } = useResolvableMesh(
    kind === 'primitive' ? scoped : null
  );
  // Not while a file or the font loads: the mesh is unknown, not undrawn.
  const undrawnType =
    scoped && (kind === null || (resolvable && !isDrawablePrimitiveMesh(resolvable)))
      ? scoped.resource.type
      : null;
  useUndrawnMeshReport(undrawnType);
  const primitiveSurfaced = usePrimitiveMesh(
    useMemo(() => (resolvable ? { ...resolvable, path: resourcePath } : null), [resolvable, resourcePath])
  );

  if (resolution.isNone) return NONE;
  if (status === 'pending') return LOADING;
  if (!scoped || !kind) return UNRESOLVED;
  if (kind === 'surfaceless') return EMPTY;
  if (kind === 'primitive') {
    if (isLoadingReferences) return LOADING;
    if (undrawnType) return UNRESOLVED;
    return primitiveSurfaced ? { kind: 'surfaced', mesh: primitiveSurfaced } : EMPTY;
  }
  if (!processorPath) return sceneSurfaced ? { kind: 'surfaced', mesh: sceneSurfaced } : UNRESOLVED;
  if (fileArrayMesh.status === 'unavailable') return UNRESOLVED;
  if (!fileArrayMesh.value) return LOADING;
  return fileSurfaced ? { kind: 'surfaced', mesh: fileSurfaced } : EMPTY;
}

/** An ArrayMesh the processor decoded, each material a file the loader fetches. Null for one with no surface. */
function withFileMaterials(mesh: ArrayMeshResource): SurfacedMesh | null {
  const parts = nonEmpty(
    mesh.parts.map(({ geometry, surfaceIndices, materialPaths }) => ({
      geometry,
      surfaceIndices,
      materials: fileMaterialSources(materialPaths),
    }))
  );
  return parts && { parts };
}

/** A PrimitiveMesh's one surface under its own material, or null for a mesh Godot builds no surface for. */
function usePrimitiveMesh(source: MeshSource | null): SurfacedMesh | null {
  const geometry = usePrimitiveMeshGeometry(source);
  const material = useMemo(
    () =>
      source
        ? resolveMaterialSource(primitiveMaterialAddress(source, source.path), source.resources)
        : undefined,
    [source]
  );
  return useMemo(
    () =>
      geometry && source
        ? {
            parts: [{ geometry, surfaceIndices: [0], materials: [material] }],
            primitive: source.resource,
          }
        : null,
    [geometry, material, source]
  );
}

/** A PrimitiveMesh's geometry at the project's texel size, or null for none or a mesh with no surface. */
function usePrimitiveMeshGeometry(source: MeshSource | null): THREE.BufferGeometry | null {
  const texelSize = projectPrimitiveMeshTexelSize(useProjectSettings().settings);
  const geometry = useMemo(
    () => (source ? primitiveMeshGeometry(source, texelSize) : null),
    [source, texelSize]
  );
  useDisposeOnRelease(geometry);
  return geometry;
}

/**
 * An ArrayMesh in the scene's tables, with each surface's material resolved against the tables
 * that hold the mesh. Null for no mesh or for unreadable surfaces.
 */
function useSceneArrayMesh(mesh: ScopedResource | null): SurfacedMesh | null {
  const decoded = useSceneArrayMeshGeometry(mesh?.resource);
  const resources = mesh?.resources;
  // Apart from the decode: an edit to a material's body or to an `ext_resource`
  // path changes the resources and leaves the surface bytes alone.
  return useMemo(() => {
    if (!decoded || !resources) return null;
    const parts = nonEmpty(
      decoded.parts.map(({ geometry, surfaceIndices, materialRefs }) => ({
        geometry,
        surfaceIndices,
        materials: materialRefs.map((ref) => resolveMaterialSource(ref, resources)),
      }))
    );
    return parts && { parts };
  }, [decoded, resources]);
}

interface DecodedSceneArrayMesh {
  parts: readonly (Pick<SurfacedPart, 'geometry' | 'surfaceIndices'> & {
    /** Per surface, its raw `"material"` reference, when it has one. */
    materialRefs: readonly (string | undefined)[];
  })[];
  /** Disposes every part's geometry. */
  geometries: { dispose(): void };
}

/** The decoded geometry of a scene ArrayMesh and each surface's raw material reference. */
function useSceneArrayMeshGeometry(resource: TscnInternalResource | undefined): DecodedSceneArrayMesh | null {
  // Keyed on the surface bytes, not identity: every keystroke re-parses the scene into
  // fresh objects, and no processor cache stands in front of an inline mesh, so identity
  // deps would re-decode and re-upload it per character.
  const surfacesRaw = resource?.data['_surfaces'];
  const key = typeof surfacesRaw === 'string' ? surfacesRaw : null;

  const decoded = useMemo(() => {
    if (!resource || key === null) return null;
    try {
      const mesh = decodeSceneArrayMesh(resource);
      if (mesh.surfaces.length === 0) return null;
      const parts = godotSurfaceParts(mesh.surfaces).map(({ geometry, surfaces }) => ({
        geometry,
        surfaceIndices: surfaces.map((surface) => surface.surfaceIndex),
        materialRefs: surfaces.map((surface) => surface.materialRef),
      }));
      return { parts, geometries: { dispose: () => parts.forEach((part) => part.geometry.dispose()) } };
    } catch (error) {
      warn(
        `[mesh] scene ArrayMesh "${resource.id}" could not be decoded: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `resource`.
  }, [key]);

  useDisposeOnRelease(decoded?.geometries);
  return decoded;
}
