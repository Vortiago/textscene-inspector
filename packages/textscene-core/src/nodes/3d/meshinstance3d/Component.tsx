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
 * label naming the missing path (WI-R3F-7 / WEB-03/04/05).
 *
 * Material precedence (matches Godot):
 *   surface_material_override > material_override > mesh's own material > default placeholder.
 */

import * as THREE from 'three';
import { useMemo, type ReactNode } from 'react';
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
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
import { parseStandardMaterial3DScalars } from '../../../r3f/materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { applyUVTransform } from './applyUVTransform';
import { triplanarPlaneScale } from './triplanarScale';

/** Texture slots StandardMaterial3D exposes — checked in this order. */
const TEXTURE_PROPERTIES = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
  'ao_texture',
] as const;

export function MeshInstance3D({ node }: NodeComponentProps) {
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

  // WI-R3F-19 parity-audit fix: when multiple `surface_material_override/N`
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
  // WI-R3F-19 parity-audit fix: `ao_texture` now resolves and wires
  // through to `material.aoMap`. Was silently dropped because the slot
  // wasn't in `TEXTURE_PROPERTIES` pre-fix.
  const aoStatus = useResource<THREE.Texture>(
    textureRequests.ao_texture ?? '',
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
    }),
    [textureRequests, albedoStatus, normalStatus, roughnessStatus, metallicStatus, emissionStatus, aoStatus]
  );

  // Apply the material's UV transform (`uv1_scale` / `uv1_offset`) to
  // every loaded texture. `applyUVTransform` clones the texture before
  // mutating, so two MeshInstance3D nodes sharing the same path with
  // different scale don't clobber each other. Identity transforms
  // (scale = 1,1 and offset = 0,0) skip the clone and return the
  // original.
  //
  // WI-HALL-5: a triplanar material tiles per WORLD unit, not across the
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
    // shipped scene sets uv1_offset, so impact is currently zero — see
    // docs/PARITY-LIMITATIONS.md.
    return { scale, offset: materialScalars.uv1Offset };
  }, [materialScalars, meshResource]);

  const albedoMap = useMemo(
    () => transformedTexture(textureSlots.albedo_texture, uvTransform),
    [textureSlots.albedo_texture, uvTransform]
  );
  const normalMap = useMemo(
    () => transformedTexture(textureSlots.normal_texture, uvTransform),
    [textureSlots.normal_texture, uvTransform]
  );
  // PARITY LIMITATION (metallic/roughness texture channel): Godot reads the
  // channel named by `metallic_texture_channel` / `roughness_texture_channel`
  // (default RED). three.js's metalnessMap/roughnessMap read fixed channels
  // (BLUE / GREEN). Faithful for grayscale or matching-channel (ORM) maps; a
  // RED-packed map with differing channels would misread. A true fix needs
  // runtime channel-swizzling — see docs/PARITY-LIMITATIONS.md.
  const roughnessMap = useMemo(
    () => transformedTexture(textureSlots.roughness_texture, uvTransform),
    [textureSlots.roughness_texture, uvTransform]
  );
  const metalnessMap = useMemo(
    () => transformedTexture(textureSlots.metallic_texture, uvTransform),
    [textureSlots.metallic_texture, uvTransform]
  );
  const emissiveMap = useMemo(
    () => transformedTexture(textureSlots.emission_texture, uvTransform),
    [textureSlots.emission_texture, uvTransform]
  );
  const aoMap = useMemo(
    () => transformedTexture(textureSlots.ao_texture, uvTransform),
    [textureSlots.ao_texture, uvTransform]
  );

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

  // WI-R3F-19 parity-audit fix: cast_shadow mode 2 (DOUBLE_SIDED) sets
  // material.shadowSide = DoubleSide; mode 3 (SHADOWS_ONLY) keeps the
  // shadow pass on but hides the mesh from the colour buffer.
  const shadowFlags = shadowCastingFlags(properties.castShadow);
  const castShadow = shadowFlags.castShadow;
  const visible = properties.visible !== false && !shadowFlags.shadowsOnly;

  // Every render branch wraps its content in the same attribute shell.
  const shellProps = { name: node.name, position, rotation, scale, visible, castShadow };

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
    if (!arrayMeshResult.value) return null;

    // Loaded external ArrayMesh: render the decoded geometry with one material
    // per surface (draw group). Each surface's StandardMaterial3D `.tres` is
    // resolved through the material pipeline by an <ArrayMeshSurfaceMaterial>
    // child — that keeps the `useResource` calls one-per-component (rules of
    // hooks) while still loading textured materials for every surface.
    const { geometry, materialPaths } = arrayMeshResult.value;
    const surfacePaths = materialPaths.length > 0 ? materialPaths : [null];
    const multiSurface = surfacePaths.length > 1;
    return (
      <MeshShell {...shellProps}>
        <primitive object={geometry} attach="geometry" />
        {surfacePaths.map((path, i) => (
          <ArrayMeshSurfaceMaterial
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

  // Missing texture: magenta placeholder material. Gap 12 (WI-UX-3):
  // the in-3D floating label was redundant once the DOM
  // `<MissingResourcesPanel>` lists every missing path. `firstMissingPath`
  // is still used for the placeholder branch trigger.
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
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  castShadow: boolean;
  children: ReactNode;
}

/**
 * Shared attribute shell for every `<mesh>` branch in MeshInstance3D.
 * All five branches (placeholder, unavailable ArrayMesh, loading ArrayMesh,
 * missing-texture and fully-resolved) set the same six positional/visibility
 * props; this helper keeps them in one place so a future prop rename or
 * addition only changes one definition.
 */
function MeshShell({ name, position, rotation, scale, visible, castShadow, children }: MeshShellProps) {
  return (
    <mesh
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      castShadow={castShadow}
      receiveShadow
    >
      {children}
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
 * Material for one ArrayMesh surface (draw group). Loads the surface's
 * StandardMaterial3D `.tres` through the material pipeline (textures and all)
 * and attaches it at the group's slot. Falls back to Godot's default white
 * material while pending or when the surface declares no material. One
 * `useResource` per component instance keeps the rules of hooks satisfied for
 * an arbitrary surface count.
 */
function ArrayMeshSurfaceMaterial({
  path,
  attach,
  shadowSide,
}: {
  path: string | null;
  attach: string;
  shadowSide?: THREE.Side;
}) {
  const result = useResource<THREE.Material>(path ?? '', 'StandardMaterial3D');
  if (path && result.value) {
    return <primitive object={result.value} attach={attach} />;
  }
  return (
    <meshStandardMaterial
      attach={attach}
      color={0xffffff}
      metalness={0}
      roughness={1}
      side={THREE.FrontSide}
      shadowSide={shadowSide ?? null}
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
 * 3=SHADOWS_ONLY) into the three flags the renderer needs. WI-R3F-19
 * parity-audit fix: previously only the boolean was returned and modes
 * 2 and 3 collapsed silently to castShadow=true.
 */
function shadowCastingFlags(value: number | undefined): ShadowFlags {
  if (value === undefined || value === 0) {
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
