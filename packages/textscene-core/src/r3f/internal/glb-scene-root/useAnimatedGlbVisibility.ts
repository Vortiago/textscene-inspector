/**
 * Registers the `visible` property of each node and frame of a GLB with the AnimatedValue registry
 * (ADR-0016), under its Godot path below the instancing node. The player pushes a sampled
 * `visible` track there, and the hook returns the values it holds for the GLB's objects. A
 * Skeleton3D or BoneAttachment3D takes every object below it, as a hidden one hides them.
 */

import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { godotNodePaths } from '../../../resources/formats/glb/godotNodes';
import { joinPath } from '../../../utils/nodePath';
import { useAnimatedValueRegistry } from '../../contexts/AnimatedValueContext';
import { objectsBelowFrame } from './glbFrameOverrides';
import type { GlbObjectEntry } from './glbHierarchy';
import type { GlbNodeLink } from './glbNodeLinks';
import { glbFrames } from './glbPathLookup';

type AnimatedVisible = ReadonlyMap<THREE.Object3D, boolean>;

/** The one empty map, so a GLB with nothing pushed keeps its identity between renders. */
const NONE: AnimatedVisible = new Map();

interface VisibleTarget {
  path: string;
  objects: readonly THREE.Object3D[];
}

/** The objects a pushed `visible` for each Godot path of the GLB drives. */
function visibleTargets(
  entries: readonly GlbObjectEntry[],
  links: readonly GlbNodeLink[],
  rootPath: string
): VisibleTarget[] {
  const nodes = links.flatMap(({ entry, place }) =>
    place.path !== null && godotNodePaths(entry.object).length > 0
      ? [{ path: place.path, objects: [entry.object] }]
      : []
  );
  const frames = glbFrames(entries).map((frame) => ({
    path: joinPath(rootPath, frame.path),
    objects: objectsBelowFrame(entries, frame),
  }));
  return [...nodes, ...frames];
}

function withValue(
  values: AnimatedVisible,
  objects: readonly THREE.Object3D[],
  value: number[] | null
): AnimatedVisible {
  const next = new Map(values);
  for (const object of objects) {
    if (value === null) next.delete(object);
    else next.set(object, value[0] !== 0);
  }
  return next;
}

export function useAnimatedGlbVisibility(
  entries: readonly GlbObjectEntry[],
  links: readonly GlbNodeLink[],
  rootPath: string | null
): AnimatedVisible {
  const registry = useAnimatedValueRegistry();
  const [values, setValues] = useState<AnimatedVisible>(NONE);
  useEffect(() => {
    if (rootPath === null) return;
    const registered = visibleTargets(entries, links, rootPath).map(({ path, objects }) => {
      const setter = (value: number[] | null) => setValues((current) => withValue(current, objects, value));
      registry.register(path, 'visible', setter);
      return { path, setter };
    });
    return () => {
      for (const { path, setter } of registered) registry.unregister(path, 'visible', setter);
    };
  }, [entries, links, registry, rootPath]);
  return values;
}
