/**
 * <CSGBox3D> — renders a Godot CSGBox3D as a solid box primitive.
 *
 * CSG boolean operations are NOT applied (ADR-0004): the node renders its
 * base `BoxGeometry(size)` with its StandardMaterial3D, ignoring `operation`.
 * For ld-58 this is exact (every CSG node uses the default union). The
 * material reuses the shared `<StandardMaterialSlot>` so a CSG wall renders
 * identically to a MeshInstance3D wall sharing the same material.
 */

import { useMemo } from 'react';
import type { CSGBox3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { parseStandardMaterial3DScalars } from '../../../../r3f/materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../../../../r3f/materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../../../../r3f/materials/StandardMaterialSlot';

export function CSGBox3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGBox3DProperties;
  const { internalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const scalars = useMemo(() => {
    const sub = resolveStandardMaterial(properties.material, internalResources);
    return sub ? parseStandardMaterial3DScalars(sub.data as Record<string, string>) : null;
  }, [properties.material, internalResources]);

  const { x, y, z } = properties.size;
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
        <boxGeometry args={[x, y, z]} />
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
      {children}
    </group>
  );
}
