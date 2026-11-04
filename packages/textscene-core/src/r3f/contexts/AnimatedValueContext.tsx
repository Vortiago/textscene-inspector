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

const NO_VISIBILITY: ReadonlyMap<string, boolean> = new Map();

/** Joins paths into one effect key: a node name cannot hold a null character. */
const NO_PATH_CHARACTER = '\0';

/**
 * The `visible` an AnimationPlayer drives on the nodes at `paths`, by path: only the paths with a
 * driven value are in the map. It changes with a driven value, not with each frame of one.
 */
export function useAnimatedVisibility(paths: readonly string[]): ReadonlyMap<string, boolean> {
  const registry = useAnimatedValueRegistry();
  const [visible, setVisible] = useState(NO_VISIBILITY);
  const key = paths.join(NO_PATH_CHARACTER);
  useEffect(() => {
    setVisible(NO_VISIBILITY);
    const stops = key
      .split(NO_PATH_CHARACTER)
      .filter(Boolean)
      .map((path) =>
        registry.subscribe(animatedValueKey(path, 'visible'), (value) =>
          setVisible((previous) => withPushedVisible(previous, path, value))
        )
      );
    return () => stops.forEach((stop) => stop());
  }, [registry, key]);
  return visible;
}

/**
 * `values` with `key` set to the `visible` a pushed tuple holds, or removed for a released one. The
 * same map where nothing changes, so a steady push re-renders nothing.
 */
export function withPushedVisible<K>(
  values: ReadonlyMap<K, boolean>,
  key: K,
  value: readonly number[] | null
): ReadonlyMap<K, boolean> {
  const visible = value === null ? undefined : value[0] !== 0;
  if (values.get(key) === visible) return values;
  const next = new Map(values);
  if (visible === undefined) next.delete(key);
  else next.set(key, visible);
  return next;
}
