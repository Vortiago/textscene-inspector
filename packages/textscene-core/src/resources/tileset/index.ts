/**
 * TileSet resource slice — Godot-text kind (ADR-0031).
 *
 * `decode.ts` turns a TileSet's raw property strings into the `TileSetModel`,
 * from either arrival (scene `[sub_resource]` or external `.tres`
 * **ParsedResource**). There is no `build.ts`: the decoded model is plain
 * data, and the THREE-side work — placement, batched geometry, Y-sort
 * grouping — is per-CELL rather than per-resource, so it lives in the slice's
 * internal modules (`tilePlacement`, `tileGeometry`, `tileYSort`) that the
 * tile node components call.
 *
 * No `extensions` claim: a TileSet arrives as `.tres`, the shared Godot-text
 * container every text slice would otherwise re-claim. Routing is by type name.
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
