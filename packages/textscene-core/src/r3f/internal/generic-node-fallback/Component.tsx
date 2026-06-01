/**
 * <GenericNodeFallback> — visible placeholder for any TSCN node type
 * that has no registered component.
 *
 * Renders a small semi-transparent gray cube so unrecognised nodes remain
 * visible in the scene, plus a floating drei `<Text>` label showing the
 * node's type and name so users can identify which placeholder is which
 * (WI-R3F-7 / WEB-08).
 *
 * Exception: 2D-typed nodes (type ends in "2D", e.g. GPUParticles2D, Line2D)
 * render as an invisible transform group + their children — NOT a 3D box, which
 * would clutter a flat 2D scene and break the flat-scene camera framing. Their
 * own transform isn't applied (no parser ran for the unregistered type); the
 * node still appears in the scene tree. This keeps unsupported 2D nodes from
 * breaking otherwise-correct 2D scenes.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { InternalTextLabel } from '../../internalTextLabel';

const FALLBACK_COLOR = 0x999999;
const FALLBACK_SIZE = 0.4;
const LABEL_OFFSET_Y = 0.4;

export function GenericNodeFallback({ node, children }: NodeComponentProps) {
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(node.properties as Node3DProperties),
    [node.properties]
  );

  if (node.type.endsWith('2D')) {
    return (
      <group
        name={node.name}
        userData={{ isPlaceholder: true, nodeType: node.type, nodeName: node.name }}
      >
        {children}
      </group>
    );
  }

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
      <InternalTextLabel
        text={`${node.type}: ${node.name}`}
        position={[0, LABEL_OFFSET_Y, 0]}
        fontSize={0.1}
        anchorY="bottom"
      />
      {children}
    </group>
  );
}
