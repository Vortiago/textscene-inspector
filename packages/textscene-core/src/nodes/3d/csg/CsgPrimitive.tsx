/**
 * <CsgPrimitive> — shared render scaffold for the CSG primitive slices.
 *
 * CSG boolean operations are NOT applied (ADR-0004): every CSG node renders as
 * its solid base geometry with its StandardMaterial3D, ignoring `operation`.
 * The transform, material resolution, and shadow-casting mesh shell live here
 * once; each slice supplies only its geometry element. The material reuses the
 * shared `<StandardMaterialSlot>` so a CSG wall renders identically to a
 * MeshInstance3D wall sharing the same material.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties } from '../../base/node3d/types';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseStandardMaterial3DScalars } from '../../../r3f/materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';

interface CsgPrimitiveProps {
  node: TscnNode;
  properties: Node3DProperties & { material?: string };
  /** The slice's geometry element, e.g. `<boxGeometry args={[x, y, z]} />`. */
  geometry: ReactNode;
  children?: ReactNode;
}

export function CsgPrimitive({ node, properties, geometry, children }: CsgPrimitiveProps) {
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
        {geometry}
        <StandardMaterialSlot scalars={scalars} />
      </mesh>
      {children}
    </group>
  );
}
