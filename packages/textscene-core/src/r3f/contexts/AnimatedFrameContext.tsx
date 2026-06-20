/**
 * Registry for AnimationPlayer-driven sprite `frame` values (ADR-0016).
 *
 * THREE's AnimationMixer drives transforms only (ADR-0011), so an AnimationPlayer
 * `value` track targeting `Sprite2D:frame` (a sprite-sheet flipbook) can't go
 * through the mixer. Instead the active player *pushes* the sampled frame to the
 * target sprite: each sprite registers a setter keyed by its node path, and the
 * player calls `set(path, frame)` while playing (`null` to release).
 *
 * The context value is stable (a ref-backed registry), so pushes are imperative
 * and never re-render consumers — only the target sprite's own setter (with a
 * functional bail) re-renders, and only when its frame actually changes.
 */

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

/** Receives the animated frame index, or `null` when the driver releases it. */
export type FrameSetter = (frame: number | null) => void;

export interface AnimatedFrameRegistry {
  /** A target sprite registers its frame setter under its node path. */
  register(nodePath: string, setter: FrameSetter): void;
  /** Pass the same setter so a stale cleanup can't drop a successor's entry. */
  unregister(nodePath: string, setter: FrameSetter): void;
  /** The active driver pushes a sampled frame (or `null` to release). */
  set(nodePath: string, frame: number | null): void;
}

const NOOP: AnimatedFrameRegistry = {
  register: () => {},
  unregister: () => {},
  set: () => {},
};

const AnimatedFrameContext = createContext<AnimatedFrameRegistry>(NOOP);

export function useAnimatedFrameRegistry(): AnimatedFrameRegistry {
  return useContext(AnimatedFrameContext);
}

export function AnimatedFrameProvider({ children }: { children: ReactNode }) {
  const setters = useRef(new Map<string, FrameSetter>()).current;
  const registry = useMemo<AnimatedFrameRegistry>(
    () => ({
      register: (nodePath, setter) => setters.set(nodePath, setter),
      unregister: (nodePath, setter) => {
        if (setters.get(nodePath) === setter) setters.delete(nodePath);
      },
      set: (nodePath, frame) => setters.get(nodePath)?.(frame),
    }),
    [setters]
  );
  return <AnimatedFrameContext.Provider value={registry}>{children}</AnimatedFrameContext.Provider>;
}
