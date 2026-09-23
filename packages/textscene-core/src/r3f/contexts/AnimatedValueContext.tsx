/**
 * The registry for AnimationPlayer value tracks that are not transforms
 * (ADR-0016, ADR-0017). The mixer drives transforms only (ADR-0011), so the
 * player pushes each sampled value to a setter the target registered. The
 * stable context re-renders only the target whose value changes.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNodePath } from './NodePathContext';

/**
 * Receives a flat tuple whose arity the property decides: `frame` is `[n]`,
 * `modulate` `[r,g,b,a]`, `size` `[x,y,z]`. `null` means the driver released it.
 */
export type ValueSetter = (value: number[] | null) => void;

export interface AnimatedValueRegistry {
  /**
   * A target registers its setter under its node path and property, since one
   * node animates several properties.
   */
  register(nodePath: string, property: string, setter: ValueSetter): void;
  /** Takes the same setter, so a stale cleanup cannot drop a successor's entry. */
  unregister(nodePath: string, property: string, setter: ValueSetter): void;
  /** The active driver pushes a sampled tuple, or `null` to release. */
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

/**
 * The decoded pushed value of this node's `property`, or `null` when none is
 * pushed and the authored value shows. `decode` is read through a ref, so an
 * inline lambda does not re-subscribe every render.
 */
export function useAnimatedValue<T>(property: string, decode: (tuple: number[]) => T): T | null {
  const nodePath = useNodePath();
  const registry = useAnimatedValueRegistry();
  const [value, setValue] = useState<T | null>(null);
  const decodeRef = useRef(decode);
  decodeRef.current = decode;
  useEffect(() => {
    if (nodePath === null) return;
    const setter: ValueSetter = (v) => setValue(v === null ? null : decodeRef.current(v));
    registry.register(nodePath, property, setter);
    return () => registry.unregister(nodePath, property, setter);
  }, [nodePath, registry, property]);
  return value;
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
