/**
 * The seam between `<ParallaxBackground>` and its `<ParallaxLayer>` children.
 *
 * Godot's `_update_scroll` walks `get_child(i)` and pushes a pose onto every
 * direct `ParallaxLayer`, so the background is the writer and the layers are
 * written to. The same shape here: a layer REGISTERS the group its scroll delta
 * belongs on, and the background poses it once per rendered frame. Nothing flows
 * back up through React, because the scroll is recomputed inside the render that
 * consumes it and a per-frame `setState` would be a re-render per frame.
 *
 * `parentPath` is what keeps the walk to DIRECT children: React context reaches
 * a `ParallaxLayer` nested under an intervening `Node2D` too, and Godot would
 * never pose that one.
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
  /** `orig_offset` — the authored position, recorded on ENTER_TREE in Godot. */
  origin: { position: Vector2 };
}

export interface ParallaxScrollRegistry {
  /** The ParallaxBackground's own node path; a layer registers only if it is a direct child. */
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
