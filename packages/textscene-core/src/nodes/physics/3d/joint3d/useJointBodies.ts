/**
 * The world transforms a Joint3D gizmo draws from: the joint, and each body its `node_a` and
 * `node_b` name (`joint_3d_gizmo_plugin.cpp:325-337`).
 */

import { useMemo } from 'react';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes.js';
import { resolveRelativePath } from '../../../../godot/string/nodePath.js';
import type { Transform3D } from '../../../../godot/math/transform3d.js';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext.js';
import { useDrawnWorldTransforms } from '../../../../r3f/gizmo/useDrawnWorldTransforms.js';
import { resolveLiveEntry } from '../../../../r3f/liveSceneTree.js';
import { useSharedLiveTree } from '../../../../r3f/useLiveSceneTree.js';
import { useUniqueNamePaths } from '../../../../r3f/useUniqueNames.js';
import type { Joint3DProperties } from './types.js';

export interface JointBodies {
  joint: Transform3D;
  /** Null when `node_a` names no Node3D. */
  bodyA: Transform3D | null;
  /** Null when `node_b` names no Node3D. */
  bodyB: Transform3D | null;
}

/**
 * The bodies of the joint at the enclosing node path, or null while neither body resolves or the
 * joint itself is not drawn: Godot draws nothing for such a joint (`:335-337`).
 */
export function useJointBodies({ node_a: nodeA, node_b: nodeB }: Joint3DProperties): JointBodies | null {
  const jointPath = useNodePath();
  const uniquePaths = useUniqueNamePaths(jointPath);
  const liveTree = useSharedLiveTree();
  const bodyPaths = useMemo(() => {
    const bodyPath = (relative: string | undefined): string | null => {
      if (jointPath === null || relative === undefined) return null;
      const path = resolveRelativePath(jointPath, relative, uniquePaths);
      if (path === null || liveTree === null) return path;
      const type = resolveLiveEntry(path, liveTree.roots, liveTree.ctx)?.node.type;
      return type !== undefined && descendsFromClass(type, 'Node3D') ? path : null;
    };
    return [jointPath, bodyPath(nodeA), bodyPath(nodeB)];
  }, [jointPath, uniquePaths, liveTree, nodeA, nodeB]);

  const [joint, bodyA, bodyB] = useDrawnWorldTransforms(bodyPaths);
  if (!joint || (!bodyA && !bodyB)) return null;
  return { joint, bodyA: bodyA ?? null, bodyB: bodyB ?? null };
}
