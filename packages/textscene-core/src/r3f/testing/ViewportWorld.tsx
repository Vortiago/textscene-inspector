import type { ReactNode } from 'react';
import { WorldEnvironmentScope, type WorldKind } from '../environment/WorldEnvironmentScope';
import { ViewportDescriptionProvider } from '../viewportRender/viewportDescriptionContext';
import { gameViewportDescription } from '../viewportRender/viewportDescription';

/** The description a SubViewport's pass gives its world in these tests: the game's rules. */
const SUB_VIEWPORT = gameViewportDescription(null);

/** The root with the root's description, or a SubViewport's world inside its pass's description. */
export function ViewportWorld({ world, children }: { world: WorldKind; children: ReactNode }) {
  const scope = <WorldEnvironmentScope world={world}>{children}</WorldEnvironmentScope>;
  if (world === 'root') return scope;
  return <ViewportDescriptionProvider description={SUB_VIEWPORT}>{scope}</ViewportDescriptionProvider>;
}
