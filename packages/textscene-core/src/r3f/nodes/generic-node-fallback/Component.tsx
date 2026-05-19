/**
 * <GenericNodeFallback> — visible placeholder for any TSCN node type
 * that has no registered component.
 *
 * Renders a small semi-transparent gray cube so unrecognised nodes remain
 * visible in the scene. The node type and name are stored on userData so
 * the inspector panel (WI-R3F-4) can surface them, and so click-to-select
 * (WI-R3F-5) can identify the placeholder by metadata.
 *
 * Per PRD, drei <Text> for the in-scene label is intentionally deferred
 * to WI-R3F-5 integration to avoid bundling a font loader in WI-R3F-3.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';

const FALLBACK_COLOR = 0x999999;
const FALLBACK_SIZE = 0.4;

export function GenericNodeFallback({ node, children }: NodeComponentProps) {
  // Some node types extend Node3D and carry a transform. If they don't,
  // transformFromNode3DProperties returns identity — safe in all cases.
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(node.properties as Node3DProperties),
    [node.properties]
  );

  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ isPlaceholder: true, nodeType: node.type, nodeName: node.name }}
    >
      <mesh name={`${node.name}__placeholder`}>
        <boxGeometry args={[FALLBACK_SIZE, FALLBACK_SIZE, FALLBACK_SIZE]} />
        <meshStandardMaterial color={FALLBACK_COLOR} transparent opacity={0.6} />
      </mesh>
      {children}
    </group>
  );
}
