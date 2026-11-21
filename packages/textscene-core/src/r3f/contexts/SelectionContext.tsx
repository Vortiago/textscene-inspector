import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type * as THREE from 'three';
import { createExternalStore, type ExternalStore } from '../../utils/externalStore.js';
import { useExternalStoreValue } from '../hooks/createExternalStore.js';

// Paths are slash-joined node names without a leading `./` (R3F-contracts.md).
export interface SelectionContextValue {
  expandedNodePaths: ReadonlySet<string>;
  /** Sets the path the view outlines. `useSelectedNodePath` and `useIsSelectedPath` read it. */
  setSelectedNodePath: (path: string | null) => void;
  toggleExpandedNodePath: (path: string) => void;
  setExpandedNodePaths: (paths: ReadonlySet<string>) => void;
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
  /** Into `nodeObjectMap` only: a click on the object picks the nearest node registered for picking. */
  registerUnpickableNodeObject: (path: string, object: THREE.Object3D) => void;
  unregisterNodeObject: (path: string) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);
SelectionContext.displayName = 'SelectionContext';

/** The outlined path, a store: it changes per hovered row, and a context change re-renders every consumer. */
const SelectedNodePathStoreContext = createContext<ExternalStore<string | null> | null>(null);
SelectedNodePathStoreContext.displayName = 'SelectedNodePathStoreContext';

export interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  // Never-set state, so the factory runs once per provider.
  const [selectedStore] = useState(() => createExternalStore<string | null>(null));
  const setSelectedNodePath = selectedStore.set;
  const [expandedNodePaths, setExpandedNodePathsState] = useState<ReadonlySet<string>>(
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

  const nodeObjectMapRef = useRef<Map<string, THREE.Object3D>>(new Map<string, THREE.Object3D>());
  const objectPathMapRef = useRef<WeakMap<THREE.Object3D, string>>(new WeakMap<THREE.Object3D, string>());

  const registerNodeObject = useCallback((path: string, object: THREE.Object3D) => {
    // A same-path re-registration, such as a duplicate-named sibling, drops the
    // previous object's reverse entry, which names a path it no longer owns.
    const previous = nodeObjectMapRef.current.get(path);
    if (previous && previous !== object) {
      objectPathMapRef.current.delete(previous);
    }
    nodeObjectMapRef.current.set(path, object);
    objectPathMapRef.current.set(object, path);
  }, []);

  const registerUnpickableNodeObject = useCallback((path: string, object: THREE.Object3D) => {
    const previous = nodeObjectMapRef.current.get(path);
    if (previous) objectPathMapRef.current.delete(previous);
    nodeObjectMapRef.current.set(path, object);
  }, []);

  const unregisterNodeObject = useCallback((path: string) => {
    const object = nodeObjectMapRef.current.get(path);
    if (object) objectPathMapRef.current.delete(object);
    nodeObjectMapRef.current.delete(path);
  }, []);

  const clearAll = useCallback(() => {
    selectedStore.set(null);
    setExpandedNodePathsState(new Set());
    nodeObjectMapRef.current.clear();
    // Not objectPathMapRef: a WeakMap keyed by the Object3D itself, so the old
    // scene's entries become unreachable and are collected. A path key could
    // match the new scene, an object key cannot.
  }, [selectedStore]);

  const value = useMemo<SelectionContextValue>(
    () => ({
      expandedNodePaths,
      setSelectedNodePath,
      toggleExpandedNodePath,
      setExpandedNodePaths,
      clearAll,
      nodeObjectMap: nodeObjectMapRef.current,
      objectPathMap: objectPathMapRef.current,
      registerNodeObject,
      registerUnpickableNodeObject,
      unregisterNodeObject,
    }),
    [
      expandedNodePaths,
      setSelectedNodePath,
      toggleExpandedNodePath,
      setExpandedNodePaths,
      clearAll,
      registerNodeObject,
      registerUnpickableNodeObject,
      unregisterNodeObject,
    ]
  );

  return (
    <SelectionContext.Provider value={value}>
      <SelectedNodePathStoreContext.Provider value={selectedStore}>
        {children}
      </SelectedNodePathStoreContext.Provider>
    </SelectionContext.Provider>
  );
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
 * Whether `path` is the selected node, false with no provider. The component re-renders when this
 * answer flips, so a selection change re-renders the old and the new node alone.
 */
export function useIsSelectedPath(path: string | null): boolean {
  const store = useSelectedNodePathStore();
  const isSelected = useCallback(() => path !== null && store.get() === path, [store, path]);
  return useSyncExternalStore(store.subscribe, isSelected, isSelected);
}

/**
 * `useSelection`, but `null` with no provider, for a canvas component that a
 * test mounts alone.
 */
export function useOptionalSelection(): SelectionContextValue | null {
  return useContext(SelectionContext);
}

/** The store with no `<SelectionProvider>`, which nothing writes. */
const NO_PROVIDER_SELECTED_STORE = createExternalStore<string | null>(null);

/** The store of the path the view outlines, which a reader subscribes to only where it needs it. */
export function useSelectedNodePathStore(): ExternalStore<string | null> {
  return useContext(SelectedNodePathStoreContext) ?? NO_PROVIDER_SELECTED_STORE;
}

/** The path the view outlines, null with none or with no provider. */
export function useSelectedNodePath(): string | null {
  return useExternalStoreValue(useSelectedNodePathStore());
}
