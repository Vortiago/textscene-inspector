/**
 * The bookkeeping behind the light pass's `register*` calls: the mounted cull tuples, the ordinals
 * taken in each, and the tuples that declared a shadow tint. React state only, no GPU.
 */

import { useCallback, useRef, useState } from 'react';
import {
  compareLightCullKeys,
  lightCullKeyId,
  sameLightCullKey,
  type LightCullKey,
} from './lightCullKey.js';
import type { CanvasLightSlot } from './lightPassContext.js';

/** A counter of declarations, incremented for as long as each one is mounted. */
export function useDeclarationCount(): [number, () => () => void] {
  const [count, setCount] = useState(0);
  const declare = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => Math.max(0, n - 1));
  }, []);
  return [count, declare];
}

const EMPTY_KEYS: readonly LightCullKey[] = [];

function sameKeys(a: readonly LightCullKey[], b: readonly LightCullKey[]): boolean {
  return a.length === b.length && a.every((key, i) => sameLightCullKey(key, b[i]!));
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

/** `useDeclarationCount` per cull tuple: it publishes which tuples have a declaration. */
export function useKeyedDeclarationCount(): [
  ReadonlySet<string>,
  (key: LightCullKey) => () => void,
] {
  const [ids, setIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const counts = useRef(new Map<string, number>()).current;

  const publish = useCallback(() => {
    setIds((previous) => {
      if (previous.size === counts.size && [...counts.keys()].every((id) => previous.has(id))) {
        return previous;
      }
      return new Set(counts.keys());
    });
  }, [counts]);

  const declare = useCallback(
    (key: LightCullKey) => {
      const id = lightCullKeyId(key);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      publish();

      // As in `useLightClassRegistry`: strict double-invoke replays a cleanup,
      // and a second decrement would drop a live declaration's count.
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const remaining = (counts.get(id) ?? 0) - 1;
        if (remaining > 0) counts.set(id, remaining);
        else counts.delete(id);
        publish();
      };
    },
    [counts, publish]
  );

  return [ids, declare];
}

/** The lowest ordinal `taken` has not handed out. */
function freeOrdinal(taken: ReadonlySet<number>): number {
  let ordinal = 0;
  while (taken.has(ordinal)) ordinal += 1;
  return ordinal;
}

/** One live class: the tuple it accumulates for, and the ordinals in use. */
interface LiveClass {
  key: LightCullKey;
  slots: Set<number>;
}

/**
 * The mounted cull tuples, sorted so a class's index and layer depend only on which are present,
 * and keyed by value, since a light rebuilds its key each render. A class stands while any slot is
 * live. The lowest free ordinal is reused, so ordinals stay dense for the 8-bit stencil.
 */
export function useLightClassRegistry(): [
  readonly LightCullKey[],
  (key: LightCullKey) => CanvasLightSlot,
] {
  const [keys, setKeys] = useState<readonly LightCullKey[]>(EMPTY_KEYS);
  const taken = useRef(new Map<string, LiveClass>()).current;

  const publish = useCallback(() => {
    const next = [...taken.values()].map((live) => live.key).sort(compareLightCullKeys);
    setKeys((previous) => (sameKeys(previous, next) ? previous : next));
  }, [taken]);

  const declare = useCallback(
    (key: LightCullKey): CanvasLightSlot => {
      const id = lightCullKeyId(key);
      let live = taken.get(id);
      if (!live) {
        live = { key, slots: new Set<number>() };
        taken.set(id, live);
      }
      const ordinal = freeOrdinal(live.slots);
      live.slots.add(ordinal);
      publish();

      // A second release must not free the ordinal a later light has since been given: React's
      // strict double-invoke replays the cleanup.
      let released = false;
      return {
        ordinal,
        release: () => {
          if (released) return;
          released = true;
          const current = taken.get(id);
          if (!current) return;
          current.slots.delete(ordinal);
          if (current.slots.size === 0) taken.delete(id);
          publish();
        },
      };
    },
    [taken, publish]
  );

  return [keys, declare];
}
