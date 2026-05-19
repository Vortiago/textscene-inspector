/**
 * <MeshInstance3D> — renders a Godot MeshInstance3D as an R3F <mesh>.
 *
 * Geometry: resolved synchronously from the scene's internal resources
 * (BoxMesh, SphereMesh, PlaneMesh, CylinderMesh, CapsuleMesh, TorusMesh,
 * PrismMesh). GLB / unresolvable references render a magenta wireframe
 * placeholder (matching the imperative renderer's behaviour).
 *
 * Material: synchronously parses StandardMaterial3D scalar properties
 * (albedo color, metallic, roughness, opacity) from the scene's internal
 * resources. External textures route through useResource and the host
 * file provider; until WI-R3F-2 lands they remain 'pending' and the
 * material is rendered without textures.
 *
 * Material precedence (matches Godot): surface_material_override > material_override
 * > mesh's own material > default placeholder.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import type { MeshInstance3DProperties } from '../../../nodes/3d/meshinstance3d/types';
import type { TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import {
  findSubResource,
  useSceneResources,
} from '../../SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { MeshGeometry } from './meshGeometry';
import {
  parseStandardMaterial3DScalars,
  type StandardMaterial3DScalars,
} from './materialScalars';

export function MeshInstance3D({ node }: NodeComponentProps) {
  const properties = node.properties as MeshInstance3DProperties;
  const { internalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const meshResource = useMemo(
    () => resolveMeshSubResource(properties.mesh, internalResources),
    [properties.mesh, internalResources]
  );

  const materialScalars = useMemo(
    () => resolveMaterialScalars(properties, internalResources),
    [properties, internalResources]
  );

  const castShadow = shadowCastingFlag(properties.castShadow);

  // Unresolved (no mesh, external GLB, missing SubResource): render placeholder.
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
      <MaterialSlot scalars={materialScalars} />
    </mesh>
  );
}

interface MaterialSlotProps {
  scalars: StandardMaterial3DScalars | null;
}

function MaterialSlot({ scalars }: MaterialSlotProps) {
  if (!scalars) {
    // Default neutral PBR material matching the imperative renderer.
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

function resolveMaterialScalars(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[]
): StandardMaterial3DScalars | null {
  // Precedence: surface_material_override[0] > material_override > mesh's own material.
  const surfaceRef = properties.surfaceMaterialOverrides?.get(0);
  const candidate = surfaceRef ?? properties.materialOverride ?? findMeshOwnMaterial(properties.mesh, internalResources);
  if (!candidate) return null;

  const parsed = parseResourceReference(candidate);
  if (!parsed || parsed.type !== 'SubResource') return null;

  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'StandardMaterial3D') return null;

  return parseStandardMaterial3DScalars(resource.data as Record<string, string>);
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

function shadowCastingFlag(value: number | undefined): boolean {
  // Godot enum: 0=OFF, 1=ON, 2=DOUBLE_SIDED, 3=SHADOWS_ONLY.
  // 0 / undefined → off; 1-3 → on.
  if (value === undefined || value === 0) return false;
  return true;
}

// Re-export THREE for tests asserting against actual three.js types if needed.
export { THREE };
