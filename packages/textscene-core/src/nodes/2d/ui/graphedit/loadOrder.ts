/**
 * What `GraphEdit`'s own setters leave behind when a scene's properties are
 * applied IN THE FILE'S OWN ORDER.
 *
 * Three of GraphEdit's setters read state an earlier key wrote, so the stored
 * value is not the authored one and cannot be recovered from an order-free
 * property bag. `SceneState::instantiate` applies every property with
 * `node->set` (`scene/resources/packed_scene.cpp:492`) and only THEN parents
 * the node (`:541`), so every setter below runs on a node that is NOT inside
 * the tree. Two consequences do all the work:
 *
 *  - `Control::_size_changed` updates `data.size_cache` but skips
 *    `NOTIFICATION_RESIZED` outside the tree (`scene/gui/control.cpp:1812`),
 *    so `GraphEdit::_update_scrollbars` — the only writer of
 *    `min_scroll_offset`/`max_scroll_offset` (`graph_edit.cpp:492-493`), and
 *    the only other `NOTIFICATION_RESIZED` handler (`:867`) — never runs
 *    during load. Both bounds are therefore still `(0, 0)` when
 *    `set_scroll_offset` clamps against them (`:407`), and `CLAMP` takes the
 *    MIN branch first (`core/typedefs.h:139-141`): every authored offset lands
 *    on `0` or on `-size`, never in between.
 *  - `get_parent_anchorable_rect` returns an empty `Rect2` outside the tree
 *    (`control.cpp:687-689`), so every `anchor_*` contributes zero and the
 *    size is exactly `offset_right - offset_left` by `offset_bottom -
 *    offset_top`, floored by `custom_minimum_size` (`control.cpp:1773-1797`,
 *    `:1744-1750`).
 *
 * `set_zoom` is the same mechanism on a different pair: it clamps against
 * `zoom_min`/`zoom_max` as they stand (`:2434`), and each bound's own setter
 * re-runs `set_zoom(zoom)` afterwards (`:2487`, `:2502`). `set_zoom_custom`
 * returns before touching the two buttons' disabled flags when the clamp
 * changed nothing (`:2435-2437`), so a bound written after `zoom` moves
 * neither.
 *
 * The replay follows `Label`'s own `resolveVisibleChars` (`../label/parser.ts`)
 * — the raw property bag's insertion order IS file order
 * (`TscnParserCore.ts`'s scanning loop). Not modelled: `anchors_preset` and
 * `layout_mode`, whose offset rewrites resolve against that same empty parent
 * rect and which Godot's own saver writes ahead of the `offset_*` keys that
 * overwrite them.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { parseOptionalFloat, parseOptionalVector2 } from '../../../../parser/valueParsers';
import type { Vec2 } from '../../../../r3f/controls/native/rect';

/**
 * `zoom_step`'s own member default (`graph_edit.h:227`), the only input to the
 * two bounds below. A `float`, so `Math::pow`'s float overload is the one the
 * constructor picks and the exponentiation starts from 1.2f, not from 1.2.
 */
const DEFAULT_ZOOM_STEP = Math.fround(1.2);

/** `zoom_min = 1 / Math::pow(zoom_step, 8)` (`graph_edit.cpp:3175`), stored in a `float`. */
export const GRAPH_EDIT_DEFAULT_ZOOM_MIN = Math.fround(1 / Math.fround(Math.pow(DEFAULT_ZOOM_STEP, 8)));
/** `zoom_max = 1 * Math::pow(zoom_step, 4)` (`graph_edit.cpp:3177`), stored in a `float`. */
export const GRAPH_EDIT_DEFAULT_ZOOM_MAX = Math.fround(Math.pow(DEFAULT_ZOOM_STEP, 4));

/** `zoom`'s own member default (`graph_edit.h:226`). */
const DEFAULT_ZOOM = 1;

/** Both `min_scroll_offset` and `max_scroll_offset` while a scene loads — the clamp reads them per component. */
const ZERO_SCROLL_BOUND = 0;

export interface GraphEditLoadState {
  /** `scroll_offset` as STORED, or undefined where the file never ran the setter. */
  scrollOffset: Vec2 | undefined;
  /** `zoom` as STORED, or undefined where neither it nor a bound was written. */
  zoom: number | undefined;
  /** `zoom_minus_button->is_disabled()`. */
  zoomMinusDisabled: boolean;
  /** `zoom_plus_button->is_disabled()`. */
  zoomPlusDisabled: boolean;
}

