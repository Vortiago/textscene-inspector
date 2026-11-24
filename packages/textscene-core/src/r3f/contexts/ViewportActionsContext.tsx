import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ViewportActionsContextValue {
  /** Null while the canvas draws through the editor camera. */
  previewedCameraPath: string | null;
  previewCamera: (path: string) => void;
  endCameraPreview: () => void;
}

const ViewportActionsContext = createContext<ViewportActionsContextValue | null>(null);
ViewportActionsContext.displayName = 'ViewportActionsContext';

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

  const value = useMemo<ViewportActionsContextValue>(
    () => ({
      previewedCameraPath,
      previewCamera,
      endCameraPreview,
    }),
    [previewedCameraPath, previewCamera, endCameraPreview]
  );

  return <ViewportActionsContext.Provider value={value}>{children}</ViewportActionsContext.Provider>;
}

/** The viewport actions, or null when no provider is mounted. */
export function useOptionalViewportActions(): ViewportActionsContextValue | null {
  return useContext(ViewportActionsContext);
}
