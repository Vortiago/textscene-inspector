/**
 * The seam between `<ParallaxBackground>` and its `<ParallaxLayer>` children. As
 * in Godot's `_update_scroll`, a layer registers its group and the background
 * poses it once per frame, outside React: a per-frame `setState` would re-render
 * every frame.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ParallaxLayerMotion } from './parallaxScroll';
import type { Vector2 } from '../../base/node2d/types';

/** What a layer hands the background so it can be posed. */
export interface RegisteredParallaxLayer {
  /** The wrapper the scroll delta is written to (never the authored `<Node2D>`). */
  group: THREE.Object3D;
  motion: ParallaxLayerMotion;
  /** `orig_offset`: the authored position, recorded on ENTER_TREE in Godot. */
  origin: { position: Vector2 };
}

export interface ParallaxScrollRegistry {
  /**
   * The ParallaxBackground's own node path. A layer registers only as a direct
   * child: context also reaches a layer under an intervening Node2D, which Godot
   * never poses.
   */
  parentPath: string;
  /** Returns its own disposer, so a layer can register straight from an effect. */
  register: (path: string, layer: RegisteredParallaxLayer) => () => void;
}

const ParallaxScrollContext = createContext<ParallaxScrollRegistry | null>(null);
ParallaxScrollContext.displayName = 'ParallaxScrollContext';

export function ParallaxScrollProvider({
  value,
  children,
}: {
  value: ParallaxScrollRegistry;
  children: ReactNode;
}) {
  return <ParallaxScrollContext.Provider value={value}>{children}</ParallaxScrollContext.Provider>;
}

/** The enclosing ParallaxBackground's registry, or null outside one. */
export function useParallaxScrollRegistry(): ParallaxScrollRegistry | null {
  return useContext(ParallaxScrollContext);
}
