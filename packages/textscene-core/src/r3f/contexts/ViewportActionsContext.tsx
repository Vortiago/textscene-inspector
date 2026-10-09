/**
 * What a panel's toolbar and panels do to its viewport: look through a camera,
 * frame the 2D stage, reset the view and take a screenshot. `activeCameraPath ===
 * null` means free orbit with the canvas's own camera. A node path makes the canvas
 * look through the Camera3D there.
 */

import type { SceneGraph } from '../../core/SceneGraph.js';
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
  /** The view centre in Godot canvas pixels. */
  center: { x: number; y: number };
  /** Stage magnification. */
  zoom: number;
  /** Monotonic, so the stage re-applies two identical requests in a row. */
  requestId: number;
}

export interface ViewportActionsContextValue {
  activeCameraPath: string | null;
  switchToCamera: (path: string) => void;
  returnToFreeView: () => void;
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
   * Frames the camera back to its initial state. Does nothing until a canvas
   * registers a reset handler.
   */
  resetCamera: () => void;
  /** `<TscnCanvas>` registers its `<GodotEditorControls>` reset here, and gets the cleanup. */
  registerResetHandler: (handler: () => void) => () => void;
  /** The active view, 3D or 2D, as a PNG data URL, or `null` before a canvas registers a handler. */
  takeScreenshot: () => string | null;
  /**
   * The active canvas's `ScreenshotBridge` registers its capture here, with the scene graph it has
   * rendered, so a host can tell a frame of the current scene from one of the scene before.
   */
  registerScreenshotHandler: (handler: () => string | null, renderedScene?: SceneGraph | null) => () => void;
  /** Whether a canvas has registered a screenshot handler now. */
  hasScreenshotHandler: () => boolean;
  /** The scene graph the registered handler has rendered, or null with no handler or none given. */
  screenshotScene: () => SceneGraph | null;
  /** Calls `listener` each time a handler registers or leaves. Returns the unsubscribe. */
  subscribeScreenshotHandler: (listener: () => void) => () => void;
}

/** What a canvas registers for a screenshot: the capture, and the scene graph it has rendered. */
interface ScreenshotSource {
  readonly capture: () => string | null;
  readonly renderedScene: SceneGraph | null;
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
   * switch drops back to free orbit, so it frames only the linked scene.
   */
  initialActiveCameraPath?: string | null;
}

export function ViewportActionsProvider({
  children,
  initialActiveCameraPath = null,
}: ViewportActionsProviderProps) {
  const [activeCameraPath, setActiveCameraPath] = useState<string | null>(initialActiveCameraPath);
  const [frame2D, setFrame2D] = useState<Frame2DRequest | null>(null);
  const frame2DIdRef = useRef(0);
  /** Written only by `claimFrame2D`. Request ids start at 1, so 0 claims nothing. */
  const claimedFrame2DIdRef = useRef(0);

  const switchToCamera = useCallback((path: string) => {
    setActiveCameraPath(path);
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

  const returnToFreeView = useCallback(() => {
    setActiveCameraPath(null);
  }, []);

  const { ref: resetHandlerRef, register: registerResetHandler } = useHandlerSlot<() => void>();
  const resetCamera = useCallback(() => {
    resetHandlerRef.current?.();
  }, [resetHandlerRef]);

  const {
    ref: screenshotSourceRef,
    register: registerScreenshotSource,
    subscribe: subscribeScreenshotHandler,
  } = useHandlerSlot<ScreenshotSource>();
  const registerScreenshotHandler = useCallback(
    (capture: () => string | null, renderedScene: SceneGraph | null = null) =>
      registerScreenshotSource({ capture, renderedScene }),
    [registerScreenshotSource]
  );
  const takeScreenshot = useCallback(() => {
    return screenshotSourceRef.current?.capture() ?? null;
  }, [screenshotSourceRef]);
  const hasScreenshotHandler = useCallback(() => screenshotSourceRef.current !== null, [screenshotSourceRef]);
  const screenshotScene = useCallback(
    () => screenshotSourceRef.current?.renderedScene ?? null,
    [screenshotSourceRef]
  );

  const value = useMemo<ViewportActionsContextValue>(
    () => ({
      activeCameraPath,
      switchToCamera,
      returnToFreeView,
      frame2D,
      requestFrame2D,
      claimFrame2D,
      resetCamera,
      registerResetHandler,
      takeScreenshot,
      registerScreenshotHandler,
      hasScreenshotHandler,
      screenshotScene,
      subscribeScreenshotHandler,
    }),
    [
      activeCameraPath,
      switchToCamera,
      returnToFreeView,
      frame2D,
      requestFrame2D,
      claimFrame2D,
      resetCamera,
      registerResetHandler,
      takeScreenshot,
      registerScreenshotHandler,
      hasScreenshotHandler,
      screenshotScene,
      subscribeScreenshotHandler,
    ]
  );

  return <ViewportActionsContext.Provider value={value}>{children}</ViewportActionsContext.Provider>;
}

export function useViewportActions(): ViewportActionsContextValue {
  const value = useContext(ViewportActionsContext);
  if (value === null) {
    throw new Error('useViewportActions must be used inside a <TscnPreviewShell> (ViewportActionsProvider).');
  }
  return value;
}

/** Returns null instead of throwing when no provider is mounted. */
export function useOptionalViewportActions(): ViewportActionsContextValue | null {
  return useContext(ViewportActionsContext);
}
