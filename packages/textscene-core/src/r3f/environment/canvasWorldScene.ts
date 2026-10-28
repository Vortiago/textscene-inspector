/**
 * The scene of a 2D canvas's World3D, which every shared-world SubViewport of that canvas draws.
 * Godot's `find_world_3d()` reaches the canvas's one world from each of them
 * (`viewport.cpp:4670-4681`), so their nodes share one scene.
 */

import { createContext, useContext } from 'react';
import type * as THREE from 'three';

/** Written only by `CanvasWorldScope`. Null outside a 2D canvas. */
export const CanvasWorldSceneContext = createContext<THREE.Scene | null>(null);
CanvasWorldSceneContext.displayName = 'CanvasWorldSceneContext';

/** The scene of the enclosing 2D canvas's World3D, or null outside one. */
export function useCanvasWorldScene(): THREE.Scene | null {
  return useContext(CanvasWorldSceneContext);
}
