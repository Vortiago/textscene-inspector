/**
 * The sprite-sheet frame a Sprite2D/Sprite3D ends up holding, replayed in
 * FILE order — the two classes' setters are line-for-line twins
 * (sprite_2d.cpp:296-364, sprite_3d.cpp:878-943).
 *
 * `SceneState::instantiate` applies a node's stored properties in the order the
 * file lists them (packed_scene.cpp:369-492), so each setter sees only what the
 * lines above it have already applied:
 *
 *   set_frame:        ERR_FAIL_INDEX(p_frame, vframes * hframes)          — refused
 *   set_frame_coords: ERR_FAIL_INDEX per component, then set_frame        — refused
 *   set_vframes:      ERR_FAIL_COND(p_amount < 1); frame = 0 if now past the grid
 *   set_hframes:      ERR_FAIL_COND(p_amount < 1); with vframes > 1 the frame is
 *                     RE-MAPPED to keep its row and column on the new sheet
 *                     (`frame = original_row * p_amount + original_column`,
 *                     sprite_2d.cpp:358), or reset to 0 when its column is gone.
 *
 * Shared by the render parsers (what to draw) and the linter (what to report),
 * so the two cannot disagree about which frame a body loads on.
 */

import { parseGodotInt } from './int.js';
import { slotTupleRegex } from './number.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';

export type FrameKey = 'frame' | 'frame_coords';

/** One `frame`/`frame_coords` line, and how the setter received it. */
export interface FrameWrite {
  key: FrameKey;
  /** Position in the file's property order. */
  index: number;
  /** The frame index the line asked for (`frame_coords` folded through `y * hframes + x`). */
  authored: number;
  coords?: { x: number; y: number };
  /** The grid in effect when the write was applied. */
  hframes: number;
  vframes: number;
  /** Which ERR_FAIL_INDEX refused it; both false means the write landed. */
  refused: { x: boolean; y: boolean };
}

export interface SpriteFrameState {
  hframes: number;
  vframes: number;
  frame: number;
  writes: FrameWrite[];
  /** Position of the last `hframes`/`vframes` line, or -1. */
  lastGridIndex: number;
  /** Position of the first grid literal no int slot holds; the grid is unknowable from there down. */
  gridUnknownFrom: number;
  /** The landed write whose value a later `hframes` line changed. */
  remap?: { write: FrameWrite; to: number };
}

/** `get_frame_coords()`: the stored frame as (column, row) on the stored grid (sprite_2d.cpp:319). */
export function frameCoords(state: SpriteFrameState): { x: number; y: number } {
  return { x: state.frame % state.hframes, y: Math.trunc(state.frame / state.hframes) };
}

const VECTOR2I_RE = slotTupleRegex('Vector2i', 2);

/** Both components as the `Vector2i` slot stores them, or `null` for one it cannot. */
function readCoords(raw: string): { x: number; y: number } | null {
  const match = VECTOR2I_RE.exec(raw.trim());
  if (!match) return null;
  // A `Vector2(...)` in a Vector2i slot holds doubles: both take the double branch.
  const converted = isConvertedSpelling('Vector2i', compositeTypeName(raw));
  const x = parseGodotInt(match[1]!, 'int32', converted);
  const y = parseGodotInt(match[2]!, 'int32', converted);
  if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y };
}

export function replaySpriteFrames(properties: Record<string, string>): SpriteFrameState {
  const state: SpriteFrameState = {
    hframes: 1,
    vframes: 1,
    frame: 0,
    writes: [],
    lastGridIndex: -1,
    gridUnknownFrom: Number.POSITIVE_INFINITY,
  };
  let stored: FrameWrite | undefined;
  const land = (write: FrameWrite, frame: number) => {
    state.frame = frame;
    stored = write;
  };
  const resetIfPastGrid = () => {
    if (state.frame >= state.vframes * state.hframes) state.frame = 0;
  };

  // The four keys this replay consumes, read by name so the parser-parity
  // scrape (linter/testing/propertyGrammarParityScan.ts) credits them to the
  // parsers that hand the bag here; the ORDER still comes from the bag itself.
  const authored: Record<string, string | undefined> = {
    hframes: properties.hframes,
    vframes: properties.vframes,
    frame: properties.frame,
    frame_coords: properties.frame_coords,
  };
  for (const [index, key] of Object.keys(properties).entries()) {
    const raw = authored[key];
    if (raw === undefined) continue;
    if (key === 'hframes' || key === 'vframes') {
      state.lastGridIndex = index;
      const count = parseGodotInt(raw);
      if (count === null || Number.isNaN(count)) {
        state.gridUnknownFrom = Math.min(state.gridUnknownFrom, index);
        continue;
      }
      // ERR_FAIL_COND_MSG(p_amount < 1): refused, and the grid stands.
      if (count < 1 || count === state[key]) continue;
      if (key === 'hframes' && state.vframes > 1) {
        const column = state.frame % state.hframes;
        state.frame = column >= count ? 0 : Math.trunc(state.frame / state.hframes) * count + column;
      }
      state[key] = count;
      resetIfPastGrid();
    } else if (key === 'frame') {
      const frame = parseGodotInt(raw);
      if (frame === null || Number.isNaN(frame)) continue;
      const refused = frame < 0 || frame >= state.hframes * state.vframes;
      const write: FrameWrite = {
        key, index, authored: frame, hframes: state.hframes, vframes: state.vframes,
        refused: { x: refused, y: false },
      };
      state.writes.push(write);
      if (!refused) land(write, frame);
    } else if (key === 'frame_coords') {
      const coords = readCoords(raw);
      if (!coords) continue;
      const write: FrameWrite = {
        key, index, coords, authored: coords.y * state.hframes + coords.x,
        hframes: state.hframes, vframes: state.vframes,
        refused: {
          x: coords.x < 0 || coords.x >= state.hframes,
          y: coords.y < 0 || coords.y >= state.vframes,
        },
      };
      state.writes.push(write);
      if (!write.refused.x && !write.refused.y) land(write, write.authored);
    }
  }
  if (stored && state.frame !== stored.authored) state.remap = { write: stored, to: state.frame };
  return state;
}
