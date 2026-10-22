/**
 * The scene cull keys a node by the path Godot gives it. A GLB's contents sit directly below the
 * node that instances it, while the tree and the selection show them below a synthetic child of
 * that node. A node attached into the GLB maps its selection path back, so the cull and the
 * `visibility_parent` paths authors write agree with the GLB's own objects.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useNodePath } from '../contexts/NodePathContext';

interface CullPathPrefix {
  /** The selection path the attached nodes sit below, such as `Rig/rig`. */
  selection: string;
  /** The path Godot gives that place, such as `Rig`. */
  godot: string;
}

const CullPathContext = createContext<CullPathPrefix | null>(null);
CullPathContext.displayName = 'CullPathContext';

export function CullPathProvider({ selection, godot, children }: CullPathPrefix & { children: ReactNode }) {
  return <CullPathContext.Provider value={{ selection, godot }}>{children}</CullPathContext.Provider>;
}

function toGodotPath(prefix: CullPathPrefix | null, path: string): string {
  if (!prefix || !path.startsWith(`${prefix.selection}/`)) return path;
  return `${prefix.godot}${path.slice(prefix.selection.length)}`;
}

/** `path` as the cull and `visibility_parent` resolution see it. Unchanged outside a mapped place. */
export function useCullPathOf(path: string): string {
  return toGodotPath(useContext(CullPathContext), path);
}

/** The enclosing node's path as the cull sees it, or `null` outside the dispatcher. */
export function useCullPath(): string | null {
  const path = useNodePath();
  const prefix = useContext(CullPathContext);
  return path === null ? null : toGodotPath(prefix, path);
}
