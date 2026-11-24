import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import { liveNodePathOf } from '../../../scene/nodePathWalk.js';
import type { Scene } from '../../../scene/openScene.js';
import { createExternalStore, type ExternalStore } from '../../../utils/externalStore.js';
import { useAnimationTransport } from '../../contexts/AnimationTransportContext.js';
import { useExpandedRows } from '../SceneTreeViewer/expandedRows.js';
import {
  UNWRITTEN_PATH_STORE,
  useOptionalSelection,
  useSelectedNodePathStore,
} from '../../contexts/SelectionContext.js';
import { useExternalStoreValue } from '../../hooks/createExternalStore.js';
import { nearestHandle } from '../../hostSelection/HostSelection.js';

/** The selected node and the hovered tree row. The view outlines the hovered one, else the selected one. */
export interface PreviewSelection {
  selected: NodeHandle | null;
  select(node: NodeHandle | null): void;
  /** Selects the node at a live path, or its nearest ancestor with a handle. Null selects none. */
  selectPath(path: string | null): void;
  /** Hovers the node at a live path, as `selectPath` finds it. Null hovers none. */
  hoverPath(path: string | null): void;
  /** A store, not a field: the pointer moves over rows often, and only the view reads it. */
  hovered: ExternalStore<NodeHandle | null>;
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
  // Never-set state, so the factory runs once per provider.
  const [hovered] = useState(() => createExternalStore<NodeHandle | null>(null));
  useDropOnLeave(scene, current, select);
  useDropHoverOnLeave(scene, hovered);
  useShowInPanel(current);
  useDriveAnimation(current);
  const value = useMemo<PreviewSelection>(
    () => ({
      selected: current,
      select,
      selectPath: (path) => select(path === null ? null : nearestHandle(scene, path)),
      hoverPath: (path) => hovered.set(path === null ? null : nearestHandle(scene, path)),
      hovered,
    }),
    [current, select, scene, hovered]
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

// A row removed under the pointer gets no mouseleave, and a new scene removes every row.
function useDropHoverOnLeave(scene: Scene, hovered: ExternalStore<NodeHandle | null>): void {
  useEffect(() => {
    const stopObserving = scene.observe(null, () => {
      if (hovered.get()?.isInsideTree() === false) hovered.set(null);
    });
    return () => {
      stopObserving();
      hovered.set(null);
    };
  }, [scene, hovered]);
}

/** The panel shows the selected row with its ancestors expanded. */
function useShowInPanel(selected: NodeHandle | null): void {
  const { reveal } = useExpandedRows();
  const path = liveNodePathOf(selected?.path);
  // Keyed on the path alone, so only a new selection expands rows: a collapse by hand holds.
  useLayoutEffect(() => {
    if (path !== null) reveal(path);
  }, [path, reveal]);
}

/** The animation tab and the transport follow the selection, not the hover (ADR-0012). */
function useDriveAnimation(selected: NodeHandle | null): void {
  const { setActivePath } = useAnimationTransport();
  const path = liveNodePathOf(selected?.path);
  useEffect(() => setActivePath(path), [path, setActivePath]);
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

/** Hovers the node at a live path through the shell. Outside one, nothing hears it. */
export function useHoverPath(): (path: string | null) => void {
  return usePreviewSelection()?.hoverPath ?? NO_SELECT;
}

/** F frames the selection (node_3d_editor_plugin.cpp:4886): a hover takes the view's keys, focus ends it. */
export function HoverReleasesViewFocus({ viewArea }: { viewArea: RefObject<HTMLElement | null> }) {
  const preview = usePreviewSelection();
  useEffect(() => {
    const area = viewArea.current;
    if (!preview || !area) return undefined;
    const { hovered, hoverPath } = preview;
    const endHover = () => {
      if (hovered.get()) hoverPath(null);
    };
    area.addEventListener('focusin', endHover);
    const unsubscribe = hovered.subscribe(() => {
      const focused = document.activeElement;
      if (hovered.get() && focused instanceof HTMLElement && area.contains(focused)) focused.blur();
    });
    return () => {
      area.removeEventListener('focusin', endHover);
      unsubscribe();
    };
  }, [preview, viewArea]);
  return null;
}

/** The node the view outlines: the hovered row's, else the selected one. Null outside a shell. */
export function useOutlinedNode(): NodeHandle | null {
  const preview = usePreviewSelection();
  const hovered = useExternalStoreValue(preview?.hovered ?? NO_HOVER);
  return hovered ?? preview?.selected ?? null;
}

/** The live path of the selected node: the shell's selection inside one, else the panel's alone. */
export function useSelectedPath(): string | null {
  const preview = usePreviewSelection();
  const panelStore = useSelectedNodePathStore();
  // Inside a shell that store holds what the view outlines, a hovered row too, so it reads none.
  const panelPath = useExternalStoreValue(preview ? UNWRITTEN_PATH_STORE : panelStore);
  return preview ? liveNodePathOf(preview.selected?.path) : panelPath;
}

const NO_HOVER = createExternalStore<NodeHandle | null>(null);
