/** A light pass that records the placement of each item registered with it. */

import { INERT_CANVAS_LIGHTING, type CanvasLighting2D } from '../lightPassContext';
import type { ItemPlacement } from '../itemLightList';

export function recordedItems(): { lighting: CanvasLighting2D; placements: ItemPlacement[] } {
  const placements: ItemPlacement[] = [];
  const lighting: CanvasLighting2D = {
    ...INERT_CANVAS_LIGHTING,
    registerItem: (placement) => {
      placements.push(placement);
      return () => {};
    },
  };
  return { lighting, placements };
}
