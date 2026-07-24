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
 * Material precedence (matches Godot):
 *   surface_material_override > material_override > mesh's own material > default placeholder.
 */

import * as THREE from 'three';
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { MeshInstance3DProperties } from './types';
import type {
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import {
  findSubResource,
  useSceneResources,
} from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { resolveGradientTexture2D } from '../../../resources/textures/gradienttexture2d/resolveGradientTexture';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
import { parseStandardMaterial3DScalars } from '../../../r3f/materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../../../r3f/materials/ExternalMaterialSlot';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { applyUVTransform } from './applyUVTransform';
import { repackAnisotropyFlowmap } from './repackFlowmap';
import { triplanarPlaneScale } from './triplanarScale';

/** Texture slots StandardMaterial3D exposes — checked in this order. */
const TEXTURE_PROPERTIES = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
  'ao_texture',
  'heightmap_texture',
  'anisotropy_flowmap',
] as const;

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

  // Collect texture-path references off the SubResource material and
  // ask the resource loader for each one. The path is the resolved
  // `ExtResource("id").path`; if the metadata doesn't include it (rare),
  // we skip the slot.
  const textureRequests = useMemo(
    () => collectTextureRequests(materialSubResource, externalResources),
    [materialSubResource, externalResources]
  );

  // Drive `useResource` for every requested slot. Hooks must be called
  // unconditionally, in stable order — `TEXTURE_PROPERTIES` is the
  // canonical ordering so even an empty request still calls each hook
  // with an `''` path placeholder, which the hook treats as a no-op
  // (returns `pending` and emits nothing because nothing subscribes
  // to an empty path).
  const albedoStatus = useResource<THREE.Texture>(
    textureRequests.albedo_texture ?? '',
    'Texture2D'
  );
  const normalStatus = useResource<THREE.Texture>(
    textureRequests.normal_texture ?? '',
    'Texture2D'
  );
  const roughnessStatus = useResource<THREE.Texture>(
    textureRequests.roughness_texture ?? '',
    'Texture2D'
  );
  const metallicStatus = useResource<THREE.Texture>(
    textureRequests.metallic_texture ?? '',
    'Texture2D'
  );
  const emissionStatus = useResource<THREE.Texture>(
    textureRequests.emission_texture ?? '',
    'Texture2D'
  );
  // Parity-audit fix: `ao_texture` now resolves and wires
  // through to `material.aoMap`. Was silently dropped because the slot
  // wasn't in `TEXTURE_PROPERTIES` pre-fix.
  const aoStatus = useResource<THREE.Texture>(
    textureRequests.ao_texture ?? '',
    'Texture2D'
  );
  const heightmapStatus = useResource<THREE.Texture>(
    textureRequests.heightmap_texture ?? '',
    'Texture2D'
  );
  const anisotropyFlowmapStatus = useResource<THREE.Texture>(
    textureRequests.anisotropy_flowmap ?? '',
    'Texture2D'
  );

  const textureSlots = useMemo(
    () => ({
      albedo_texture: textureRequests.albedo_texture ? albedoStatus : null,
      normal_texture: textureRequests.normal_texture ? normalStatus : null,
      roughness_texture: textureRequests.roughness_texture ? roughnessStatus : null,
      metallic_texture: textureRequests.metallic_texture ? metallicStatus : null,
      emission_texture: textureRequests.emission_texture ? emissionStatus : null,
      ao_texture: textureRequests.ao_texture ? aoStatus : null,
      heightmap_texture: textureRequests.heightmap_texture ? heightmapStatus : null,
      anisotropy_flowmap: textureRequests.anisotropy_flowmap ? anisotropyFlowmapStatus : null,
    }),
    [
      textureRequests,
      albedoStatus,
      normalStatus,
      roughnessStatus,
      metallicStatus,
      emissionStatus,
      aoStatus,
      heightmapStatus,
      anisotropyFlowmapStatus,
    ]
  );

  // Procedural texture slots resolve synchronously from the scene's internal
  // resources — a `SubResource(GradientTexture2D)` is fully described in the
  // scene, so it is rasterised here rather than fetched through `useResource`
  // like an ExtResource image. This is what gives the platformer coin its
  // additive gradient glow. Any slot NOT carrying a procedural sub-resource
  // stays undefined and falls back to the async `textureSlots` above.
  const proceduralTextures = useMemo(
    () => resolveProceduralTextures(materialSubResource, internalResources),
    [materialSubResource, internalResources]
  );

  // Dispose the generated DataTextures when the material changes or the node
  // unmounts — they own their pixel buffers (mirrors Label3D's CanvasTexture).
  useEffect(() => {
    const textures = Object.values(proceduralTextures);
    return () => {
      for (const texture of textures) texture?.dispose();
    };
  }, [proceduralTextures]);

  // Apply the material's UV transform (`uv1_scale` / `uv1_offset`) to
  // every loaded texture. `applyUVTransform` clones the texture before
  // mutating, so two MeshInstance3D nodes sharing the same path with
  // different scale don't clobber each other. Identity transforms
  // (scale = 1,1 and offset = 0,0) skip the clone and return the
  // original.
  //
  // A triplanar material tiles per WORLD unit, not across the
  // mesh's 0..1 UVs. For a PlaneMesh we reproduce that density by folding
  // the plane's size into the scale (repeat = size × uv1_scale) — otherwise
  // a 12×3.5 hallway floor stretched one texture copy and read "too big".
  const uvTransform = useMemo(() => {
    if (!materialScalars) return null;
    const scale =
      materialScalars.triplanar && meshResource
        ? triplanarPlaneScale(meshResource, materialScalars.uv1Scale)
        : materialScalars.uv1Scale;
    // PARITY LIMITATION (uv1_offset + world-triplanar): three.js applies
    // `offset` in UV space, but Godot's world-triplanar offset is in world
    // units, so a non-zero offset would shift by a different amount here. No
    // shipped scene sets uv1_offset, so impact is currently zero.
    return { scale, offset: materialScalars.uv1Offset };
  }, [materialScalars, meshResource]);

  const albedoMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.albedo_texture, textureSlots.albedo_texture),
        uvTransform
      ),
    [proceduralTextures.albedo_texture, textureSlots.albedo_texture, uvTransform]
  );
  const normalMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.normal_texture, textureSlots.normal_texture),
        uvTransform
      ),
    [proceduralTextures.normal_texture, textureSlots.normal_texture, uvTransform]
  );
  // PARITY LIMITATION (metallic/roughness texture channel): Godot reads the
  // channel named by `metallic_texture_channel` / `roughness_texture_channel`
  // (default RED). three.js's metalnessMap/roughnessMap read fixed channels
  // (BLUE / GREEN). Faithful for grayscale or matching-channel (ORM) maps; a
  // RED-packed map with differing channels would misread. A true fix needs
  // runtime channel-swizzling.
  const roughnessMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.roughness_texture, textureSlots.roughness_texture),
        uvTransform
      ),
    [proceduralTextures.roughness_texture, textureSlots.roughness_texture, uvTransform]
  );
  const metalnessMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.metallic_texture, textureSlots.metallic_texture),
        uvTransform
      ),
    [proceduralTextures.metallic_texture, textureSlots.metallic_texture, uvTransform]
  );
  const emissiveMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.emission_texture, textureSlots.emission_texture),
        uvTransform
      ),
    [proceduralTextures.emission_texture, textureSlots.emission_texture, uvTransform]
  );
  const aoMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.ao_texture, textureSlots.ao_texture),
        uvTransform
      ),
    [proceduralTextures.ao_texture, textureSlots.ao_texture, uvTransform]
  );
  const displacementMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.heightmap_texture, textureSlots.heightmap_texture),
        uvTransform
      ),
    [proceduralTextures.heightmap_texture, textureSlots.heightmap_texture, uvTransform]
  );
  const anisotropyMap = useMemo(() => {
    // Only an anisotropy-enabled material renders as MeshPhysicalMaterial and
    // samples anisotropyMap; skip the repack (a full-buffer copy + per-pixel
    // pass) and the slotKey churn when the strength is 0 — the map would never
    // be read on the standard-material fallback.
    if (!materialScalars || materialScalars.anisotropy <= 0) return undefined;
    const value = textureSlots.anisotropy_flowmap?.value;
    if (!value) return undefined;
    const repacked = repackAnisotropyFlowmap(value);
    if (!repacked) return undefined;
    return transformedTexture({ value: repacked }, uvTransform);
  }, [materialScalars, textureSlots.anisotropy_flowmap, uvTransform]);

  // If any requested slot resolved to `unavailable`, surface the FIRST
  // such path as the placeholder label. Listing more than one would
  // bury the user under text.
  const firstMissingPath = useMemo(() => {
    for (const slot of TEXTURE_PROPERTIES) {
      const result = textureSlots[slot];
      const requested = textureRequests[slot];
      if (result && result.status === 'unavailable' && requested) {
        return requested;
      }
    }
    return null;
  }, [textureSlots, textureRequests]);

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
    subtree: children,
  };

  // Unresolved mesh (no mesh, external GLB, missing SubResource): magenta
  // wireframe placeholder. An external ArrayMesh (`arrayMeshPath`) is NOT
  // unresolved — it loads asynchronously below.
  if (!meshResource && !arrayMeshPath) {
    return (
      <MeshShell {...shellProps}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={0xff00ff} wireframe />
      </MeshShell>
    );
  }

  // External ArrayMesh: surface its load states. `unavailable` → the .tres
  // couldn't be loaded, show the magenta placeholder; `pending` → render
  // nothing until the geometry arrives (the node still lives in the tree view).
  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') {
      return (
        <MeshShell {...shellProps}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={0xff00ff} wireframe />
        </MeshShell>
      );
    }
    // Still loading: draw no geometry, but keep the shell so the node's own
    // descendants (which do not depend on the .tres) stay mounted meanwhile.
    if (!arrayMeshResult.value) return <MeshShell {...shellProps}>{null}</MeshShell>;

    // Loaded external ArrayMesh: render the decoded geometry with one material
    // per surface (draw group). Each surface's StandardMaterial3D `.tres` is
    // resolved through the material pipeline by an <ExternalMaterialSlot>
    // child — that keeps the `useResource` calls one-per-component (rules of
    // hooks) while still loading textured materials for every surface.
    const { geometry, materialPaths } = arrayMeshResult.value;
    const surfacePaths = materialPaths.length > 0 ? materialPaths : [null];
    const multiSurface = surfacePaths.length > 1;
    return (
      <MeshShell {...shellProps}>
        <primitive object={geometry} attach="geometry" />
        {surfacePaths.map((path, i) => (
          <ExternalMaterialSlot
            key={`surf-${i}`}
            path={path}
            attach={multiSurface ? `material-${i}` : 'material'}
            shadowSide={shadowFlags.shadowSide}
          />
        ))}
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

interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh, so `useBillboard` can turn it per frame. */
  meshRef: RefObject<THREE.Mesh | null>;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  castShadow: boolean;
  /** `cast_shadow = SHADOWS_ONLY` (3): cast, but draw nothing. */
  shadowsOnly: boolean;
  /** The dispatched scene-tree subtree parented under this MeshInstance3D. */
  subtree: ReactNode;
  children: ReactNode;
}

