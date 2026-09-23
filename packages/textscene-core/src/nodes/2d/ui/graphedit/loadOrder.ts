/**
 * What `GraphEdit`'s setters store when a scene's properties apply in file order.
 * Three setters read state an earlier key wrote, so an order-free property bag
 * cannot recover the stored value. `SceneState::instantiate` sets every property
 * (`scene/resources/packed_scene.cpp:492`) before it parents the node (`:541`),
 * so each setter below runs outside the tree:
 *
 *  - `Control::_size_changed` updates `data.size_cache` but skips
 *    `NOTIFICATION_RESIZED` outside the tree (`scene/gui/control.cpp:1812`), so
 *    the resize handler (`:867`) never calls `GraphEdit::_update_scrollbars`,
 *    the only writer of `min_scroll_offset`/
 *    `max_scroll_offset` (`graph_edit.cpp:492-493`). Both bounds are still
 *    `(0, 0)` when `set_scroll_offset` clamps (`:407`), and `CLAMP` tests the min
 *    branch first (`core/typedefs.h:139-141`): the range is inverted and each
 *    authored offset lands on `0` or on `-size`.
 *    A `zoom` write that moves the value calls `_update_scrollbars` first
 *    (`:2448`). `SceneState` parents GraphEdit's children after its own
 *    properties, so the child list is still empty then, and the merged rect is one
 *    size out from the origin (`:488-493`) and a later clamp reads the proper
 *    range `min_scroll_offset` to `max_scroll_offset - size`, where an authored
 *    offset survives. `set_scroll_offset` reruns `_update_scrollbars` (`:414`)
 *    only after its own clamp, and a file writes the key once.
 *  - `get_parent_anchorable_rect` returns an empty `Rect2` outside the tree
 *    (`control.cpp:687-689`), so each `anchor_*` adds zero and the size is
 *    `offset_right - offset_left` by `offset_bottom - offset_top`, floored by
 *    `custom_minimum_size` (`control.cpp:1773-1797`, `:1744-1750`).
 *
 * `set_zoom` clamps against `zoom_min`/`zoom_max` as they stand (`:2434`), and
 * each bound's setter reruns `set_zoom(zoom)` (`:2487`, `:2502`).
 * `set_zoom_custom` returns before it touches the buttons' disabled flags when
 * the clamp changes nothing (`:2435-2437`), so a bound written after `zoom`
 * moves neither.
 *
 * The replay follows `Label`'s `resolveVisibleChars` (`../label/parser.ts`): the
 * raw property bag's insertion order is file order (`TscnParserCore.ts`). Not
 * modelled: `anchors_preset` and `layout_mode`, whose offset rewrites resolve
 * against the same empty parent rect and which Godot's saver writes ahead of
 * the `offset_*` keys that overwrite them.
 *
 * Pure data + functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { parseOptionalFloat, parseOptionalVector2 } from '../../../../parser/valueParsers';
// The min branch is tested first, so the inverted range this replay builds returns the MAX.
import { clamp } from '../../../../godot/math';
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

/** `min_scroll_offset` and `max_scroll_offset` as GraphEdit's constructor leaves them. */
const ZERO_SCROLL_BOUNDS = { x: 0, y: 0 };

export interface GraphEditLoadState {
  /** `scroll_offset` as stored, or undefined where the file never ran the setter. */
  scrollOffset: Vec2 | undefined;
  /** `zoom` as stored, or undefined where neither it nor a bound was written. */
  zoom: number | undefined;
  /** `zoom_minus_button->is_disabled()`. */
  zoomMinusDisabled: boolean;
  /** `zoom_plus_button->is_disabled()`. */
  zoomPlusDisabled: boolean;
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
  scrollMin: Vec2;
  scrollMax: Vec2;
  scrollOffset: Vec2 | undefined;
}

/** `Control::get_size()` as `_size_changed` leaves it out of tree (`control.cpp:1765-1797`). */
function sizeOf(state: ReplayState): Vec2 {
  return {
    x: Math.max(state.offsets[2] - state.offsets[0], state.customMinimum.x),
    y: Math.max(state.offsets[3] - state.offsets[1], state.customMinimum.y),
  };
}

/**
 * `GraphEdit::_update_scrollbars` (`graph_edit.cpp:488-493`) over the empty
 * child list a load presents it with: the merged rect is a point at the origin,
 * grown by one size in every direction.
 */
function installScrollBounds(state: ReplayState): void {
  const size = sizeOf(state);
  state.scrollMin = { x: -size.x, y: -size.y };
  state.scrollMax = { x: size.x, y: size.y };
}

/** `GraphEdit::set_zoom_custom` (`graph_edit.cpp:2431-2448`), the parts a load reaches: `is_visible_in_tree()` is false, so the scroll-anchor rewrite at `:2452-2453` never runs. */
function applySetZoom(state: ReplayState, requested: number): void {
  const zoom = clamp(requested, state.zoomMin, state.zoomMax);
  state.zoomTouched = true;
  if (state.zoom === zoom) return;
  state.zoom = zoom;
  state.minusDisabled = zoom === state.zoomMin;
  state.plusDisabled = zoom === state.zoomMax;
  installScrollBounds(state);
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
    scrollMin: ZERO_SCROLL_BOUNDS,
    scrollMax: ZERO_SCROLL_BOUNDS,
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
        // per component (`core/math/vector2.cpp:132-136`).
        const size = sizeOf(state);
        state.scrollOffset = {
          x: clamp(value.x, state.scrollMin.x, state.scrollMax.x - size.x),
          y: clamp(value.y, state.scrollMin.y, state.scrollMax.y - size.y),
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
        // `ERR_FAIL_COND_MSG(p_zoom_min > zoom_max)` (`:2480`): the property is refused outright.
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
