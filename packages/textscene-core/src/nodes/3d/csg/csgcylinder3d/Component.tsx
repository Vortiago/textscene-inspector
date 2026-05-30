/**
 * <CSGCylinder3D> — renders a Godot CSGCylinder3D as a solid cylinder (or cone).
 *
 * CSG boolean operations are NOT applied (ADR-0004). `cone=true` collapses the
 * top radius to 0. Material reuses the shared `<StandardMaterialSlot>`.
 */

import { useMemo } from 'react';
import type { CSGCylinder3DProperties } from './types';
import type { TscnInternalResource } from '../../../../parser/types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { findSubResource, useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../../resources/SubResourceResolver';
import { parseStandardMaterial3DScalars } from '../../../../r3f/materials/standardMaterialScalars';
import { StandardMaterialSlot } from '../../../../r3f/materials/StandardMaterialSlot';

export function CSGCylinder3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGCylinder3DProperties;
  const { internalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const scalars = useMemo(() => {
    const sub = resolveStandardMaterial(properties.material, internalResources);
    return sub ? parseStandardMaterial3DScalars(sub.data as Record<string, string>) : null;
  }, [properties.material, internalResources]);

  const topRadius = properties.cone ? 0 : properties.radius;
  const visible = properties.visible !== false;

  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[topRadius, properties.radius, properties.height, properties.sides]}
        />
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
      {children}
    </group>
  );
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
