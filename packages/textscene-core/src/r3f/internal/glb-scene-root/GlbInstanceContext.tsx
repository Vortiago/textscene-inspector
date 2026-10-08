/**
 * Carries the node that instances a GLB to the `GLBSceneRoot` of that GLB: its inline override
 * children, its path and the visibility parent it passes on. `InstancedSceneSubtree` renders the
 * GLB in a separate synthesised scene, so the root cannot see that node.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LiveNode } from '../../../resources/liveNode';
import { parseNode3D } from '../../../nodes/base/node3d/parser';
import { useUniqueNamePaths } from '../../useUniqueNames';
import { resolveVisibilityParent, useVisibilityParent } from '../../visibilityRange/VisibilityParentContext';

export interface GlbInstance {
  /** Its inline override children, which target nodes inside the GLB. */
  overrides: readonly LiveNode[];
  /** Its node path, which in Godot is the GLB root's. */
  path: string;
  /** The visibility parent the GLB root passes on to its nodes, or null for none. */
  visibilityParent: string | null;
}

/** Null for a GLB opened as the scene itself, which no node instances. */
const GlbInstanceContext = createContext<GlbInstance | null>(null);
GlbInstanceContext.displayName = 'GlbInstanceContext';

export function useGlbInstance(): GlbInstance | null {
  return useContext(GlbInstanceContext);
}

export interface GlbInstanceProviderProps {
  /** The node that instances the GLB. */
  node: LiveNode;
  path: string;
  children: ReactNode;
}

export function GlbInstanceProvider({ node, path, children }: GlbInstanceProviderProps) {
  // The GLB root is a Node3D in Godot, so it passes on its own visibility parent, or else the
  // one it inherits (`node_3d.cpp:1304-1335`).
  const inherited = useVisibilityParent();
  const uniquePaths = useUniqueNamePaths(path);
  const own = parseNode3D(
    { type: 'node', attributes: { name: node.name } },
    node.rawProperties
  ).visibility_parent;
  const visibilityParent = own === undefined ? inherited : resolveVisibilityParent(path, own, uniquePaths);
  const instance = useMemo(
    () => ({ overrides: node.children, path, visibilityParent }),
    [node.children, path, visibilityParent]
  );
  return <GlbInstanceContext.Provider value={instance}>{children}</GlbInstanceContext.Provider>;
}
