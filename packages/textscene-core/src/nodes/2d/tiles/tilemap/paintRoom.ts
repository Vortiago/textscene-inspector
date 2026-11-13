/**
 * The draw-sequence room a TileMap holds: one value per layer at the front, since each layer is an
 * internal child added with `INTERNAL_MODE_FRONT` (`tile_map.cpp:279`), and a reserve after its
 * children for its scene tiles.
 */

import type { TscnNode } from '../../../../parser/types';
import { DYNAMIC_CHILD_RESERVE, type PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';

export const tileMapPaintRoom: PaintRoom = {
  reservesTail: () => true,
  frontRoom: (node: TscnNode) => {
    const { layers, y_sort_enabled: ySorted } = node.properties as {
      layers?: readonly unknown[];
      y_sort_enabled?: boolean;
    };
    // A y-sorted layer splits into a group per tile row once its tileset loads, so it draws from
    // a reserve, as a TileMapLayer does.
    return (layers?.length ?? 0) * (ySorted ? DYNAMIC_CHILD_RESERVE : 1);
  },
};
