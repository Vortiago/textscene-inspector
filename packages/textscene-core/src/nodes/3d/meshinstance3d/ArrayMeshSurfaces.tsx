/**
 * ArrayMesh rendering: the surfaces of a decoded mesh, and the decode of the
 * one source that has no file behind it (a scene's own `[sub_resource]`).
 */

import type * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { findSubResource } from '../../../r3f/SceneResourcesContext';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/types';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../../../r3f/materials/ExternalMaterialSlot';
import { decodeSceneArrayMesh } from '../../../resources/meshes/arraymesh/decode';
import type { MaterialSlotSource } from './meshMaterialResolution';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import { warn } from '../../../logger';

/**
 * A decoded ArrayMesh's geometry plus one material slot per draw group. Each
 * surface's material is resolved through the pipeline by its own
 * `<ExternalMaterialSlot>`, which keeps `useResource` one-per-component (rules of
 * hooks) while still loading textured materials for every surface.
 *
 * Shared by both ArrayMesh sources — an external `.tres` and a scene's own
 * `[sub_resource]` — because where the bytes came from stops mattering here.
 */
export function ArrayMeshSurfaces({
  mesh,
  shadowSide,
  sceneMaterials,
  override,
}: {
  mesh: ArrayMeshResource;
  shadowSide: THREE.Side | undefined;
  /**
   * For a mesh inlined in the scene: its own `[sub_resource]` materials, by id.
   * Those cannot be addressed by a resource path, so they arrive already resolved
   * rather than through the pipeline.
   */
  sceneMaterials?: readonly (TscnInternalResource | undefined)[];
  /**
   * The node's `material_override`, already resolved, or null when it names
   * none.
   *
   * It replaces the material on EVERY surface:
   * `_geometry_instance_add_surface` takes `material_override` ahead of the
   * material it was handed (`render_forward_clustered.cpp:4206`), and that
   * caller had already chosen the surface's own
   * (`render_forward_clustered.cpp:4267`). The mesh's per-surface materials are
   * therefore reachable only while the override is unset — which is the whole
   * of what this prop expresses, and what the primitive branch's
   * `resolveMaterialSubResources` says for a mesh with no surfaces of its own.
   */
  override?: MaterialSlotSource | null;
}) {
  const surfacePaths = mesh.materialPaths.length > 0 ? mesh.materialPaths : [null];
  const multiSurface = surfacePaths.length > 1;
  // One source per surface, chosen once: the override fills BOTH channels for
  // every surface at once, so the mesh's own material is reachable only while
  // it is unset, and the two channels can never disagree about which won.
  const sources: MaterialSlotSource[] = surfacePaths.map((path, i) =>
    override ?? { subResource: sceneMaterials?.[i], path: path ?? undefined }
  );
  // Every slot reading the same sub-resource decodes it once, across renders
  // too — `parseStandardMaterial3DScalars` walks ~60 property decodes and this
  // runs inside the render. Keyed on the resource OBJECT, which a re-parse
  // replaces, so a cache hit can never be stale; a WeakMap so the entry dies
  // with it.
  const decoded = useRef(new WeakMap<TscnInternalResource, StandardMaterial3DScalars>());
  const scalarsOf = (resource: TscnInternalResource): StandardMaterial3DScalars => {
    const hit = decoded.current.get(resource);
    if (hit) return hit;
    const built = parseStandardMaterial3DScalars(resource.data as Record<string, string>);
    decoded.current.set(resource, built);
    return built;
  };
  return (
    <>
      <primitive object={mesh.geometry} attach="geometry" />
      {sources.map((source, i) => {
        const attach = multiSurface ? `material-${i}` : 'material';
        // A scene-local material is already in hand; only a PATH needs the pipeline.
        return source.subResource ? (
          <StandardMaterialSlot
            key={`surf-${i}`}
            scalars={scalarsOf(source.subResource)}
            attach={attach}
            shadowSide={shadowSide}
          />
        ) : (
          <ExternalMaterialSlot
            key={`surf-${i}`}
            path={source.path ?? null}
            attach={attach}
            shadowSide={shadowSide}
          />
        );
      })}
    </>
  );
}

export interface SceneArrayMesh {
  resource: ArrayMeshResource;
  /** Per surface, the scene's own material sub-resource, when it names one. */
  sceneMaterials: readonly (TscnInternalResource | undefined)[];
}

/**
 * Build the geometry for an ArrayMesh the SCENE declares as its own
 * `[sub_resource]`. Null for any other mesh type, and null when the surfaces
 * cannot be read — the caller shows its placeholder rather than nothing, because
 * an invisible node with no diagnostic is how this case went unnoticed.
 *
 * The geometry's lifetime is owned here: r3f disposes geometry it created from a
 * declarative element, but not an object handed to `<primitive>`.
 */
export function useSceneArrayMeshGeometry(
  resource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): SceneArrayMesh | null {
  // Keyed on the surface BYTES, not on object identity. Every keystroke in the
  // source pane re-parses the scene and hands down fresh arrays and a fresh
  // resource object, so identity deps would re-decode and re-upload the whole
  // inline mesh on the render thread per character — and unlike the `.tres` path
  // there is no processor cache to absorb it.
  const surfacesRaw = resource?.type === 'ArrayMesh' ? resource.data['_surfaces'] : undefined;
  const key = typeof surfacesRaw === 'string' ? surfacesRaw : null;

  const built = useMemo(() => {
    if (resource?.type !== 'ArrayMesh' || key === null) return null;
    try {
      const mesh = decodeSceneArrayMesh(resource, externalResources);
      if (mesh.surfaces.length === 0) return null;
      return {
        resource: {
          geometry: buildArrayMeshGeometry(mesh),
          materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
        },
        // Resolved here rather than in the decoder: only the renderer holds the
        // scene's resources, and a scene's materials are reachable by no path.
        sceneMaterials: mesh.surfaces.map((s) =>
          s.materialSubResourceId === undefined
            ? undefined
            : findSubResource(internalResources, s.materialSubResourceId)
        ),
      };
    } catch (error) {
      warn(
        `[MeshInstance3D] scene ArrayMesh "${resource.id}" could not be decoded: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
    // `key` stands in for `resource`/`externalResources`: same bytes, same mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => built?.resource.geometry.dispose(), [built]);
  return built;
}
