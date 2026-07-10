/**
 * Per-panel "active camera" state.
 *
 * `activeCameraPath === null` means the user is in free-orbit mode and
 * the R3F canvas uses its own `<PerspectiveCamera makeDefault>`. When
 * set to a node path, the canvas switches `state.camera` to the Camera3D
 * node at that path (or one of its descendant cameras).
 *
 * The action buttons live in `<NodeDetailsPanel>` for Camera3D-selected
 * nodes; the canvas reads `activeCameraPath` and uses `useThree().set`
 * to swap.
 *
 * WI-UX-7: also carries a reset handler so the toolbar's "Reset Camera"
 * button can frame the orbit-controls back to its default. The canvas
 * registers its `OrbitControls.reset` via `registerResetHandler`; the
 * toolbar calls `resetCamera()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';

/** One-shot 2D framing request: frame the Canvas2DStage on a Camera2D's view. */
export interface Frame2DRequest {
  /** View center in Godot canvas pixels. */
  center: { x: number; y: number };
  /** Stage magnification. */
  zoom: number;
  /** Monotonic id so the stage can re-apply identical consecutive requests. */
  requestId: number;
}

export interface CameraControlContextValue {
  activeCameraPath: string | null;
  switchToCamera: (path: string) => void;
  returnToFreeView: () => void;
  /**
   * Latest 2D framing request (consumed by `<Canvas2DStage>`); null until a
   * 2D camera is "used". One-shot: the stage applies it once per requestId
   * and the user keeps free pan/zoom afterwards.
   */
  frame2D: Frame2DRequest | null;
  requestFrame2D: (view: { center: { x: number; y: number }; zoom: number }) => void;
  /**
   * Frame the orbit-controls back to its initial state. No-op when no
   * canvas has registered a reset handler yet (e.g. during the brief
   * mount window before `<TscnCanvas>`'s effect runs).
   */
  resetCamera: () => void;
  /**
   * Called from `<TscnCanvas>` so the toolbar's reset button can drive
   * the canvas's `<OrbitControls>`. Returns an unregister callback so
   * the canvas can drop the handler on unmount.
   *
   * Implementation detail: the handler is stored in a ref so consumers
   * (the toolbar) don't re-render every time the canvas's
   * useEffect re-runs.
   */
  registerResetHandler: (handler: () => void) => () => void;
  /**
   * Capture the current 3D viewport as a PNG data URL (#224). Returns
   * `null` when no canvas has registered a handler yet (e.g. in 2D mode,
   * or during the brief mount window before `<TscnCanvas>`'s effect runs).
   */
  takeScreenshot: () => string | null;
  /**
   * Called from `<TscnCanvas>` so the toolbar's screenshot button can pull
   * a frame from the canvas's WebGLRenderer. Mirrors `registerResetHandler`.
   */
  registerScreenshotHandler: (handler: () => string | null) => () => void;
}

const CameraControlContext = createContext<CameraControlContextValue | null>(null);
CameraControlContext.displayName = 'CameraControlContext';

/**
 * A canvas-registered handler slot (reset, screenshot, …): the handler lives
 * in a ref so registration never re-renders consumers, and the returned
 * unregister only clears the slot if it still holds THAT handler (a newer
 * canvas may have replaced it before the old one unmounts).
 */
function useHandlerSlot<T>(): {
  ref: MutableRefObject<T | null>;
  register: (handler: T) => () => void;
} {
  const ref = useRef<T | null>(null);
  const register = useCallback((handler: T) => {
    ref.current = handler;
    return () => {
      if (ref.current === handler) {
        ref.current = null;
      }
    };
  }, []);
  return { ref, register };
}

export interface CameraControlProviderProps {
  children: ReactNode;
}

export function CameraControlProvider({ children }: CameraControlProviderProps) {
  const [activeCameraPath, setActiveCameraPath] = useState<string | null>(null);
  const [frame2D, setFrame2D] = useState<Frame2DRequest | null>(null);
  const frame2DIdRef = useRef(0);

  const switchToCamera = useCallback((path: string) => {
    setActiveCameraPath(path);
  }, []);

  const requestFrame2D = useCallback(
    (view: { center: { x: number; y: number }; zoom: number }) => {
      frame2DIdRef.current += 1;
      setFrame2D({ ...view, requestId: frame2DIdRef.current });
    },
    []
  );

  const returnToFreeView = useCallback(() => {
    setActiveCameraPath(null);
  }, []);

  const { ref: resetHandlerRef, register: registerResetHandler } = useHandlerSlot<() => void>();
  const resetCamera = useCallback(() => {
    resetHandlerRef.current?.();
  }, [resetHandlerRef]);

  const { ref: screenshotHandlerRef, register: registerScreenshotHandler } =
    useHandlerSlot<() => string | null>();
  const takeScreenshot = useCallback(() => {
    return screenshotHandlerRef.current?.() ?? null;
  }, [screenshotHandlerRef]);

  const value = useMemo<CameraControlContextValue>(
    () => ({
      activeCameraPath,
      switchToCamera,
      returnToFreeView,
      frame2D,
      requestFrame2D,
      resetCamera,
      registerResetHandler,
      takeScreenshot,
      registerScreenshotHandler,
    }),
    [
      activeCameraPath,
      switchToCamera,
      returnToFreeView,
      frame2D,
      requestFrame2D,
      resetCamera,
      registerResetHandler,
      takeScreenshot,
      registerScreenshotHandler,
    ]
  );

  return (
    <CameraControlContext.Provider value={value}>{children}</CameraControlContext.Provider>
  );
}

export function useCameraControl(): CameraControlContextValue {
  const value = useContext(CameraControlContext);
  if (value === null) {
    throw new Error(
      'useCameraControl must be used inside a <TscnPreviewShell> (CameraControlProvider).'
    );
  }
  return value;
}

/** Optional variant — returns null instead of throwing when no provider is mounted. */
export function useOptionalCameraControl(): CameraControlContextValue | null {
  return useContext(CameraControlContext);
}