/** `CLAMP` (`core/typedefs.h:139-141`) — the min branch is tested first, so an inverted range returns the MAX. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

interface ReplayState {
  offsets: [number, number, number, number];
  customMinimum: Vec2;
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  zoomTouched: boolean;
  minusDisabled: boolean;
  plusDisabled: boolean;
  scrollOffset: Vec2 | undefined;
}

/** `Control::get_size()` as `_size_changed` leaves it out of tree (`control.cpp:1765-1797`). */
function sizeOf(state: ReplayState): Vec2 {
  return {
    x: Math.max(state.offsets[2] - state.offsets[0], state.customMinimum.x),
    y: Math.max(state.offsets[3] - state.offsets[1], state.customMinimum.y),
  };
}

/** `GraphEdit::set_zoom_custom` (`graph_edit.cpp:2431-2446`), the parts a load reaches: `is_visible_in_tree()` is false, so the scroll-anchor rewrite at `:2452-2453` never runs. */
function applySetZoom(state: ReplayState, requested: number): void {
  const zoom = clamp(requested, state.zoomMin, state.zoomMax);
  state.zoomTouched = true;
  if (state.zoom === zoom) return;
  state.zoom = zoom;
  state.minusDisabled = zoom === state.zoomMin;
  state.plusDisabled = zoom === state.zoomMax;
}

const OFFSET_KEYS: Record<string, 0 | 1 | 2 | 3> = {
  offset_left: 0,
  offset_top: 1,
  offset_right: 2,
  offset_bottom: 3,
};

export function resolveGraphEditLoadState(properties: Record<string, string>): GraphEditLoadState {
  const state: ReplayState = {
    offsets: [0, 0, 0, 0],
    customMinimum: { x: 0, y: 0 },
    zoom: DEFAULT_ZOOM,
    zoomMin: GRAPH_EDIT_DEFAULT_ZOOM_MIN,
    zoomMax: GRAPH_EDIT_DEFAULT_ZOOM_MAX,
    zoomTouched: false,
    minusDisabled: false,
    plusDisabled: false,
    scrollOffset: undefined,
  };

  for (const key of Object.keys(properties)) {
    const side = OFFSET_KEYS[key];
    if (side !== undefined) {
      const value = parseOptionalFloat(properties[key]!);
      if (value !== undefined) state.offsets[side] = value;
      continue;
    }
    switch (key) {
      case 'custom_minimum_size': {
        const value = parseOptionalVector2(properties.custom_minimum_size);
        if (value) state.customMinimum = value;
        break;
      }
      case 'scroll_offset': {
        const value = parseOptionalVector2(properties.scroll_offset);
        if (!value) break;
        // `p_offset.clamp(min_scroll_offset, max_scroll_offset - get_size())` (`:407`),
        // per component (`core/math/vector2.cpp:132-136`), both bounds still zero.
        const size = sizeOf(state);
        state.scrollOffset = {
          x: clamp(value.x, ZERO_SCROLL_BOUND, ZERO_SCROLL_BOUND - size.x),
          y: clamp(value.y, ZERO_SCROLL_BOUND, ZERO_SCROLL_BOUND - size.y),
        };
        break;
      }
      case 'zoom': {
        const value = parseOptionalFloat(properties.zoom);
        if (value !== undefined) applySetZoom(state, value);
        break;
      }
      case 'zoom_min': {
        const value = parseOptionalFloat(properties.zoom_min);
        // `ERR_FAIL_COND_MSG(p_zoom_min > zoom_max)` (`:2480`) — the property is refused outright.
        if (value === undefined || value > state.zoomMax || value === state.zoomMin) break;
        state.zoomMin = value;
        applySetZoom(state, state.zoom);
        break;
      }
      case 'zoom_max': {
        const value = parseOptionalFloat(properties.zoom_max);
        // `ERR_FAIL_COND_MSG(p_zoom_max < zoom_min)` (`:2495`).
        if (value === undefined || value < state.zoomMin || value === state.zoomMax) break;
        state.zoomMax = value;
        applySetZoom(state, state.zoom);
        break;
      }
      default:
        break;
    }
  }

  return {
    scrollOffset: state.scrollOffset,
    zoom: state.zoomTouched ? state.zoom : undefined,
    zoomMinusDisabled: state.minusDisabled,
    zoomPlusDisabled: state.plusDisabled,
  };
}
