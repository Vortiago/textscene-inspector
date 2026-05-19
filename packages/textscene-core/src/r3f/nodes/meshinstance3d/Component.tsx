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

/** Texture slots StandardMaterial3D exposes — checked in this order. */
const TEXTURE_PROPERTIES = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
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

  const materialSubResource = useMemo(
    () => resolveMaterialSubResource(properties, internalResources),
    [properties, internalResources]
  );

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

  const textureSlots = {
    albedo_texture: textureRequests.albedo_texture ? albedoStatus : null,
    normal_texture: textureRequests.normal_texture ? normalStatus : null,
    roughness_texture: textureRequests.roughness_texture ? roughnessStatus : null,
    metallic_texture: textureRequests.metallic_texture ? metallicStatus : null,
    emission_texture: textureRequests.emission_texture ? emissionStatus : null,
  };

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

  const castShadow = shadowCastingFlag(properties.castShadow);

  // Unresolved mesh (no mesh, external GLB, missing SubResource): magenta
  // wireframe placeholder.
  if (!meshResource) {
    return (
      <mesh
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
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
      <group name={node.name} position={position} rotation={rotation} scale={scale}>
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
      castShadow={castShadow}
      receiveShadow
    >
      <MeshGeometry resource={meshResource} />
      <MaterialSlot scalars={materialScalars} albedoMap={textureSlots.albedo_texture?.value} />
    </mesh>
  );
}

interface MaterialSlotProps {
  scalars: StandardMaterial3DScalars | null;
  albedoMap?: THREE.Texture;
}

function MaterialSlot({ scalars, albedoMap }: MaterialSlotProps) {
  if (!scalars) {
    return <meshStandardMaterial color={0xcccccc} metalness={0.3} roughness={0.7} />;
  }
  const transparent = scalars.opacity < 1;
  return (
    <meshStandardMaterial
      color={scalars.color}
      metalness={scalars.metalness}
      roughness={scalars.roughness}
      transparent={transparent}
      opacity={scalars.opacity}
      map={albedoMap ?? null}
    />
  );
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

function resolveMaterialSubResource(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  // Precedence: surface_material_override[0] > material_override > mesh's own material.
  const surfaceRef = properties.surfaceMaterialOverrides?.get(0);
  const candidate =
    surfaceRef ??
    properties.materialOverride ??
    findMeshOwnMaterial(properties.mesh, internalResources);
  if (!candidate) return undefined;

  const parsed = parseResourceReference(candidate);
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

function shadowCastingFlag(value: number | undefined): boolean {
  // Godot enum: 0=OFF, 1=ON, 2=DOUBLE_SIDED, 3=SHADOWS_ONLY.
  if (value === undefined || value === 0) return false;
  return true;
}

export { THREE };