/**
 * Shared attribute shell for every `<mesh>` branch in MeshInstance3D.
 * All five branches (placeholder, unavailable ArrayMesh, loading ArrayMesh,
 * missing-texture and fully-resolved) set the same props; this helper keeps
 * them in one place so a future prop rename or addition only changes one
 * definition.
 *
 * `children` is the geometry/material slot each branch fills; `subtree` is the
 * node's own scene-tree descendants, which render inside the mesh so they
 * inherit its transform (Godot draws children after, and relative to, the
 * node). Every branch — including the ones that draw a placeholder — must pass
 * it, or the descendants vanish with the mesh.
 */
function MeshShell({
  name,
  meshRef,
  position,
  rotation,
  scale,
  visible,
  castShadow,
  shadowsOnly,
  subtree,
  children,
}: MeshShellProps) {
  return (
    <mesh
      ref={meshRef}
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      castShadow={castShadow}
      receiveShadow
    >
      {children}
      {/* SHADOWS_ONLY draws nothing but must still CAST, and its descendants
          must still render. `visible = false` gives neither: three's
          `WebGLShadowMap.renderObject` opens with
          `if (object.visible === false) return;`, which skips the shadow pass
          AND stops walking the subtree. Setting `material.visible = false` is
          no better — the same function gates the depth material on it. A
          material that writes neither colour nor depth is what separates the
          two passes: `getDepthMaterial` copies alphaMap/alphaTest/map and never
          `colorWrite`, so the shadow comes through untouched. Mounting after
          `children` makes this the material R3F attaches last. */}
      {shadowsOnly && (
        <meshBasicMaterial attach="material" colorWrite={false} depthWrite={false} />
      )}
      {subtree}
    </mesh>
  );
}

