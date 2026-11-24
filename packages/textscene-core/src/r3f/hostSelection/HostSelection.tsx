import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { NodeHandle } from '../../scene/nodeHandle.js';
import { absolutePathOf, liveNodePathOf } from '../../scene/nodePathWalk.js';
import type { Scene } from '../../scene/openScene.js';
import { parentPathOf } from '../../utils/nodePath.js';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { useOptionalSelection } from '../contexts/SelectionContext.js';

export interface HostSelectionProps {
  /** The node the view outlines, or null for none. Given, a click leaves it to the host. */
  selected?: NodeHandle | null;
  /** The node a click in the 3D mode picks, or null for a click on nothing. Null hears no click. */
  onSelect?: ((node: NodeHandle | null) => void) | null;
  children?: ReactNode;
}

/** What the picker tells the host of a click. */
export interface HostPick {
  /** The selection path a click picked, or null for a click on nothing. */
  picked(path: string | null): void;
  /** True while the host passes `selected`, so a click changes nothing of the view's own. */
  ownsSelection: boolean;
}

/** Outside a `HostSelection`, no host hears a click and the view owns its selection. */
const NO_HOST: HostPick = { picked: () => {}, ownsSelection: false };
const HostPickContext = createContext<HostPick>(NO_HOST);
HostPickContext.displayName = 'HostPickContext';

export function HostSelection({ selected, onSelect, children }: HostSelectionProps) {
  const scene = useOptionalHierarchy()?.scene;
  // A view with no scene above it has no selection, and draws the empty scene.
  const setSelectedNodePath = useOptionalSelection()?.setSelectedNodePath;
  const ownsSelection = selected !== undefined;
  const selectedPath = liveNodePathOf(selected?.path);

  useLayoutEffect(() => {
    if (ownsSelection) setSelectedNodePath?.(selectedPath);
  }, [ownsSelection, selectedPath, setSelectedNodePath]);

  // A ref, so a host's new `onSelect` each render leaves the picker's handlers and the node tree alone.
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const pick = useMemo<HostPick>(
    () => ({
      picked(path) {
        onSelectRef.current?.(path === null || !scene ? null : nearestHandle(scene, path));
      },
      ownsSelection,
    }),
    [ownsSelection, scene]
  );
  return <HostPickContext.Provider value={pick}>{children}</HostPickContext.Provider>;
}

// A path the Live scene tree lacks, such as a node inside an imported GLB, reaches the host as its owner.
export function nearestHandle(scene: Scene, path: string): NodeHandle | null {
  for (let at: string | null = path; at; at = parentPathOf(at)) {
    const handle = scene.getNodeOrNull(absolutePathOf(at));
    if (handle) return handle;
  }
  return null;
}

export function useHostPick(): HostPick {
  return useContext(HostPickContext);
}
