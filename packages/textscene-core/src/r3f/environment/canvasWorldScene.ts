/**
 * The scene of a 2D canvas's World3D, which every shared-world SubViewport of that canvas draws.
 * Godot's `find_world_3d()` reaches the canvas's one world from each of them
 * (`viewport.cpp:4670-4681`), so their nodes share one scene.
 */

import { createContext, useContext, useLayoutEffect } from 'react';
import type * as THREE from 'three';

/** A 2D canvas's World3D. */
export interface CanvasWorld {
  scene: THREE.Scene;
  /** Keeps the world drawn until the returned release runs. */
  hold: () => () => void;
}

/** Written only by `CanvasWorldScope`. Null outside a 2D canvas. */
export const CanvasWorldContext = createContext<CanvasWorld | null>(null);
CanvasWorldContext.displayName = 'CanvasWorldContext';

/** The World3D of the enclosing 2D canvas, or null outside one. */
export function useCanvasWorld(): CanvasWorld | null {
  return useContext(CanvasWorldContext);
}

/**
 * Keeps `world` drawn while the caller is mounted. A world nobody draws applies no Environment,
 * shadow fit or depth prepass, as Godot draws no World3D without a camera into it.
 */
export function useDrawCanvasWorld(world: CanvasWorld | null): void {
  useLayoutEffect(() => world?.hold(), [world]);
}