interface SecondarySurfaceMaterialProps {
  attach: string;
  subResource: TscnInternalResource | undefined;
  shadowSide?: THREE.Side;
}

/**
 * Material attached at `material-N` (N > 0) for multi-surface meshes.
 * Scalar properties only — texture loading for slots N>0 would require
 * calling `useResource` from a render-time loop, which violates rules
 * of hooks. The pre-migration imperative renderer also only fully
 * supported texture-bearing materials on slot 0; secondary slots
 * default to scalar-only or default placeholder.
 */
function SecondarySurfaceMaterial({
  attach,
  subResource,
  shadowSide,
}: SecondarySurfaceMaterialProps) {
  if (!subResource) {
    return (
      <meshStandardMaterial
        attach={attach}
        color={0xcccccc}
        metalness={0.3}
        roughness={0.7}
        shadowSide={shadowSide ?? null}
      />
    );
  }
  const scalars = parseStandardMaterial3DScalars(
    subResource.data as Record<string, string>
  );
  return (
    <meshStandardMaterial
      attach={attach}
      color={scalars.color}
      metalness={scalars.metalness}
      roughness={scalars.roughness}
      transparent={scalars.transparent}
      opacity={scalars.opacity}
      blending={scalars.blending}
      side={scalars.side}
      shadowSide={shadowSide ?? null}
      emissive={scalars.emissive}
      emissiveIntensity={scalars.emissiveIntensity}
    />
  );
}

