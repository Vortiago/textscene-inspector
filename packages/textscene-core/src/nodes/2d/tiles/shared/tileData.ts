/**
 * Tile-data decoder — turns the on-disk tile serializations into a normalized
 * placed-cell list. Pure data module (no React/THREE): it sits in the parser
 * closure of both tile slices and in the linter's validators.
 *
 * TileMapLayer (Godot 4.3+) `tile_map_data` PackedByteArray layout:
 * a 2-byte little-endian format header, then one 12-byte record per cell —
 * int16 x, int16 y, uint16 source_id, uint16 atlas_x, uint16 atlas_y,
 * uint16 alternative_tile.
 */

import { warn } from '../../../../logger';
import { packedArrayLiteral } from '../../../../godot/index.js';
import { parseGodotInt } from '../../../../godot/int.js';

export interface Vec2i {
  x: number;
  y: number;
}

/** One placed cell, normalized across both tile-data serializations. */
export interface PlacedCell {
  /** Grid coordinates of the cell (signed). */
  coords: Vec2i;
  /** TileSet atlas-source id the cell draws from. */
  sourceId: number;
  /** Tile coordinates within the atlas source. */
  atlasCoords: Vec2i;
  /** Alternative-tile id (may carry transform bits in its high bits). */
  alternativeId: number;
}

const PACKED_BYTE_ARRAY_RE = packedArrayLiteral('PackedByteArray');
const PACKED_INT32_ARRAY_RE = packedArrayLiteral('PackedInt32Array');

const CELL_BYTES = 12;
/** Legacy `layer_N/tile_data` packs one cell per three int32s. */
const INTS_PER_LEGACY_CELL = 3;
const HEADER_BYTES = 2;
const FORMAT_VERSION = 0;

export function decodeTileMapData(value: string): PlacedCell[] | null {
  const m = PACKED_BYTE_ARRAY_RE.exec(value);
  if (!m) return null;

  const bytes = decodeBytes(m[1]!.trim());
  if (!bytes) return null;
  if (bytes.length < HEADER_BYTES || (bytes.length - HEADER_BYTES) % CELL_BYTES !== 0) {
    warn(`[TileMapLayer] tile_map_data truncated (${bytes.length} bytes) — ignoring tile data`);
    return null;
  }
  const view = new DataView(bytes.buffer);
  const version = view.getUint16(0, true);
  if (version !== FORMAT_VERSION) {
    warn(`[TileMapLayer] unknown tile_map_data format version ${version} — ignoring tile data`);
    return null;
  }

  return decodeCellRecords(view, HEADER_BYTES);
}

/**
 * The elements of a packed INT body, `null` per element for one no int32 slot
 * can hold, and `null` overall for text Godot's own tokenizer cannot read.
 *
 * Two failure modes, two answers. Text outside the grammar (`nope`, `0x10`) is
 * a file Godot refuses to load, so the decode gives up. A legal-but-unstorable
 * element (`inf`, `1e20`) is a file Godot DOES load, narrowing the element to
 * an architecture-specific sentinel — so only the cell it belongs to is
 * unknowable, and {@link dropUnstorableRecords} drops that cell alone.
 */
function readInt32Elements(body: string, context: string): (number | null)[] | null {
  // An empty body is an empty array, not an unreadable one: `''.split(',')`
  // yields `['']`, which matches no grammar and would report a legal empty
  // layer as corrupt tile data.
  if (body.trim() === '') return [];
  const out: (number | null)[] = [];
  for (const part of body.split(',')) {
    const num = parseGodotInt(part);
    if (num === null) {
      warn(`${context} has entries Godot cannot read — ignoring tile data`);
      return null;
    }
    out.push(Number.isNaN(num) ? null : num);
  }
  return out;
}

/**
 * Every fixed-stride record that has no unstorable element in it.
 *
 * Both serializations pack cells at a fixed stride, so an element the engine
 * cannot hold costs exactly the cell it belongs to. Voiding the whole stream
 * instead rendered zero cells for a file Godot opens, and substituting zero
 * drew a cell at the origin — the two failures this sits between.
 *
 * A trailing partial record is passed through untouched, so the caller's own
 * truncation check still sees it.
 */
function dropUnstorableRecords(
  elements: (number | null)[],
  stride: number,
  headerLength: number,
  context: string
): number[] | null {
  const header = elements.slice(0, headerLength);
  if (header.some((n) => n === null)) {
    warn(`${context} header is not a value Godot can hold — ignoring tile data`);
    return null;
  }
  const out = header as number[];
  let i = headerLength;
  for (; i + stride <= elements.length; i += stride) {
    const record = elements.slice(i, i + stride);
    if (record.some((n) => n === null)) {
      warn(`${context} has a cell Godot cannot place — dropping that cell`);
      continue;
    }
    out.push(...(record as number[]));
  }
  for (; i < elements.length; i++) out.push(elements[i] ?? 0);
  return out;
}

/**
 * Legacy TileMap `layer_N/tile_data` (PackedInt32Array). The TSCN `format`
 * property is the 0-indexed TileMapDataFormat enum: 2 = TILE_MAP_DATA_FORMAT_3,
 * whose int32 triplets reinterpret as exactly the 12-byte record above (no
 * header). Formats 0/1 are Godot-3-era encodings that require the original
 * TileSet's compatibility mapping — out of scope, degrade with a warn.
 */
export function decodeLegacyTileData(value: string, format: number): PlacedCell[] | null {
  if (format !== 2) {
    warn(`[TileMap] tile data format ${format} is a Godot 3 format — ignoring tile data`);
    return null;
  }
  const m = PACKED_INT32_ARRAY_RE.exec(value);
  if (!m) return null;

  const read = readInt32Elements(m[1]!, '[TileMap] tile_data');
  if (read === null) return null;
  const ints = dropUnstorableRecords(read, INTS_PER_LEGACY_CELL, 0, '[TileMap] tile_data');
  if (ints === null) return null;
  if (ints.length % INTS_PER_LEGACY_CELL !== 0) {
    warn(`[TileMap] tile_data length ${ints.length} is not a whole number of cells — ignoring tile data`);
    return null;
  }
  return decodeCellRecords(new DataView(new Int32Array(ints).buffer), 0);
}

function decodeCellRecords(view: DataView, startOffset: number): PlacedCell[] {
  const cells: PlacedCell[] = [];
  for (let offset = startOffset; offset + CELL_BYTES <= view.byteLength; offset += CELL_BYTES) {
    cells.push({
      coords: { x: view.getInt16(offset, true), y: view.getInt16(offset + 2, true) },
      sourceId: view.getUint16(offset + 4, true),
      atlasCoords: { x: view.getUint16(offset + 6, true), y: view.getUint16(offset + 8, true) },
      alternativeId: view.getUint16(offset + 10, true),
    });
  }
  return cells;
}

/** Godot ≤4.2 writes comma-separated ints; 4.3+ writes a base64 string. */
function decodeBytes(body: string): Uint8Array | null {
  const base64 = /^"([^"]*)"$/.exec(body);
  if (base64) {
    try {
      return Uint8Array.from(atob(base64[1]!), (c) => c.charCodeAt(0));
    } catch {
      warn(`[TileMapLayer] tile_map_data is not valid base64 — ignoring tile data`);
      return null;
    }
  }
  const read = readInt32Elements(body, '[TileMapLayer] tile_map_data');
  if (read === null) return null;
  const ints = dropUnstorableRecords(
    read,
    CELL_BYTES,
    HEADER_BYTES,
    '[TileMapLayer] tile_map_data'
  );
  return ints === null ? null : new Uint8Array(ints);
}
