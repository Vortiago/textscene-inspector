/**
 * Registers the `visible` property of each node and frame of a GLB with the AnimatedValue registry
 * (ADR-0016), under each Godot path below the instancing node. The player pushes a sampled
 * `visible` track there, and the hook returns the values it holds: a node by its object, and a
 * Skeleton3D or BoneAttachment3D by its path below the GLB root, since its value governs every
 * object below it and combines with the value of each.
 */

import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { godotNodePaths } from '../../../resources/formats/glb/godotNodes';
import { joinPath } from '../../../utils/nodePath';
import {
  animatedValueKey,
  useAnimatedValueRegistry,
  withPushedVisible,
} from '../../contexts/AnimatedValueContext';
import type { GlbObjectEntry } from './glbHierarchy';
import { glbFrames } from './glbPathLookup';

/** Keyed by the object of a node, or by the frame's path below the GLB root. */
export type AnimatedVisible = ReadonlyMap<THREE.Object3D | string, boolean>;

/** The one empty map, so a GLB with nothing pushed keeps its identity between renders. */
const NONE: AnimatedVisible = new Map();

interface VisibleTarget {
  /** The Godot path the player pushes under. */
  path: string;
  key: THREE.Object3D | string;
}

/** Each Godot path of the GLB a pushed `visible` can name. A mesh that holds children has two. */
function visibleTargets(entries: readonly GlbObjectEntry[], rootPath: string): VisibleTarget[] {
  const nodes = entries.flatMap(({ object }) =>
    godotNodePaths(object).map((path) => ({ path: joinPath(rootPath, path), key: object }))
  );
  const frames = glbFrames(entries).map(({ path }) => ({ path: joinPath(rootPath, path), key: path }));
  return [...nodes, ...frames];
}

/**
 * The `visible` values the player holds for the nodes and frames of the GLB.
 *
 * @canonical A `visible` value track on a node of an instanced GLB
 */
export function useAnimatedGlbVisibility(
  entries: readonly GlbObjectEntry[],
  rootPath: string | null
): AnimatedVisible {
  const registry = useAnimatedValueRegistry();
  const [values, setValues] = useState<AnimatedVisible>(NONE);
  useEffect(() => {
    if (rootPath === null) return;
    const unsubscribes = visibleTargets(entries, rootPath).map(({ path, key }) =>
      registry.subscribe(animatedValueKey(path, 'visible'), (value) =>
        setValues((current) => withPushedVisible(current, key, value))
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [entries, registry, rootPath]);
  return values;
}
