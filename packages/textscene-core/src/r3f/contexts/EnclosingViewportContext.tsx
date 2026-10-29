/**
 * The path of the nearest SubViewport above a node, null at the root viewport. A Camera3D joins the
 * nearest viewport above it (`camera_3d.cpp`, `NOTIFICATION_ENTER_WORLD`: `get_viewport()`), so a
 * world elects each viewport's camera among the cameras that name it.
 */
import { createContext, useContext, type ReactNode } from 'react';

const EnclosingViewportContext = createContext<string | null>(null);
EnclosingViewportContext.displayName = 'EnclosingViewportContext';

export function EnclosingViewportProvider({ path, children }: { path: string; children: ReactNode }) {
  return <EnclosingViewportContext.Provider value={path}>{children}</EnclosingViewportContext.Provider>;
}

/** @canonical The viewport a node renders in */
export function useEnclosingViewportPath(): string | null {
  return useContext(EnclosingViewportContext);
}
