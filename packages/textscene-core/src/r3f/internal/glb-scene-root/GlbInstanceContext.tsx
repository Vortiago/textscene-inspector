/**
 * Carries the node that instances a GLB to the `GLBSceneRoot` of that GLB: its inline override
 * children and the visibility parent it passes on. The instancing node and the synthesised
 * `GLBSceneRoot` are two components, so the root cannot see that node. In Godot that node is the
 * GLB root.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { LiveNode } from '../../../resources/liveNode';
import type { ResourceResult } from '../../../resources/useResource';
import { parseNode3D } from '../../../nodes/base/node3d/parser';
import { useUniqueNamePaths } from '../../useUniqueNames';
import { liftOverrideChildren } from './glbNodeOverrides';
import { visibilityParentOf } from '../../../godot/scene/visibilityParent';
import { useVisibilityParent } from '../../visibilityRange/VisibilityParentContext';
import { useInstancedScenePaths } from '../../contexts/InstancedScenePathsContext';

/** What the node that instances a GLB hands to the GLB root. */
interface GlbInstance {
  /** Its own properties, which a `GODOT_single_root` GLB's node 0 takes as the root. */
  rawProperties: Readonly<Record<string, string>>;
  /** Its inline override children, which target nodes inside the GLB. */
  overrides: readonly LiveNode[];
  /** The visibility parent the GLB root passes on to its nodes, or null for none. */
  visibilityParent: string | null;
  /** The scenes that enclose the instancing node, which authored the `overrides`. */
  hostScenePaths: readonly string[];
  /**
   * The GLB the instancing node loaded, for the order of its own children. Absent for a GLB opened
   * as the scene, which loads its own.
   */
  glb?: ResourceResult<THREE.Object3D>;
}

/** The GLB root as Godot holds it: the node that instances the GLB, or the scene's root. */
export interface GlbRoot extends GlbInstance {
  /** Null outside the dispatcher, where nothing can name a node as a parent. */
  path: string | null;
}

/** Null for a GLB opened as the scene itself, which no node instances. */
const GlbInstanceContext = createContext<GlbInstance | null>(null);
GlbInstanceContext.displayName = 'GlbInstanceContext';

const SCENE_ROOT: GlbInstance = {
  rawProperties: Object.freeze({}),
  overrides: [],
  visibilityParent: null,
  hostScenePaths: [],
};

/** The node that instances this GLB, or, for a GLB opened as the scene, its own root at `nodePath`. */
export function useGlbRoot(nodePath: string | null): GlbRoot {
  const instance = useContext(GlbInstanceContext);
  return useMemo(() => ({ ...(instance ?? SCENE_ROOT), path: nodePath }), [instance, nodePath]);
}

interface GlbInstanceProviderProps {
  /** The node that instances the GLB. */
  node: LiveNode;
  path: string;
  /** The GLB this node loaded. Without it, the GLB root loads its own. */
  glb?: ResourceResult<THREE.Object3D>;
  children: ReactNode;
}

export function GlbInstanceProvider({ node, path, glb, children }: GlbInstanceProviderProps) {
  // The GLB root is a Node3D in Godot, so it passes on a visibility parent.
  const inherited = useVisibilityParent();
  const uniquePaths = useUniqueNamePaths(path);
  const hostScenePaths = useInstancedScenePaths();
  const own = parseNode3D(
    { type: 'node', attributes: { name: node.name } },
    node.rawProperties
  ).visibility_parent;
  const visibilityParent = visibilityParentOf(path, own, inherited, uniquePaths);
  const instance = useMemo(
    () => ({
      rawProperties: node.rawProperties,
      overrides: liftOverrideChildren(node.children),
      visibilityParent,
      hostScenePaths,
      glb,
    }),
    [node.rawProperties, node.children, visibilityParent, hostScenePaths, glb]
  );
  return <GlbInstanceContext.Provider value={instance}>{children}</GlbInstanceContext.Provider>;
}
