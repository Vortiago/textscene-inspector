/**
 * The bookkeeping behind the light pass's `register*` calls: the lights on the canvas with their
 * ordinals, and the placements of the lit items. React state only, no GPU.
 */

import { useCallback, useRef, useState } from 'react';
import {
  placementId,
  type CanvasLightDeclaration,
  type ItemPlacement,
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
  items: number;
  lightOnlyItems: number;
}

/** The placements of the lit items by `placementId`, counted so each stands while an item holds it. */
export function usePlacementRegistry(): [
  ReadonlyMap<string, PlacementDeclarations>,
  (placement: ItemPlacement, lightOnly: boolean) => () => void,
] {
  const [placements, setPlacements] = useState<ReadonlyMap<string, PlacementDeclarations>>(() => new Map());
  const counts = useRef(new Map<string, PlacementCount>()).current;

  const publish = useCallback(() => {
    setPlacements((previous) => {
      const unchanged =
        previous.size === counts.size &&
        [...counts].every(([id, count]) => previous.get(id)?.hasLightOnly === count.lightOnlyItems > 0);
      if (unchanged) return previous;
      return new Map(
        [...counts].map(([id, count]) => [
          id,
          { placement: count.placement, hasLightOnly: count.lightOnlyItems > 0 },
        ])
      );
    });
  }, [counts]);

  const declare = useCallback(
    (placement: ItemPlacement, lightOnly: boolean) => {
      const id = placementId(placement);
      const count = counts.get(id) ?? { placement, items: 0, lightOnlyItems: 0 };
      count.items += 1;
      if (lightOnly) count.lightOnlyItems += 1;
      counts.set(id, count);
      publish();

      // As above: strict double-invoke replays a cleanup, and a second decrement would drop a live
      // declaration.
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count.items -= 1;
        if (lightOnly) count.lightOnlyItems -= 1;
        if (count.items === 0) counts.delete(id);
        publish();
      };
    },
    [counts, publish]
  );

  return [placements, declare];
}
