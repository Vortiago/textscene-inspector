/** TileMapLayer (Godot 4.3+) — a single tile layer with its own tile data. */

import type { Node2DProperties } from '../../../base/node2d/types';
import type { PlacedCell } from '../shared/tileData';

export interface TileMapLayerProperties extends Node2DProperties {
  /** TileSet reference — `SubResource("...")` or `ExtResource("...")`, verbatim. */
  tile_set?: string;
  /** Whether the layer renders (TileMapLayer.enabled, default true). */
  enabled: boolean;
  /** Cells decoded from `tile_map_data` at parse time; null = undecodable (degrade). */
  cells?: PlacedCell[] | null;
}
