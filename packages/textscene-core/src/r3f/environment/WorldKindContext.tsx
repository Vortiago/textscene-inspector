/**
 * Which viewport's world a subtree is in. The canvas's renderer draws the root viewport, so only the
 * root world's Environment sets the renderer's tone curve and mounts the compositor. A sub-viewport's
 * pass renders its own target with its own samples and tone mapping (`subviewport/Component.tsx`).
 */
import { createContext, useContext, type ReactNode } from 'react';

export type WorldKind = 'root' | 'subViewport';

const WorldKindContext = createContext<WorldKind>('root');
WorldKindContext.displayName = 'WorldKindContext';

export function WorldKindProvider({ world, children }: { world: WorldKind; children: ReactNode }) {
  return <WorldKindContext.Provider value={world}>{children}</WorldKindContext.Provider>;
}

export function useWorldKind(): WorldKind {
  return useContext(WorldKindContext);
}
