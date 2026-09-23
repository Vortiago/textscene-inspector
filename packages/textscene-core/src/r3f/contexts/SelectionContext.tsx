/**
 * A panel's selection state: the selected path, the expanded and hidden sets,
 * and the path to Object3D map. Each shell owns its own. Paths are slash-joined
 * node names without a leading `./` (R3F-contracts.md).
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
   * Hover changes on every pointer move, and a context re-renders every
   * consumer, so hover lives in this ref-based store. `.set()` re-renders
   * nothing, and only `useHoveredNodePath()` subscribes. The reference is stable.
   */
  hoverStore: ExternalStore<string | null>;
  setSelectedNodePath: (path: string | null) => void;
  toggleExpandedNodePath: (path: string) => void;
  setExpandedNodePaths: (paths: ReadonlySet<string>) => void;
  toggleHidden: (path: string) => void;
  clearHidden: () => void;
  /**
   * Resets all selection-derived state and the `nodeObjectMap`, so no state of
   * the previous scene leaks into the next one.
   */
  clearAll: () => void;
  /**
   * Each node path's wrapping THREE.Object3D, as `NodeDispatcher` mounts it.
   * Ref callbacks mutate it, and one Map instance lives across renders, so a
   * render-phase read is a snapshot.
   */
  nodeObjectMap: Map<string, THREE.Object3D>;
  /**
   * The reverse of `nodeObjectMap`. The one delegated pointer handler walks a
   * hit object's parent chain through it, so no node needs its own handlers
   * at O(meshes × depth).
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
  // Never-set state, so the factory runs once per provider.
  const [hoverStore] = useState(() => createExternalStore<string | null>(null));
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
      // A same-path re-registration, such as a duplicate-named sibling, drops the
      // previous object's reverse entry, which names a path it no longer owns.
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
    // Not objectPathMapRef: a WeakMap keyed by the Object3D itself, so the old
    // scene's entries become unreachable and are collected. A path key could
    // match the new scene, an object key cannot.
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
 * `useSelection`, but `null` with no provider, for a canvas component that a
 * test mounts alone.
 */
export function useOptionalSelection(): SelectionContextValue | null {
  return useContext(SelectionContext);
}

/**
 * The store with no `<SelectionProvider>`. It is safe to share, since a real
 * shell always has its own `hoverStore` and never writes here.
 */
const NO_PROVIDER_HOVER_STORE = createExternalStore<string | null>(null);

/**
 * The hovered node path. Only this component subscribes to hover changes, and
 * no selection, expand or hide change re-renders it.
 */
export function useHoveredNodePath(): string | null {
  const selection = useOptionalSelection();
  return useExternalStoreValue(selection?.hoverStore ?? NO_PROVIDER_HOVER_STORE);
}
