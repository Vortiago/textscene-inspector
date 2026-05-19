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
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CameraControlContextValue {
  activeCameraPath: string | null;
  switchToCamera: (path: string) => void;
  returnToFreeView: () => void;
}

const CameraControlContext = createContext<CameraControlContextValue | null>(null);
CameraControlContext.displayName = 'CameraControlContext';

export interface CameraControlProviderProps {
  children: ReactNode;
}

export function CameraControlProvider({ children }: CameraControlProviderProps) {
  const [activeCameraPath, setActiveCameraPath] = useState<string | null>(null);

  const switchToCamera = useCallback((path: string) => {
    setActiveCameraPath(path);
  }, []);

  const returnToFreeView = useCallback(() => {
    setActiveCameraPath(null);
  }, []);

  const value = useMemo<CameraControlContextValue>(
    () => ({ activeCameraPath, switchToCamera, returnToFreeView }),
    [activeCameraPath, switchToCamera, returnToFreeView]
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
