import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import { livePathOf, ROOT_WINDOW_PREFIX } from '../../../scene/nodePathWalk.js';
import type { Scene } from '../../../scene/openScene.js';
import { withAncestorsExpanded } from '../../../utils/nodePath.js';
import { useOptionalSelection } from '../../contexts/SelectionContext.js';
import { nearestHandle } from '../../hostSelection/HostSelection.js';

/** The node the shell selects, which it hands the view as `selected`. */
export interface PreviewSelection {
  selected: NodeHandle | null;
  select(node: NodeHandle | null): void;
  /** Selects the node at a live path, or its nearest ancestor with a handle. Null selects none. */
  selectPath(path: string | null): void;
}

const PreviewSelectionContext = createContext<PreviewSelection | null>(null);
PreviewSelectionContext.displayName = 'PreviewSelectionContext';

interface PreviewSelectionProviderProps {
  scene: Scene;
  /** The host's selection. Given, the shell selects nothing itself and tells the host through `onSelect`. */
  selected?: NodeHandle | null;
  onSelect?: (node: NodeHandle | null) => void;
  children: ReactNode;
}

export function PreviewSelectionProvider({
  scene,
  selected,
  onSelect,
  children,
}: PreviewSelectionProviderProps) {
  const [own, setOwn] = useState<NodeHandle | null>(null);
  const isHostOwned = selected !== undefined;
  const current = isHostOwned ? selected : own;
  const select = useCallback(
    (node: NodeHandle | null) => {
      if (!isHostOwned) setOwn(node);
      onSelect?.(node);
    },
    [isHostOwned, onSelect]
  );
  useDropOnLeave(scene, current, select);
  useShowInPanel(current);
  const value = useMemo<PreviewSelection>(
    () => ({
      selected: current,
      select,
      selectPath: (path) => select(path === null ? null : nearestHandle(scene, path)),
    }),
    [current, select, scene]
  );
  return <PreviewSelectionContext.Provider value={value}>{children}</PreviewSelectionContext.Provider>;
}

// Godot drops a node from the editor selection as it leaves the tree (editor_data.cpp:1216, 1249).
function useDropOnLeave(scene: Scene, selected: NodeHandle | null, select: (node: null) => void): void {
  useEffect(() => {
    if (selected === null) return undefined;
    return scene.observe(null, () => {
      if (!selected.isInsideTree()) select(null);
    });
  }, [scene, selected, select]);
}

/** The panel shows the selected row with its ancestors expanded, and the view outlines it. */
function useShowInPanel(selected: NodeHandle | null): void {
  const panel = useOptionalSelection();
  const path = selected?.path.startsWith(ROOT_WINDOW_PREFIX) ? livePathOf(selected.path) : null;
  // A ref, so only a new selection expands rows: a collapse by hand holds.
  const panelRef = useRef(panel);
  useLayoutEffect(() => {
    panelRef.current = panel;
  }, [panel]);
  useLayoutEffect(() => {
    const current = panelRef.current;
    if (!current) return;
    current.setSelectedNodePath(path);
    if (path === null) return;
    const expanded = withAncestorsExpanded(current.expandedNodePaths, path);
    if (expanded !== current.expandedNodePaths) current.setExpandedNodePaths(expanded);
  }, [path]);
}

/** Null outside a shell. */
export function usePreviewSelection(): PreviewSelection | null {
  return useContext(PreviewSelectionContext);
}

/** Selects the node at a live path: through the shell inside one, else in the panel alone. */
export function useSelectPath(): (path: string | null) => void {
  const preview = usePreviewSelection();
  const panel = useOptionalSelection();
  return preview?.selectPath ?? panel?.setSelectedNodePath ?? NO_SELECT;
}

const NO_SELECT = (): void => {};
