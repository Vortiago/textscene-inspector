/**
 * <GenericNodeFallback> — invisible transform-only group for any TSCN node
 * type that has no registered render component.
 *
 * Render intent (ADR-0008): a node either has a visible renderer or renders as
 * an invisible <group> that positions its children and draws nothing itself.
 * The fallback is the second kind — it never draws a placeholder. Unsupported
 * types stay discoverable through the SceneTreeViewer (which lists every node
 * with its type), not by cluttering the viewport.
 *
 * The node's Node3D transform is applied when present so children land in the
 * right place. That includes genuinely-unknown types: the lenient parser falls
 * back to the base `Node` parse, which parses `transform` too (nodes/node/parser.ts),
 * so an unregistered 3D node still positions its children correctly. What it does
 * NOT carry is `visible` — a hidden unregistered node keeps drawing, which is one
 * reason to register a type even when it renders transform-only.
 * 2D-typed nodes carry no Node3D transform and render as a plain group so a
 * flat 2D scene's framing isn't disturbed.
 *
 * `userData.isPlaceholder` is retained as a marker for tooling (e.g. a future
 * "not rendered" affordance in the tree) and for tests.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';

export function GenericNodeFallback({ node, children }: NodeComponentProps) {
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(node.properties as Node3DProperties),
    [node.properties]
  );

  const userData = { isPlaceholder: true, nodeType: node.type, nodeName: node.name };

  if (node.type.endsWith('2D')) {
    return (
      <group name={node.name} userData={userData}>
        {children}
      </group>
    );
  }

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale} userData={userData}>
      {children}
    </group>
  );
}
