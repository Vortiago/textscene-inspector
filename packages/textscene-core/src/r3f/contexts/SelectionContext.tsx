/**
 * Per-panel selection state: selected/hovered node paths and expanded tree set.
 * Provided by `<TscnPreviewShell>`; each shell instance owns its own state so
 * two panels cannot corrupt each other.
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

export interface SelectionContextValue {
  selectedNodePath: string | null;
  hoveredNodePath: string | null;
  expandedNodePaths: ReadonlySet<string>;
  hiddenNodePaths: ReadonlySet<string>;
  setSelectedNodePath: (path: string | null) => void;
  setHoveredNodePath: (path: string | null) => void;
  toggleExpandedNodePath: (path: string) => void;
  setExpandedNodePaths: (paths: ReadonlySet<string>) => void;
  toggleHidden: (path: string) => void;
  clearHidden: () => void;
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
  const [hoveredNodePath, setHoveredNodePath] = useState<string | null>(null);
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

  const registerNodeObject = useCallback(
    (path: string, object: THREE.Object3D) => {
      nodeObjectMapRef.current.set(path, object);
    },
    []
  );

  const unregisterNodeObject = useCallback((path: string) => {
    nodeObjectMapRef.current.delete(path);
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedNodePath,
      hoveredNodePath,
      expandedNodePaths,
      hiddenNodePaths,
      setSelectedNodePath,
      setHoveredNodePath,
      toggleExpandedNodePath,
      setExpandedNodePaths,
      toggleHidden,
      clearHidden,
      nodeObjectMap: nodeObjectMapRef.current,
      registerNodeObject,
      unregisterNodeObject,
    }),
    [
      selectedNodePath,
      hoveredNodePath,
      expandedNodePaths,
      hiddenNodePaths,
      toggleExpandedNodePath,
      setExpandedNodePaths,
      toggleHidden,
      clearHidden,
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
