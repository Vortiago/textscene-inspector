/**
 * The bookkeeping behind the light pass's `register*` calls: the lights on the canvas with their
 * ordinals, and the placements of the lit items. React state only, no GPU.
 */

import { useCallback, useRef, useState } from 'react';
import {
  placementId,
  type CanvasLightDeclaration,
  type ItemPlacement,
  type LitItemRead,
  type PlacementDeclarations,
} from './itemLightList.js';
import type { CanvasLightSlot } from './lightPassContext.js';

/** The lowest ordinal `taken` has not handed out. */
function freeOrdinal(taken: ReadonlyMap<number, unknown>): number {
  let ordinal = 0;
  while (taken.has(ordinal)) ordinal += 1;
  return ordinal;
}

/**
 * The declared lights by ordinal. The lowest free ordinal is reused, so ordinals stay dense for the
 * 8-bit stencil, which keeps each light's shadow stamps apart in a pass.
 */
export function useLightRegistry(): [
  ReadonlyMap<number, CanvasLightDeclaration>,
  (declaration: CanvasLightDeclaration) => CanvasLightSlot,
] {
  const [lights, setLights] = useState<ReadonlyMap<number, CanvasLightDeclaration>>(() => new Map());
  const taken = useRef(new Map<number, CanvasLightDeclaration>()).current;

  const declare = useCallback(
    (declaration: CanvasLightDeclaration): CanvasLightSlot => {
      const ordinal = freeOrdinal(taken);
      taken.set(ordinal, declaration);
      setLights(new Map(taken));

      // A second release must not free the ordinal a later light has since been given: React's
      // strict double-invoke replays the cleanup.
      let released = false;
      return {
        ordinal,
        release: () => {
          if (released) return;
          released = true;
          taken.delete(ordinal);
          setLights(new Map(taken));
        },
      };
    },
    [taken]
  );

  return [lights, declare];
}

interface PlacementCount {
  placement: ItemPlacement;
  /** How many of the placement's items read each accumulation. */
  readers: Map<LitItemRead, number>;
}

function placementDeclarations({ placement, readers }: PlacementCount): PlacementDeclarations {
  return { placement, reads: new Set(readers.keys()) };
}

function sameReads(a: ReadonlySet<LitItemRead>, b: ReadonlySet<LitItemRead>): boolean {
  return a.size === b.size && [...a].every((read) => b.has(read));
}

/** The placements of the lit items by `placementId`, counted so each stands while an item holds it. */
export function usePlacementRegistry(): [
  ReadonlyMap<string, PlacementDeclarations>,
  (placement: ItemPlacement, read: LitItemRead) => () => void,
] {
  const [placements, setPlacements] = useState<ReadonlyMap<string, PlacementDeclarations>>(() => new Map());
  const counts = useRef(new Map<string, PlacementCount>()).current;

  const publish = useCallback(() => {
    setPlacements((previous) => {
      const next = new Map([...counts].map(([id, count]) => [id, placementDeclarations(count)]));
      const unchanged =
        previous.size === next.size &&
        [...next].every(([id, declared]) => {
          const held = previous.get(id);
          return held !== undefined && sameReads(held.reads, declared.reads);
        });
      return unchanged ? previous : next;
    });
  }, [counts]);

  const declare = useCallback(
    (placement: ItemPlacement, read: LitItemRead) => {
      const id = placementId(placement);
      const count = counts.get(id) ?? { placement, readers: new Map<LitItemRead, number>() };
      count.readers.set(read, (count.readers.get(read) ?? 0) + 1);
      counts.set(id, count);
      publish();

      // As above: strict double-invoke replays a cleanup, and a second decrement would drop a live
      // declaration.
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = count.readers.get(read)! - 1;
        if (left > 0) count.readers.set(read, left);
        else count.readers.delete(read);
        if (count.readers.size === 0) counts.delete(id);
        publish();
      };
    },
    [counts, publish]
  );

  return [placements, declare];
}
