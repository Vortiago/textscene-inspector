/**
 * The child nodes a component adds to the ones its y-sort collects, which the scene does not list:
 * a TileMap's layers, which Godot adds as internal front children, and the instances of scene tiles,
 * which it appends. The component states them here, and the one `YSortDispatcher` that
 * `NodeDispatcher` mounts for the node sorts them with its authored children.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';

interface ExtraChildren {
  /** The live path of the node the children belong to, so a sort below it reads none of them. */
  readonly path: string;
  readonly leading: readonly TscnNode[];
  readonly trailing: readonly TscnNode[];
}

const NO_NODES: readonly TscnNode[] = [];
const ExtraChildrenContext = createContext<ExtraChildren | null>(null);
ExtraChildrenContext.displayName = 'YSortExtraChildrenContext';

export function YSortExtraChildrenProvider({
  path,
  leading = NO_NODES,
  trailing = NO_NODES,
  children,
}: {
  path: string;
  leading?: readonly TscnNode[];
  trailing?: readonly TscnNode[];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ path, leading, trailing }), [path, leading, trailing]);
  return <ExtraChildrenContext.Provider value={value}>{children}</ExtraChildrenContext.Provider>;
}

/** `node` with the children its component added in front of and after its own, as the sort collects them. */
export function useWithExtraChildren(node: TscnNode, path: string): TscnNode {
  const extra = useContext(ExtraChildrenContext);
  const isOwn = extra?.path === path;
  return useMemo(() => {
    if (!isOwn || (extra.leading.length === 0 && extra.trailing.length === 0)) return node;
    return { ...node, children: [...extra.leading, ...node.children, ...extra.trailing] };
  }, [isOwn, extra, node]);
}
