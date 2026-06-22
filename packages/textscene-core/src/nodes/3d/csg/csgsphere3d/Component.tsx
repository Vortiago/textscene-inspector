/**
 * <CSGSphere3D> — renders a Godot CSGSphere3D as a solid sphere primitive.
 *
 * CSG boolean operations are NOT applied (ADR-0004): the node renders its base
 * `SphereGeometry(radius)` with its StandardMaterial3D, ignoring `operation`.
 * `radial_segments`/`rings` map to three.js width/height segments. The material
 * reuses the shared `<StandardMaterialSlot>`, parallel to CSGBox3D.
 */

import { useMemo } from 'react';
import type { CSGSphere3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { parseStandardMaterial3DScalars } from '../../../../r3f/materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../../../../r3f/materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../../../../r3f/materials/StandardMaterialSlot';

export function CSGSphere3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGSphere3DProperties;
  const { internalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const scalars = useMemo(() => {
    const sub = resolveStandardMaterial(properties.material, internalResources);
    return sub ? parseStandardMaterial3DScalars(sub.data as Record<string, string>) : null;
  }, [properties.material, internalResources]);

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
        <sphereGeometry args={[properties.radius, properties.radialSegments, properties.rings]} />
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
      {children}
    </group>
  );
}
