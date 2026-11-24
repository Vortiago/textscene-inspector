import type { FreelookControl, FreelookState } from '../freelook.js';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode,
} from 'react';

export interface ViewportActionsContextValue {
  /** Null while the canvas draws through the editor camera. */
  previewedCameraPath: string | null;
  previewCamera: (path: string) => void;
  endCameraPreview: () => void;
  /** The 3D canvas registers its freelook here, and gets the cleanup. */
  registerFreelook: (control: FreelookControl) => () => void;
  /** The 3D canvas's freelook state, or null with no 3D canvas. Stable until the state changes. */
  freelookState: () => FreelookState | null;
  /** Calls `listener` on each new freelook state, and when a canvas registers or leaves. */
  subscribeFreelook: (listener: () => void) => () => void;
}

const ViewportActionsContext = createContext<ViewportActionsContextValue | null>(null);
ViewportActionsContext.displayName = 'ViewportActionsContext';

/**
 * A handler slot in a ref, so a registration re-renders no consumer. The
 * cleanup clears the slot only while it holds that handler, since a newer
 * canvas may replace it before the old one unmounts. A consumer that must know
 * when the slot fills subscribes, as `useSyncExternalStore` does.
 */
function useHandlerSlot<T>(): {
  ref: MutableRefObject<T | null>;
  register: (handler: T) => () => void;
  subscribe: (listener: () => void) => () => void;
} {
  const ref = useRef<T | null>(null);
  const listeners = useRef(new Set<() => void>());
  const notify = useCallback(() => {
    for (const listener of listeners.current) listener();
  }, []);
  const register = useCallback(
    (handler: T) => {
      ref.current = handler;
      notify();
      return () => {
        if (ref.current === handler) {
          ref.current = null;
          notify();
        }
      };
    },
    [notify]
  );
  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  return { ref, register, subscribe };
}

export interface ViewportActionsProviderProps {
  children: ReactNode;
  /** A Camera3D node path to look through on mount. */
  initialPreviewedCameraPath?: string | null;
}

export function ViewportActionsProvider({
  children,
  initialPreviewedCameraPath = null,
}: ViewportActionsProviderProps) {
  const [previewedCameraPath, setPreviewedCameraPath] = useState<string | null>(initialPreviewedCameraPath);

  const previewCamera = useCallback((path: string) => {
    setPreviewedCameraPath(path);
  }, []);

  const endCameraPreview = useCallback(() => {
    setPreviewedCameraPath(null);
  }, []);

  const {
    ref: freelookRef,
    register: registerFreelook,
    subscribe: subscribeFreelookSlot,
  } = useHandlerSlot<FreelookControl>();
  const freelookState = useCallback(() => freelookRef.current?.getState() ?? null, [freelookRef]);
  const subscribeFreelook = useCallback(
    (listener: () => void) => {
      // The canvas in the slot changes with the viewport mode, so the state subscription follows it.
      let unsubscribeState = freelookRef.current?.subscribe(listener);
      const unsubscribeSlot = subscribeFreelookSlot(() => {
        unsubscribeState?.();
        unsubscribeState = freelookRef.current?.subscribe(listener);
        listener();
      });
      return () => {
        unsubscribeSlot();
        unsubscribeState?.();
      };
    },
    [freelookRef, subscribeFreelookSlot]
  );

  const value = useMemo<ViewportActionsContextValue>(
    () => ({
      previewedCameraPath,
      previewCamera,
      endCameraPreview,
      registerFreelook,
      freelookState,
      subscribeFreelook,
    }),
    [previewedCameraPath, previewCamera, endCameraPreview, registerFreelook, freelookState, subscribeFreelook]
  );

  return <ViewportActionsContext.Provider value={value}>{children}</ViewportActionsContext.Provider>;
}

/** The 3D canvas's freelook state, live, or null with no provider or no 3D canvas. */
export function useFreelookState(): FreelookState | null {
  const actions = useContext(ViewportActionsContext);
  const freelookState = actions?.freelookState ?? noFreelookState;
  return useSyncExternalStore(actions?.subscribeFreelook ?? subscribeToNothing, freelookState, freelookState);
}

const subscribeToNothing = (): (() => void) => () => {};
const noFreelookState = (): null => null;

/** The viewport actions, or null when no provider is mounted. */
export function useOptionalViewportActions(): ViewportActionsContextValue | null {
  return useContext(ViewportActionsContext);
}
