/**
 * <MeshInstance3D> — renders a Godot MeshInstance3D as an R3F <mesh>.
 *
 * Geometry: resolved synchronously from the scene's internal resources
 * (BoxMesh, SphereMesh, PlaneMesh, CylinderMesh, CapsuleMesh, TorusMesh,
 * PrismMesh). GLB / unresolvable references render a magenta wireframe
 * placeholder.
 *
 * Material: synchronously parses StandardMaterial3D scalar properties
 * (albedo color, metallic, roughness, opacity) from the scene's internal
 * resources. External textures route through `useResource` and the host
 * file provider. When ANY referenced texture comes back missing, the
 * mesh switches to a magenta placeholder material with a drei `<Text>`
 * label naming the missing path.
 *
 * Material precedence (render_forward_clustered.cpp:4206, :4267):
 *   material_override > surface_material_override > mesh's own material > default placeholder.
 *
 * The pieces live in sibling modules: reference resolution in
 * `meshMaterialResolution.ts`, the texture pipeline in
 * `useMeshMaterialTextures.ts` / `meshTextureSlots.ts`, `cast_shadow` decoding
 * in `meshShadowFlags.ts`, and the three render fragments in `MeshShell.tsx`,
 * `ArrayMeshSurfaces.tsx` and `SecondarySurfaceMaterial.tsx`.
 */

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import type { MeshInstance3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { ArrayMeshSurfaces, useSceneArrayMeshGeometry } from './ArrayMeshSurfaces';
import { MeshShell, UNRESOLVED_MESH } from './MeshShell';
import { SecondarySurfaceMaterial } from './SecondarySurfaceMaterial';
import { shadowCastingFlags } from './meshShadowFlags';
import {
  resolveExtArrayMeshPath,
  resolveMaterialSubResources,
  resolveMeshSubResource,
} from './meshMaterialResolution';
import { useMeshMaterialTextures } from './useMeshMaterialTextures';

export function MeshInstance3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as MeshInstance3DProperties;
  const { internalResources, externalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const meshResource = useMemo(
    () => resolveMeshSubResource(properties.mesh, internalResources),
    [properties.mesh, internalResources]
  );

  // An ExtResource `mesh` pointing at a `.tres` is an external ArrayMesh:
  // resolve its path and decode it through the resource pipeline. (.glb
  // ExtResources fall through to the placeholder, as before.) The hook is
  // called unconditionally with `''` when the mesh isn't an external
  // ArrayMesh, matching the texture-slot pattern (rules of hooks).
  const arrayMeshPath = useMemo(
    () => resolveExtArrayMeshPath(properties.mesh, externalResources),
    [properties.mesh, externalResources]
  );
  const arrayMeshResult = useResource<ArrayMeshResource>(arrayMeshPath ?? '', 'ArrayMesh');

  // A `[sub_resource type="ArrayMesh"]` of the SCENE: baked surfaces inlined in
  // the `.tscn`, so there is no file to fetch and nothing for the resource
  // pipeline to do — it decodes synchronously from the parsed scene.
  const sceneArrayMesh = useSceneArrayMeshGeometry(
    meshResource,
    internalResources,
    externalResources
  );

  // Parity-audit fix: when multiple `surface_material_override/N`
  // slots are populated (e.g. a GLB or multi-surface mesh), build an
  // array of material SubResources so each surface gets its own slot.
  // Single-surface meshes return a length-1 array.
  const materialSubResources = useMemo(
    () => resolveMaterialSubResources(properties, internalResources),
    [properties, internalResources]
  );
  const materialSubResource = materialSubResources[0] ?? undefined;

  const materialScalars = useMemo(
    () =>
      materialSubResource
        ? parseStandardMaterial3DScalars(
            materialSubResource.data as Record<string, string>
          )
        : null,
    [materialSubResource]
  );

  const {
    albedoMap,
    normalMap,
    roughnessMap,
    metalnessMap,
    emissiveMap,
    aoMap,
    displacementMap,
    anisotropyMap,
    firstMissingPath,
  } = useMeshMaterialTextures(
    materialSubResource,
    materialScalars,
    meshResource,
    internalResources,
    externalResources
  );

  // A StandardMaterial3D carrying `billboard_mode` turns the whole mesh to
  // face the camera — the same per-material effect Godot's shader applies, and
  // the same enum `useBillboard` already implements for Label3D/Sprite3D. The
  // hook is called unconditionally (rules of hooks) with the primary material's
  // mode; it no-ops for the DISABLED/absent case, i.e. almost every mesh. The
  // ref lands on whichever branch's `<mesh>` MeshShell renders. NOTE: a
  // billboarded mesh's scene-tree children render inside the mesh and would
  // inherit its billboard rotation, which Godot (a surface-only shader effect)
  // does not do — no corpus scene billboards a mesh with children.
  const meshRef = useRef<THREE.Mesh | null>(null);
  useBillboard(meshRef, materialScalars?.billboardMode);

  // cast_shadow mode 2 (DOUBLE_SIDED) sets material.shadowSide = DoubleSide;
  // mode 3 (SHADOWS_ONLY) hides the mesh from the colour buffer while it keeps
  // casting — see MeshShell for why that is NOT `visible = false`.
  const shadowFlags = shadowCastingFlags(properties.castShadow);
  // A blend-mode-transparent material (additive / subtractive / multiply)
  // writes no shadow: Godot excludes those surfaces from the shadow pass, so an
  // additive glow sprite must not drop a solid silhouette on the ground.
  const blendTransparent =
    !!materialScalars && materialScalars.blending !== THREE.NormalBlending;
  const castShadow = shadowFlags.castShadow && !blendTransparent;
  const visible = properties.visible !== false;

  // Every render branch wraps its content in the same attribute shell.
  const shellProps = {
    name: node.name,
    meshRef,
    position,
    rotation,
    scale,
    visible,
    castShadow,
    shadowsOnly: shadowFlags.shadowsOnly,
    godotLayers: properties.layers,
    subtree: children,
  };

  // Unresolved mesh (no mesh, external GLB, missing SubResource): magenta
  // wireframe placeholder. An external ArrayMesh (`arrayMeshPath`) is NOT
  // unresolved — it loads asynchronously below.
  if (!meshResource && !arrayMeshPath) {
    return <MeshShell {...shellProps}>{UNRESOLVED_MESH}</MeshShell>;
  }

  // External ArrayMesh: surface its load states. `unavailable` → the .tres
  // couldn't be loaded, show the magenta placeholder; `pending` → render
  // nothing until the geometry arrives (the node still lives in the tree view).
  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') {
      return <MeshShell {...shellProps}>{UNRESOLVED_MESH}</MeshShell>;
    }
    // Still loading: draw no geometry, but keep the shell so the node's own
    // descendants (which do not depend on the .tres) stay mounted meanwhile.
    if (!arrayMeshResult.value) return <MeshShell {...shellProps}>{null}</MeshShell>;

    return (
      <MeshShell {...shellProps}>
        <ArrayMeshSurfaces mesh={arrayMeshResult.value} shadowSide={shadowFlags.shadowSide} />
      </MeshShell>
    );
  }

  // A scene's own `[sub_resource type="ArrayMesh"]` — same geometry and material
  // slots, the bytes just came from the `.tscn` rather than a `.tres`. Unreadable
  // gets the placeholder, not silence: `buildPrimitiveMeshGeometry` has no
  // ArrayMesh case, so falling through would draw nothing at all.
  if (meshResource?.type === 'ArrayMesh') {
    return (
      <MeshShell {...shellProps}>
        {sceneArrayMesh ? (
          <ArrayMeshSurfaces
            mesh={sceneArrayMesh.resource}
            sceneMaterials={sceneArrayMesh.sceneMaterials}
            shadowSide={shadowFlags.shadowSide}
          />
        ) : (
          UNRESOLVED_MESH
        )}
      </MeshShell>
    );
  }

  // Primitive SubResource geometry (declarative <MeshGeometry>).
  const geometryElement = <MeshGeometry resource={meshResource!} />;

  // Missing texture: magenta placeholder material. The in-3D floating
  // label was redundant once the DOM `<MissingResourcesPanel>` lists
  // every missing path. `firstMissingPath` is still used for the
  // placeholder branch trigger.
  if (firstMissingPath !== null) {
    return (
      <MeshShell {...shellProps}>
        {geometryElement}
        <meshStandardMaterial color="magenta" />
      </MeshShell>
    );
  }

  return (
    <MeshShell {...shellProps}>
      {geometryElement}
      <StandardMaterialSlot
        scalars={materialScalars}
        albedoMap={albedoMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        metalnessMap={metalnessMap}
        emissiveMap={emissiveMap}
        aoMap={materialScalars?.aoEnabled ? aoMap : undefined}
        displacementMap={displacementMap}
        anisotropyMap={anisotropyMap}
        shadowSide={shadowFlags.shadowSide}
        meshType={meshResource?.type}
        // Multi-surface meshes (slot N>0 populated): attach the primary
        // material at `material-0` so R3F builds an array and the
        // secondary slots can land at `material-N`. Single-surface meshes
        // omit `attach` to keep `mesh.material` a singular Material.
        attach={materialSubResources.length > 1 ? 'material-0' : undefined}
      />
      {materialSubResources.slice(1).map((subRes, i) => (
        <SecondarySurfaceMaterial
          key={`mat-${i + 1}`}
          attach={`material-${i + 1}`}
          subResource={subRes}
          shadowSide={shadowFlags.shadowSide}
        />
      ))}
    </MeshShell>
  );
}