/**
 * Clone the loaded texture (if any) with the material's UV transform
 * applied. Returns `undefined` when nothing is loaded yet, so the
 * `<meshStandardMaterial>` falls back to `null` for that slot.
 */
function transformedTexture(
  slot: { value: THREE.Texture | undefined } | null,
  uv: { scale: { x: number; y: number }; offset: { x: number; y: number } } | null
): THREE.Texture | undefined {
  const value = slot?.value;
  if (!value) return undefined;
  if (!uv) return value;
  return applyUVTransform(value, uv);
}

/**
 * A synchronously-resolved procedural texture (e.g. GradientTexture2D) takes
 * precedence over the async-loaded slot for the same map. Returns a
 * `transformedTexture`-shaped slot so the UV-transform path is shared.
 */
function effectiveSlot(
  procedural: THREE.Texture | undefined,
  asyncSlot: { value: THREE.Texture | undefined } | null
): { value: THREE.Texture | undefined } | null {
  return procedural ? { value: procedural } : asyncSlot;
}

/**
 * Rasterise every material texture slot that references an inline procedural
 * texture (currently `SubResource(GradientTexture2D)`) into a THREE.Texture.
 * Slots carrying an ExtResource image, a non-gradient SubResource, or nothing
 * are omitted, leaving the async `useResource` path to handle them.
 */
function resolveProceduralTextures(
  materialSubResource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[]
): Partial<Record<TextureSlot, THREE.Texture>> {
  if (!materialSubResource) return {};
  const out: Partial<Record<TextureSlot, THREE.Texture>> = {};
  const data = materialSubResource.data as Record<string, unknown>;
  for (const slot of TEXTURE_PROPERTIES) {
    const raw = data[slot];
    if (typeof raw !== 'string') continue;
    const texture = resolveGradientTexture2D(raw, internalResources);
    if (texture) out[slot] = texture;
  }
  return out;
}

function resolveMeshSubResource(
  meshRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!meshRef) return undefined;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  return findSubResource(internalResources, parsed.id);
}

