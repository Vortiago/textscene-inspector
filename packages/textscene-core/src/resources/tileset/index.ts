/**
 * TileSet resource slice, Godot-text kind (ADR-0031). No `build.ts`: the THREE
 * work is per cell, in `tilePlacement`, `tileGeometry` and `tileYSort`. No
 * `extensions` claim: `.tres` is shared, so routing is by type name.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'tileset',
  kind: 'godot-text',
  typeNames: ['TileSet'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export type {
  AlternativeTileModel,
  AtlasSourceModel,
  AtlasTileModel,
  TileDrawInfo,
  TileGrid,
  TileLayout,
  TileOffsetAxis,
  TileOrientation,
  TileSetModel,
  Vec2i,
} from './types';
