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
import { useMemo } from 'react';
import type { MeshInstance3DProperties } from '../../../nodes/3d/meshinstance3d/types';
import type {
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import {
  findSubResource,
  useSceneResources,
} from '../../SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { InternalTextLabel } from '../../internalTextLabel';
import { MeshGeometry } from './meshGeometry';
import {
  parseStandardMaterial3DScalars,
  type StandardMaterial3DScalars,
} from './materialScalars';
import { applyUVTransform } from './applyUVTransform';

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

  const textureSlots = {
    albedo_texture: textureRequests.albedo_texture ? albedoStatus : null,
    normal_texture: textureRequests.normal_texture ? normalStatus : null,
    roughness_texture: textureRequests.roughness_texture ? roughnessStatus : null,
    metallic_texture: textureRequests.metallic_texture ? metallicStatus : null,
    emission_texture: textureRequests.emission_texture ? emissionStatus : null,
    ao_texture: textureRequests.ao_texture ? aoStatus : null,
  };

  // Apply the material's UV transform (`uv1_scale` / `uv1_offset`) to
  // every loaded texture. `applyUVTransform` clones the texture before
  // mutating, so two MeshInstance3D nodes sharing the same path with
  // different scale don't clobber each other. Identity transforms
  // (scale = 1,1 and offset = 0,0) skip the clone and return the
  // original.
  const uvTransform = materialScalars
    ? { scale: materialScalars.uv1Scale, offset: materialScalars.uv1Offset }
    : null;

  const albedoMap = useMemo(
    () => transformedTexture(textureSlots.albedo_texture, uvTransform),
    [textureSlots.albedo_texture, uvTransform]
  );
  const normalMap = useMemo(
    () => transformedTexture(textureSlots.normal_texture, uvTransform),
    [textureSlots.normal_texture, uvTransform]
  );
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

  // If any requested slot resolved to `missing`, surface the FIRST
  // missing path as the placeholder label. Listing more than one would
  // bury the user under text.
  const firstMissingPath = useMemo(() => {
    for (const slot of TEXTURE_PROPERTIES) {
      const result = textureSlots[slot];
      const requested = textureRequests[slot];
      if (result && result.status === 'missing' && requested) {
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

  // Unresolved mesh (no mesh, external GLB, missing SubResource): magenta
  // wireframe placeholder.
  if (!meshResource) {
    return (
      <mesh
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        visible={visible}
        castShadow={castShadow}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={0xff00ff} wireframe />
      </mesh>
    );
  }

  // Missing texture: magenta placeholder material + floating drei <Text>
  // showing the missing path.
  if (firstMissingPath !== null) {
    return (
      <group
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        visible={visible}
      >
        <mesh castShadow={castShadow} receiveShadow>
          <MeshGeometry resource={meshResource} />
          <meshStandardMaterial color="magenta" />
        </mesh>
        <InternalTextLabel
          text={`${firstMissingPath} missing`}
          position={[0, 1.2, 0]}
          fontSize={0.18}
          outlineWidth={0.01}
        />
      </group>
    );
  }

  return (
    <mesh
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      castShadow={castShadow}
      receiveShadow
    >
      <MeshGeometry resource={meshResource} />
      <MaterialSlot
        scalars={materialScalars}
        albedoMap={albedoMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        metalnessMap={metalnessMap}
        emissiveMap={emissiveMap}
        aoMap={aoMap}
        shadowSide={shadowFlags.shadowSide}
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

interface MaterialSlotProps {
  scalars: StandardMaterial3DScalars | null;
  albedoMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  /** Override for shadow-pass side culling (Godot DOUBLE_SIDED cast_shadow). */
  shadowSide?: THREE.Side;
  /** R3F attach key — `material-0` for multi-surface meshes. */
  attach?: string;
}

function MaterialSlot({
  scalars,
  albedoMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  emissiveMap,
  aoMap,
  shadowSide,
  attach,
}: MaterialSlotProps) {
  if (!scalars) {
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
  // normalScale is a THREE.Vector2; we materialize one matching the
  // parsed scalar so the meshStandardMaterial slot picks it up on render.
  const normalScale = new THREE.Vector2(scalars.normalScale.x, scalars.normalScale.y);
  // The material's shader needs to be recompiled whenever the set of
  // active texture maps changes — three.js bakes `USE_MAP` / `USE_NORMALMAP`
  // / etc. into shader defines at first compile, so adding a texture
  // after the material has already rendered without one leaves the
  // sampler unused (renders white). Keying the material on which slots
  // are populated forces R3F to construct a fresh material when textures
  // arrive asynchronously via `useResource`, picking up the right defines.
  const slotKey =
    `${albedoMap ? 'a' : '-'}` +
    `${normalMap ? 'n' : '-'}` +
    `${roughnessMap ? 'r' : '-'}` +
    `${metalnessMap ? 'm' : '-'}` +
    `${emissiveMap ? 'e' : '-'}` +
    `${aoMap ? 'o' : '-'}`;
  return (
    <meshStandardMaterial
      key={slotKey}
      attach={attach}
      color={scalars.color}
      metalness={scalars.metalness}
      roughness={scalars.roughness}
      transparent={scalars.transparent}
      opacity={scalars.opacity}
      blending={scalars.blending}
      side={scalars.side}
      shadowSide={shadowSide ?? null}
      map={albedoMap ?? null}
      normalMap={normalMap ?? null}
      normalScale={normalScale}
      roughnessMap={roughnessMap ?? null}
      metalnessMap={metalnessMap ?? null}
      emissiveMap={emissiveMap ?? null}
      aoMap={aoMap ?? null}
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

function resolveStandardMaterial(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!ref) return undefined;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'StandardMaterial3D') return undefined;
  return resource;
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
