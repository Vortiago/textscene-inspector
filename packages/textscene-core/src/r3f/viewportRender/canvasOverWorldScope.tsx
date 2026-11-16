/**
 * Marks the canvas mount of a 3D sub-viewport. The world's portal mounts the same children, so a
 * nested sub-viewport, which both workspaces mount, must draw in the world's mount alone.
 */
import { createContext, useContext, type ReactNode } from 'react';

const CanvasOverWorldScope = createContext(false);
CanvasOverWorldScope.displayName = 'CanvasOverWorldScope';

export function CanvasOverWorldScopeProvider({ children }: { children: ReactNode }) {
  return <CanvasOverWorldScope.Provider value={true}>{children}</CanvasOverWorldScope.Provider>;
}

export function useInCanvasOverWorld(): boolean {
  return useContext(CanvasOverWorldScope);
}
