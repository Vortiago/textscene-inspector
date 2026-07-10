/**
 * Per-panel selection state: selected node path, expanded/hidden tree sets,
 * and the path→Object3D ref-map. Provided by `<TscnPreviewShell>`; each shell
 * instance owns its own state so two panels cannot corrupt each other.
 *
 * Hover lives OUTSIDE this context's React state (WI-213): `hoveredNodePath`
 * changes on every pointer move over the viewport, but only `<HoverHighlight>`
 * ever reads it — every node wrapper and every tree row used to re-render on
 * each hover change anyway, because a React Context re-renders every consumer
 * on ANY change to its value. `hoverStore` is a ref-based external store
 * (`createExternalStore`) instead: writers (`TreeNode`, the viewport pointer
 * handlers) call `.set()`, which never triggers a React re-render on its own;
 * `useHoveredNodePath()` is the one place that subscribes to it.
 *
 * Paths are slash-joined node names without a leading `./` — see R3F-contracts.md.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type * as THREE from 'three';
import { createExternalStore, useExternalStoreValue, type ExternalStore } from '../hooks/createExternalStore.js';

export interface SelectionContextValue {
  selectedNodePath: string | null;
  expandedNodePaths: ReadonlySet<string>;
  hiddenNodePaths: ReadonlySet<string>;
  /**
   * Ref-based external store backing `hoveredNodePath` (WI-213) — see the
   * module doc comment. Read it via `useHoveredNodePath()`; write it via
   * `hoverStore.set(path)` directly (the reference is stable across
   * renders, so it's safe to depend on in a `useCallback` deps array).
   */
  hoverStore: ExternalStore<string | null>;
  setSelectedNodePath: (path: string | null) => void;
  toggleExpandedNodePath: (path: string) => void;
  setExpandedNodePaths: (paths: ReadonlySet<string>) => void;
  toggleHidden: (path: string) => void;
  clearHidden: () => void;
  /**
   * Reset all selection-derived state in one call: selected/hovered
   * paths, expanded set, hidden set, and the `nodeObjectMap` ref-map.
   * Used by `<TscnPreviewShell>` on scene-graph swap so stale state
   * from the previous scene (e.g. a BoxHelper targeting an unmounted
   * Object3D, see WI-UX-5) does not leak into the new scene.
   */
  clearAll: () => void;
  /**
   * Mutable map from TSCN node path → its wrapping THREE.Object3D as
   * mounted by `NodeDispatcher`. Consumers (e.g. SelectionHighlight)
   * look up the Object3D for `selectedNodePath` to attach a BoxHelper.
   * Mutations happen via `registerNodeObject` / `unregisterNodeObject`
   * inside ref callbacks; render-phase reads should treat it as a
   * snapshot since the underlying Map is the same instance across
   * renders (stored in a useRef).
   */
  nodeObjectMap: Map<string, THREE.Object3D>;
  /**
   * The reverse of `nodeObjectMap` (WI-213): wrapping THREE.Object3D → its
   * TSCN node path. Populated by the SAME `registerNodeObject` calls. Lets
   * the viewport's ONE delegated pointer handler recover "which node did
   * this raycasted mesh belong to" (`resolvePathFromObject`) by walking the
   * hit object's OWN THREE parent chain, instead of every node needing its
   * own pointer-event handlers (the O(meshes × depth) picking cost the
   * delegation replaces).
   */
  objectPathMap: WeakMap<THREE.Object3D, string>;
  registerNodeObject: (path: string, object: THREE.Object3D) => void;
  unregisterNodeObject: (path: string) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);
SelectionContext.displayName = 'SelectionContext';

export interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);
  // Lazy-init idiom for a value that must stay a STABLE reference for the
  // lifetime of this provider instance (see the module doc comment) — a
  // plain `useRef(createExternalStore(null))` would still call the factory
  // on every render even though only the first result is ever kept.
  const hoverStoreRef = useRef<ExternalStore<string | null> | null>(null);
  if (hoverStoreRef.current === null) {
    hoverStoreRef.current = createExternalStore<string | null>(null);
  }
  const hoverStore = hoverStoreRef.current;
  const [expandedNodePaths, setExpandedNodePathsState] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const [hiddenNodePaths, setHiddenNodePathsState] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );

  const toggleExpandedNodePath = useCallback((path: string) => {
    setExpandedNodePathsState((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const setExpandedNodePaths = useCallback((paths: ReadonlySet<string>) => {
    setExpandedNodePathsState(new Set(paths));
  }, []);

  const toggleHidden = useCallback((path: string) => {
    setHiddenNodePathsState((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const clearHidden = useCallback(() => {
    setHiddenNodePathsState(new Set());
  }, []);

  const nodeObjectMapRef = useRef<Map<string, THREE.Object3D>>(
    new Map<string, THREE.Object3D>()
  );
  const objectPathMapRef = useRef<WeakMap<THREE.Object3D, string>>(
    new WeakMap<THREE.Object3D, string>()
  );

  const registerNodeObject = useCallback(
    (path: string, object: THREE.Object3D) => {
      // A duplicate-named sibling (or any other same-path re-registration
      // without an intervening unmount) must not leave the PREVIOUS
      // object's reverse-map entry stale — that entry would otherwise keep
      // resolving to a path the object no longer owns.
      const previous = nodeObjectMapRef.current.get(path);
      if (previous && previous !== object) {
        objectPathMapRef.current.delete(previous);
      }
      nodeObjectMapRef.current.set(path, object);
      objectPathMapRef.current.set(object, path);
    },
    []
  );

  const unregisterNodeObject = useCallback((path: string) => {
    const object = nodeObjectMapRef.current.get(path);
    if (object) objectPathMapRef.current.delete(object);
    nodeObjectMapRef.current.delete(path);
  }, []);

  const clearAll = useCallback(() => {
    setSelectedNodePath(null);
    hoverStore.set(null);
    setExpandedNodePathsState(new Set());
    setHiddenNodePathsState(new Set());
    nodeObjectMapRef.current.clear();
    // objectPathMapRef is intentionally NOT reset here: unlike nodeObjectMap
    // (keyed by path string, so a stale entry could wrongly satisfy a NEW
    // scene's lookup for the same path), objectPathMap is keyed by the
    // Object3D instance itself. The old scene's objects are unmounted and
    // dereferenced on a scene swap, so their entries become unreachable and
    // get garbage-collected — WeakMap has no `.clear()` because it's never
    // needed for correctness, only (moot here) for forcing early GC.
  }, [hoverStore]);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedNodePath,
      hoverStore,
      expandedNodePaths,
      hiddenNodePaths,
      setSelectedNodePath,
      toggleExpandedNodePath,
      setExpandedNodePaths,
      toggleHidden,
      clearHidden,
      clearAll,
      nodeObjectMap: nodeObjectMapRef.current,
      objectPathMap: objectPathMapRef.current,
      registerNodeObject,
      unregisterNodeObject,
    }),
    [
      selectedNodePath,
      hoverStore,
      expandedNodePaths,
      hiddenNodePaths,
      toggleExpandedNodePath,
      setExpandedNodePaths,
      toggleHidden,
      clearHidden,
      clearAll,
      registerNodeObject,
      unregisterNodeObject,
    ]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const value = useContext(SelectionContext);
  if (value === null) {
    throw new Error(
      'useSelection must be used inside a <TscnPreviewShell> (SelectionProvider). ' +
        'See R3F-contracts.md §3.'
    );
  }
  return value;
}

/**
 * Same as `useSelection`, but returns `null` when there is no provider
 * in scope. Use from canvas-internal components that can be mounted
 * either inside the full `<TscnPreviewShell>` or by standalone tests of
 * the canvas — `useSelection`'s hard throw breaks those test paths.
 */
export function useOptionalSelection(): SelectionContextValue | null {
  return useContext(SelectionContext);
}

/**
 * Fallback store used only when no `<SelectionProvider>` is mounted at all
 * (standalone canvas tests). Module-level and shared is safe here — a real
 * `<TscnPreviewShell>` always has its own per-panel `hoverStore`, so this
 * constant is never written to by production code.
 */
const NO_PROVIDER_HOVER_STORE = createExternalStore<string | null>(null);

/**
 * The hovered node path (WI-213). Subscribes ONLY this component to hover
 * changes via the ref-based `hoverStore` — reading `hoveredNodePath` off
 * `useSelection()` directly would re-render on every selection/expand/hide
 * change too, and (before this store existed) every consumer re-rendered on
 * every hover change, even ones that never read it.
 */
export function useHoveredNodePath(): string | null {
  const selection = useOptionalSelection();
  return useExternalStoreValue(selection?.hoverStore ?? NO_PROVIDER_HOVER_STORE);
}
