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

/** One-shot 2D framing request: frame the Canvas2DStage on a Camera2D's view. */
interface Frame2DRequest {
  /** The view centre in Godot canvas pixels. */
  center: { x: number; y: number };
  /** Stage magnification. */
  zoom: number;
  /** Monotonic, so the stage re-applies two identical requests in a row. */
  requestId: number;
}

export interface ViewportActionsContextValue {
  /** Null while the canvas draws through the editor camera. */
  previewedCameraPath: string | null;
  previewCamera: (path: string) => void;
  endCameraPreview: () => void;
  /**
   * The latest 2D framing request, null until a 2D camera is used. The stage
   * applies it once per requestId, and free pan and zoom follow.
   */
  frame2D: Frame2DRequest | null;
  requestFrame2D: (view: { center: { x: number; y: number }; zoom: number }) => void;
  /**
   * True the first time a stage claims `requestId`, false after. The request
   * outlives a stage that unmounts, so a remount must not replay it.
   */
  claimFrame2D: (requestId: number) => boolean;
  /**
   * Ends any camera preview and any freelook toggle, and returns the editor camera to its initial pose.
   * The pose waits until a canvas registers a reset handler.
   */
  resetCamera: () => void;
  /** `<TscnCanvas>` registers its `<GodotEditorControls>` reset here, and gets the cleanup. */
  registerResetHandler: (handler: () => void) => () => void;
  /** `<TscnCanvas>` registers its canvas's freelook here, and gets the cleanup. */
  registerFreelook: (control: FreelookControl) => () => void;
  /** Starts or ends the freelook toggle of the 3D canvas. It does nothing before one registers. */
  toggleFreelook: () => void;
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
  /**
   * A Camera3D node path to activate on mount, from a deep link. A scene
   * switch ends the preview, so it frames only the linked scene.
   */
  initialPreviewedCameraPath?: string | null;
}

export function ViewportActionsProvider({
  children,
  initialPreviewedCameraPath = null,
}: ViewportActionsProviderProps) {
  const [previewedCameraPath, setPreviewedCameraPath] = useState<string | null>(initialPreviewedCameraPath);
  const [frame2D, setFrame2D] = useState<Frame2DRequest | null>(null);
  const frame2DIdRef = useRef(0);
  /** Written only by `claimFrame2D`. Request ids start at 1, so 0 claims nothing. */
  const claimedFrame2DIdRef = useRef(0);

  const previewCamera = useCallback((path: string) => {
    setPreviewedCameraPath(path);
  }, []);

  const requestFrame2D = useCallback((view: { center: { x: number; y: number }; zoom: number }) => {
    frame2DIdRef.current += 1;
    setFrame2D({ ...view, requestId: frame2DIdRef.current });
  }, []);

  const claimFrame2D = useCallback((requestId: number) => {
    if (requestId <= claimedFrame2DIdRef.current) return false;
    claimedFrame2DIdRef.current = requestId;
    return true;
  }, []);

  const endCameraPreview = useCallback(() => {
    setPreviewedCameraPath(null);
  }, []);

  const {
    ref: freelookRef,
    register: registerFreelook,
    subscribe: subscribeFreelookSlot,
  } = useHandlerSlot<FreelookControl>();
  const { ref: resetHandlerRef, register: registerResetHandler } = useHandlerSlot<() => void>();
  const resetCamera = useCallback(() => {
    endCameraPreview();
    // A flight would carry the camera off the pose the reset restores.
    if (freelookRef.current?.getState().isToggled) freelookRef.current.toggle();
    resetHandlerRef.current?.();
  }, [endCameraPreview, freelookRef, resetHandlerRef]);

  const toggleFreelook = useCallback(() => freelookRef.current?.toggle(), [freelookRef]);
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
      frame2D,
      requestFrame2D,
      claimFrame2D,
      resetCamera,
      registerResetHandler,
      registerFreelook,
      toggleFreelook,
      freelookState,
      subscribeFreelook,
    }),
    [
      previewedCameraPath,
      previewCamera,
      endCameraPreview,
      frame2D,
      requestFrame2D,
      claimFrame2D,
      resetCamera,
      registerResetHandler,
      registerFreelook,
      toggleFreelook,
      freelookState,
      subscribeFreelook,
    ]
  );

  return <ViewportActionsContext.Provider value={value}>{children}</ViewportActionsContext.Provider>;
}

/** The 3D canvas's freelook state, live, or null with no provider or no 3D canvas. */
export function useFreelookState(): FreelookState | null {
  const actions = useContext(ViewportActionsContext);
  const freelookState = actions?.freelookState ?? noFreelookState;
  return useSyncExternalStore(actions?.subscribeFreelook ?? subscribeToNothing, freelookState, freelookState);
}

/**
 * One boolean of the 3D canvas's freelook state, or null with no provider or no 3D canvas. A
 * primitive, so its reader does not re-render on a speed change, which a trackpad sends per frame.
 */
function useFreelookBoolean(key: 'isToggled' | 'isAvailable'): boolean | null {
  const actions = useContext(ViewportActionsContext);
  const freelookState = actions?.freelookState ?? noFreelookState;
  const read = (): boolean | null => freelookState()?.[key] ?? null;
  return useSyncExternalStore(actions?.subscribeFreelook ?? subscribeToNothing, read, read);
}

export function useIsFreelookToggled(): boolean | null {
  return useFreelookBoolean('isToggled');
}

export function useIsFreelookAvailable(): boolean | null {
  return useFreelookBoolean('isAvailable');
}

const subscribeToNothing = (): (() => void) => () => {};
const noFreelookState = (): null => null;

/** The viewport actions, or null when no provider is mounted. */
export function useOptionalViewportActions(): ViewportActionsContextValue | null {
  return useContext(ViewportActionsContext);
}
