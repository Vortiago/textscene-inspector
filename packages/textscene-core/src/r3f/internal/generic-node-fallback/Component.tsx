/**
 * `<GenericNodeFallback>`: an invisible group for a node type with no registered component
 * (ADR-0008). It positions its children and draws nothing. The SceneTreeViewer lists the type.
 * It does not read `visible`, so a hidden unregistered node keeps drawing its children.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { placeholderUserData } from './placeholderUserData';

export function GenericNodeFallback({ node, children }: NodeComponentProps) {
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(node.properties as Node3DProperties),
    [node.properties]
  );

  const userData = placeholderUserData(node);

  // paint-order-safe: both fallbacks render no pixels of their own, only
  // dispatched children, each of which brings its own canvas-item wrapper.
  // A 2D type has no Node3D transform, so a plain group leaves the 2D framing alone.
  if (node.type.endsWith('2D')) {
    return (
      <group name={node.name} userData={userData}>
        {children}
      </group>
    );
  }

  // paint-order-safe: children only, as above. The lenient parser falls back to the base `Node`
  // parse, which reads `transform` (nodes/node/parser.ts), so an unknown 3D type places children.
  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale} userData={userData}>
      {children}
    </group>
  );
}
