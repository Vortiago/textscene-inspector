import { createContext, useContext, type ReactNode } from 'react';

/** The In-game root viewport, the root window: empty, so each node below keeps its live path. */
export const ROOT_VIEWPORT_PATH = '';

const EnclosingViewportContext = createContext<string | null>(null);
EnclosingViewportContext.displayName = 'EnclosingViewportContext';

export function EnclosingViewportProvider({ path, children }: { path: string; children: ReactNode }) {
  return <EnclosingViewportContext.Provider value={path}>{children}</EnclosingViewportContext.Provider>;
}

/** @canonical The viewport a node renders in */
export function useEnclosingViewportPath(): string | null {
  return useContext(EnclosingViewportContext);
}
