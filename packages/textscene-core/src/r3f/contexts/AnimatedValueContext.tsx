/**
 * Registry for AnimationPlayer-driven non-transform value tracks (ADR-0016, ADR-0017).
 *
 * THREE's AnimationMixer drives transforms only (ADR-0011), so an AnimationPlayer
 * `value` track targeting a React-derived property — `Sprite2D:frame` (a
 * sprite-sheet flipbook), `Decal:modulate` (a colour fade), `Decal:size` (a box
 * that grows) — can't go through the mixer. Instead the active player *pushes*
 * the sampled value to the target component: each target registers a setter
 * keyed by its node path AND the animated property, and the player calls
 * `set(path, property, value)` while playing (`null` to release).
 *
 * The key is `${nodePath}:${property}` because a single node animates several
 * properties at once (a Decal fades `modulate` and grows `size`). The payload is
 * a flat numeric tuple — `frame` = `[n]`, `modulate` = `[r,g,b,a]`, `size` =
 * `[x,y,z]` — and the consumer interprets the arity by the property it
 * registered for.
 *
 * The context value is stable (a ref-backed registry), so pushes are imperative
 * and never re-render consumers — only the target's own setter (with a
 * functional bail) re-renders, and only when its value actually changes.
 */

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

/** Receives the animated value tuple, or `null` when the driver releases it. */
export type ValueSetter = (value: number[] | null) => void;

export interface AnimatedValueRegistry {
  /** A target registers its setter under its node path + animated property. */
  register(nodePath: string, property: string, setter: ValueSetter): void;
  /** Pass the same setter so a stale cleanup can't drop a successor's entry. */
  unregister(nodePath: string, property: string, setter: ValueSetter): void;
  /** The active driver pushes a sampled value tuple (or `null` to release). */
  set(nodePath: string, property: string, value: number[] | null): void;
}

/** Composite registry key. Property names never contain `:`, so this is unambiguous. */
function keyOf(nodePath: string, property: string): string {
  return `${nodePath}:${property}`;
}

const NOOP: AnimatedValueRegistry = {
  register: () => {},
  unregister: () => {},
  set: () => {},
};

const AnimatedValueContext = createContext<AnimatedValueRegistry>(NOOP);

export function useAnimatedValueRegistry(): AnimatedValueRegistry {
  return useContext(AnimatedValueContext);
}

export function AnimatedValueProvider({ children }: { children: ReactNode }) {
  const setters = useRef(new Map<string, ValueSetter>()).current;
  const registry = useMemo<AnimatedValueRegistry>(
    () => ({
      register: (nodePath, property, setter) => setters.set(keyOf(nodePath, property), setter),
      unregister: (nodePath, property, setter) => {
        const key = keyOf(nodePath, property);
        if (setters.get(key) === setter) setters.delete(key);
      },
      set: (nodePath, property, value) => setters.get(keyOf(nodePath, property))?.(value),
    }),
    [setters]
  );
  return <AnimatedValueContext.Provider value={registry}>{children}</AnimatedValueContext.Provider>;
}
