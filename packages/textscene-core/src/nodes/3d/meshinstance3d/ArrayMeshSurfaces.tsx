/**
 * ArrayMesh rendering: the surfaces of a decoded mesh, and the decode of the
 * one source that has no file behind it (a scene's own `[sub_resource]`).
 */

import type * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { findSubResource } from '../../../r3f/SceneResourcesContext';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../../../r3f/materials/ExternalMaterialSlot';
import { decodeSceneArrayMesh } from '../../../resources/meshes/arraymesh/decode';
import type { MaterialSlotSource } from './meshMaterialResolution';
import { SceneMaterialSlot } from './SceneMaterialSlot';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import { warn } from '../../../logger';

/**
 * A decoded ArrayMesh's geometry plus one material slot per draw group. Each
 * surface's material is loaded by its own slot component — `<ExternalMaterialSlot>`
 * for a path, `<SceneMaterialSlot>` for a scene sub-resource — which keeps
 * `useResource` one-per-component (rules of hooks) while still loading textured
 * materials for every surface.
 *
 * Shared by both ArrayMesh sources — an external `.tres` and a scene's own
 * `[sub_resource]` — because where the bytes came from stops mattering here.
 */
export function ArrayMeshSurfaces({
  mesh,
  shadowSide,
  sceneMaterials,
  surfaceOverrides,
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
   * `surface_material_override/N`, already resolved per surface index, or null
   * for an index that names none. Consulted after `material_override` and before
   * the surface's own material (`get_active_material`,
   * mesh_instance_3d.cpp:395-400).
   */
  surfaceOverrides?: readonly (MaterialSlotSource | null)[];
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
   * of what this prop expresses.
   */
  override?: MaterialSlotSource | null;
}) {
  const surfacePaths = mesh.materialPaths.length > 0 ? mesh.materialPaths : [null];
  const multiSurface = surfacePaths.length > 1;
  // One source per surface, chosen once in Godot's order: an override fills
  // BOTH channels of a surface at once, so a lower layer is reachable only while
  // every layer above it is unset, and the channels never disagree about which
  // won.
  const sources: MaterialSlotSource[] = surfacePaths.map(
    (path, i) =>
      override ??
      surfaceOverrides?.[i] ?? { subResource: sceneMaterials?.[i], path: path ?? undefined }
  );
  return (
    <>
      <primitive object={mesh.geometry} attach="geometry" />
      {sources.map((source, i) => {
        const attach = multiSurface ? `material-${i}` : 'material';
        const key = `surf-${i}`;
        // A scene-local material is already in hand; a PATH needs the pipeline.
        if (source.subResource) {
          return (
            <SceneMaterialSlot
              key={key}
              subResource={source.subResource}
              attach={attach}
              shadowSide={shadowSide}
            />
          );
        }
        if (source.path) {
          return (
            <ExternalMaterialSlot key={key} path={source.path} attach={attach} shadowSide={shadowSide} />
          );
        }
        // Neither channel: no material, or one this previewer cannot build.
        // Godot draws the hardcoded default shader for the former, and the
        // primitive path already answers both with the same grey slot.
        return <StandardMaterialSlot key={key} scalars={null} attach={attach} shadowSide={shadowSide} />;
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
  // there is no processor cache to absorb it. The ext-resource table is the
  // decode's second input (a surface's `material` may name a `res://` path) and
  // is keyed separately rather than folded in, so the surface blob is not
  // re-concatenated per render.
  const surfacesRaw = resource?.type === 'ArrayMesh' ? resource.data['_surfaces'] : undefined;
  const key = typeof surfacesRaw === 'string' ? surfacesRaw : null;
  // Only for a mesh that has surfaces to key: every MeshInstance3D renders
  // through this hook, and the table is re-serialised per render otherwise.
  const extKey = useMemo(
    () => (key === null ? null : JSON.stringify(externalResources.map((r) => [r.id, r.path]))),
    [key, externalResources]
  );

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
        materialIds: mesh.surfaces.map((s) => s.materialSubResourceId),
      };
    } catch (error) {
      warn(
        `[MeshInstance3D] scene ArrayMesh "${resource.id}" could not be decoded: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
    // `key` + `extKey` stand in for `resource`/`externalResources`: same bytes
    // and same ext table, same mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, extKey]);

  useEffect(() => () => built?.resource.geometry.dispose(), [built]);

  // Resolved OUTSIDE the decode memo, and not in the decoder: only the renderer
  // holds the scene's resources, a scene's materials are reachable by no path,
  // and the material sub-resource lives BESIDE `_surfaces` rather than in it —
  // so editing its `albedo_color` leaves the decode key untouched and would
  // never reach the surface from inside.
  return useMemo(
    () =>
      built && {
        resource: built.resource,
        sceneMaterials: built.materialIds.map((id) =>
          id === undefined ? undefined : findSubResource(internalResources, id)
        ),
      },
    [built, internalResources]
  );
}
