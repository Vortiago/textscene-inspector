/**
 * The registry for AnimationPlayer value tracks that are not transforms
 * (ADR-0016, ADR-0017). The mixer drives transforms only (ADR-0011), so the
 * player pushes each sampled value to a setter the target registered. The
 * stable context re-renders only the target whose value changes.
 */

import { useEffect, useRef, useState } from 'react';
import { useNodePath } from './NodePathContext';
import { createPushStoreContext, type PushStore } from './pushStore';

/**
 * A flat tuple whose arity the property decides: `frame` is `[n]`, `modulate` `[r,g,b,a]`, `size`
 * `[x,y,z]`. `null` means the driver released it.
 */
export type AnimatedValueRegistry = PushStore<readonly number[]>;

/** The key of a node's property: property names never contain `:`, so this is unambiguous. */
export function animatedValueKey(nodePath: string, property: string): string {
  return `${nodePath}:${property}`;
}

const { Provider: AnimatedValueProvider, useStore: useAnimatedValueRegistry } =
  createPushStoreContext<readonly number[]>('AnimatedValueContext');

export { AnimatedValueProvider, useAnimatedValueRegistry };

/**
 * The decoded pushed value of this node's `property`, or `null` when none is
 * pushed and the authored value shows. `decode` is read through a ref, so an
 * inline lambda does not re-subscribe every render.
 */
export function useAnimatedValue<T>(property: string, decode: (tuple: readonly number[]) => T): T | null {
  return useAnimatedValueAt(useNodePath(), property, decode);
}

/**
 * {@link useAnimatedValue} for the node at `nodePath`, for a caller that renders the node's own
 * provider, where `useNodePath` still answers with the parent's path.
 */
export function useAnimatedValueAt<T>(
  nodePath: string | null,
  property: string,
  decode: (tuple: readonly number[]) => T
): T | null {
  const registry = useAnimatedValueRegistry();
  const [value, setValue] = useState<T | null>(null);
  const decodeRef = useRef(decode);
  decodeRef.current = decode;
  useEffect(() => {
    if (nodePath === null) return;
    return registry.subscribe(animatedValueKey(nodePath, property), (v) =>
      setValue(v === null ? null : decodeRef.current(v))
    );
  }, [nodePath, registry, property]);
  return value;
}
