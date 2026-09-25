/**
 * The sprite-sheet frame a Sprite2D/Sprite3D ends up holding, replayed in file order
 * (packed_scene.cpp:369-492), so each setter sees only the lines above it. The two classes'
 * setters are line-for-line twins (sprite_2d.cpp:296-364, sprite_3d.cpp:878-943). The render
 * parsers and the linter share this, so they cannot disagree about which frame a body loads on.
 */

import { parseGodotInt, storedVector2i } from './int.js';

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
  /** Which ERR_FAIL_INDEX refused it. Both false means the write landed. */
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
  // `set_vframes` and `set_hframes` reset the frame to 0 when it falls past the new grid.
  const resetIfPastGrid = () => {
    if (state.frame >= state.vframes * state.hframes) state.frame = 0;
  };

  // The four keys this replay consumes, read by name so the parser-parity
  // scrape (linter/testing/propertyGrammarParityScan.ts) credits them to the
  // parsers that hand the bag here. The order still comes from the bag itself.
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
      // With vframes > 1, `set_hframes` re-maps the frame to keep its row and column
      // (`frame = original_row * p_amount + original_column`, sprite_2d.cpp:358),
      // or resets it to 0 when its column is gone.
      if (key === 'hframes' && state.vframes > 1) {
        const column = state.frame % state.hframes;
        state.frame = column >= count ? 0 : Math.trunc(state.frame / state.hframes) * count + column;
      }
      state[key] = count;
      resetIfPastGrid();
    } else if (key === 'frame') {
      // `set_frame`: ERR_FAIL_INDEX(p_frame, vframes * hframes) refuses it.
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
      // `set_frame_coords`: ERR_FAIL_INDEX per component, then `set_frame`.
      const coords = storedVector2i(raw);
      if (typeof coords === 'string') continue;
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
