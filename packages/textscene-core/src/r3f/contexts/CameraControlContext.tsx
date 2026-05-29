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
  type ReactNode,
} from 'react';

export interface CameraControlContextValue {
  activeCameraPath: string | null;
  switchToCamera: (path: string) => void;
  returnToFreeView: () => void;
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
}

const CameraControlContext = createContext<CameraControlContextValue | null>(null);
CameraControlContext.displayName = 'CameraControlContext';

export interface CameraControlProviderProps {
  children: ReactNode;
}

export function CameraControlProvider({ children }: CameraControlProviderProps) {
  const [activeCameraPath, setActiveCameraPath] = useState<string | null>(null);
  const resetHandlerRef = useRef<(() => void) | null>(null);

  const switchToCamera = useCallback((path: string) => {
    setActiveCameraPath(path);
  }, []);

  const returnToFreeView = useCallback(() => {
    setActiveCameraPath(null);
  }, []);

  const registerResetHandler = useCallback((handler: () => void) => {
    resetHandlerRef.current = handler;
    return () => {
      if (resetHandlerRef.current === handler) {
        resetHandlerRef.current = null;
      }
    };
  }, []);

  const resetCamera = useCallback(() => {
    resetHandlerRef.current?.();
  }, []);

  const value = useMemo<CameraControlContextValue>(
    () => ({
      activeCameraPath,
      switchToCamera,
      returnToFreeView,
      resetCamera,
      registerResetHandler,
    }),
    [activeCameraPath, switchToCamera, returnToFreeView, resetCamera, registerResetHandler]
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