/**
 * Resolve an `ExtResource("id")` `mesh` reference to the `.tres` path of an
 * external ArrayMesh. Returns null for SubResource refs (handled inline),
 * non-`.tres` ExtResources (e.g. `.glb`, handled by the placeholder), or
 * unknown ids.
 */
function resolveExtArrayMeshPath(
  meshRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!meshRef) return null;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = externalResources.find((r) => r.id === parsed.id);
  if (!ext?.path || !ext.path.endsWith('.tres')) return null;
  return ext.path;
}

/**
 * Resolve the material(s) the mesh should render with. Returns an array
 * indexed by surface — element 0 always corresponds to surface 0.
 * Single-surface meshes return a length-1 array; multi-surface meshes
 * return a length-N array with `undefined` for unpopulated slots (the
 * caller's SecondarySurfaceMaterial renders a default placeholder).
 * The first element collapses the legacy fallback chain:
 *   surface_material_override[0] > material_override > mesh-own.
 */
function resolveMaterialSubResources(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[]
): Array<TscnInternalResource | undefined> {
  const overrides = properties.surfaceMaterialOverrides;
  const surfaceSlots =
    overrides && overrides.size > 0
      ? Math.max(...Array.from(overrides.keys()), 0) + 1
      : 1;

  const slot0Ref =
    overrides?.get(0) ??
    properties.materialOverride ??
    findMeshOwnMaterial(properties.mesh, internalResources);

  const result: Array<TscnInternalResource | undefined> = new Array(surfaceSlots);
  result[0] = resolveStandardMaterial(slot0Ref, internalResources);
  for (let i = 1; i < surfaceSlots; i++) {
    const ref = overrides?.get(i);
    result[i] = resolveStandardMaterial(ref, internalResources);
  }
  return result;
}

function findMeshOwnMaterial(
  meshRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): string | undefined {
  if (!meshRef) return undefined;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  const meshResource = findSubResource(internalResources, parsed.id);
  const material = meshResource?.data?.['material'];
  return typeof material === 'string' ? material : undefined;
}

type TextureSlot = (typeof TEXTURE_PROPERTIES)[number];

/**
 * Walk the material's texture slots and resolve each `ExtResource("id")`
 * reference to the underlying path string. Returns `{ slot: path | undefined }`
 * so the caller can fan out to `useResource` for each.
 */
function collectTextureRequests(
  materialSubResource: TscnInternalResource | undefined,
  externalResources: readonly TscnExternalResource[]
): Partial<Record<TextureSlot, string>> {
  if (!materialSubResource) return {};
  const out: Partial<Record<TextureSlot, string>> = {};
  const data = materialSubResource.data as Record<string, unknown>;
  for (const slot of TEXTURE_PROPERTIES) {
    const raw = data[slot];
    if (typeof raw !== 'string') continue;
    const parsed = parseResourceReference(raw);
    if (!parsed || parsed.type !== 'ExtResource') continue;
    const ext = externalResources.find((r) => r.id === parsed.id);
    if (ext?.path) {
      out[slot] = ext.path;
    }
  }
  return out;
}

interface ShadowFlags {
  castShadow: boolean;
  /** Mesh still casts a shadow but isn't drawn into the colour buffer. */
  shadowsOnly: boolean;
  /** Override material.shadowSide so both faces participate in the shadow pass. */
  shadowSide?: THREE.Side;
}

/**
 * Decode Godot's `cast_shadow` enum (0=OFF, 1=ON, 2=DOUBLE_SIDED,
 * 3=SHADOWS_ONLY) into the three flags the renderer needs. Previously
 * only the boolean was returned and modes 2 and 3 collapsed silently to
 * castShadow=true.
 */
function shadowCastingFlags(value: number | undefined): ShadowFlags {
  // class_geometryinstance3d.html: cast_shadow defaults to 1
  // (SHADOW_CASTING_SETTING_ON), so an absent key means the mesh DOES cast.
  if (value === 0) {
    return { castShadow: false, shadowsOnly: false };
  }
  if (value === 2) {
    return { castShadow: true, shadowsOnly: false, shadowSide: THREE.DoubleSide };
  }
  if (value === 3) {
    return { castShadow: true, shadowsOnly: true };
  }
  return { castShadow: true, shadowsOnly: false };
}

export { THREE };
