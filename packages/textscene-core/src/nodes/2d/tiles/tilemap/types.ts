/** Legacy TileMap (Godot ≤4.2) — a multi-layer tile node with per-layer data. */

import type { Color, Node2DProperties } from '../../../base/node2d/types';
import type { PlacedCell } from '../shared/tileData';

export interface TileMapLayerData {
  /** Layer display name (`layer_N/name`), default "Layer N". */
  name: string;
  /** Whether the layer renders (`layer_N/enabled`, default true). */
  enabled: boolean;
  /** Godot z_index for the layer (`layer_N/z_index`, default 0). */
  zIndex: number;
  /** Per-layer tint (`layer_N/modulate`); multiplies onto the layer's pixels. */
  modulate?: Color;
  /** Cells decoded from `layer_N/tile_data`; null = undecodable (degrade). */
  cells: PlacedCell[] | null;
}

export interface TileMapProperties extends Node2DProperties {
  /** TileSet reference — `SubResource("...")` or `ExtResource("...")`, verbatim. */
  tile_set?: string;
  /** Layers in index order (`layer_0/*`, `layer_1/*`, …). */
  layers: TileMapLayerData[];
}
