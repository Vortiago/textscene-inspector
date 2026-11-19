/**
 * The host's side of the view's selection: `selected` sets the node the view outlines, and
 * `onSelect` hears the node a click in the 3D editor view picks.
 */
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import type { NodeHandle } from '../../scene/nodeHandle.js';
import { absolutePathOf, livePathOf } from '../../scene/nodePathWalk.js';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useOptionalSelection } from '../contexts/SelectionContext.js';

export interface HostSelectionProps {
  /** The node the view outlines, or null for none. Given, a click leaves it to the host. */
  selected?: NodeHandle | null;
  /** The node a click in the 3D mode picks, or null for a click on nothing. */
  onSelect?: (node: NodeHandle | null) => void;
  children?: ReactNode;
}

/** What the picker tells the host of a click. Null outside a `HostSelection`. */
export interface HostPick {
  /** The selection path a click picked, or null for a click on nothing. */
  picked(path: string | null): void;
  /** True while the host passes `selected`, so a click changes nothing of the view's own. */
  ownsSelection: boolean;
}

const HostPickContext = createContext<HostPick | null>(null);
HostPickContext.displayName = 'HostPickContext';

export function HostSelection({ selected, onSelect, children }: HostSelectionProps) {
  const scene = useOptionalHierarchy()?.scene;
  // A view with no scene above it has no selection, and draws the empty scene.
  const setSelectedNodePath = useOptionalSelection()?.setSelectedNodePath;
  const ownsSelection = selected !== undefined;
  const selectedPath = selected ? livePathOf(selected.path) : null;

  useLayoutEffect(() => {
    if (ownsSelection) setSelectedNodePath?.(selectedPath);
  }, [ownsSelection, selectedPath, setSelectedNodePath]);

  const pick = useMemo<HostPick>(
    () => ({
      picked(path) {
        onSelect?.(path === null ? null : (scene?.getNodeOrNull(absolutePathOf(path)) ?? null));
      },
      ownsSelection,
    }),
    [onSelect, ownsSelection, scene]
  );
  return <HostPickContext.Provider value={pick}>{children}</HostPickContext.Provider>;
}

export function useHostPick(): HostPick | null {
  return useContext(HostPickContext);
}
