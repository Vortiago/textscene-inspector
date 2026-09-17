import { describe, expect, it } from 'vitest';
import { resolveGraphEditLoadState, GRAPH_EDIT_DEFAULT_ZOOM_MAX, GRAPH_EDIT_DEFAULT_ZOOM_MIN } from './loadOrder';

/** The rect `offset_left = 8 … offset_bottom = 328` gives, as `Control::_size_changed` computes it out of tree. */
const SIZED_400_320 = {
  offset_left: '8.0',
  offset_top: '8.0',
  offset_right: '408.0',
  offset_bottom: '328.0',
};

describe('resolveGraphEditLoadState — scroll_offset', () => {
  it('sends a positive authored offset to -size (graph_edit.cpp:407, typedefs.h:139-141)', () => {
    const state = resolveGraphEditLoadState({ ...SIZED_400_320, scroll_offset: 'Vector2(32, 16)' });
    expect(state.scrollOffset).toEqual({ x: -400, y: -320 });
  });

  it('sends a negative authored offset to the min bound of (0, 0)', () => {
    const state = resolveGraphEditLoadState({ ...SIZED_400_320, scroll_offset: 'Vector2(-50, -60)' });
    expect(state.scrollOffset).toEqual({ x: 0, y: 0 });
  });

  it('sends an authored (0, 0) to -size, because 0 is not below the min bound', () => {
    const state = resolveGraphEditLoadState({ ...SIZED_400_320, scroll_offset: 'Vector2(0, 0)' });
    expect(state.scrollOffset).toEqual({ x: -400, y: -320 });
  });

  it('reads the size the keys BEFORE it produced, not the final one', () => {
    const state = resolveGraphEditLoadState({ scroll_offset: 'Vector2(32, 16)', ...SIZED_400_320 });
    expect(state.scrollOffset).toEqual({ x: 0, y: 0 });
  });

  it('floors that size against the custom_minimum_size seen so far', () => {
    const state = resolveGraphEditLoadState({
      custom_minimum_size: 'Vector2(500, 400)',
      scroll_offset: 'Vector2(32, 16)',
    });
    expect(state.scrollOffset).toEqual({ x: -500, y: -400 });
  });

  it('leaves the offset unset when the file never calls the setter', () => {
    expect(resolveGraphEditLoadState(SIZED_400_320).scrollOffset).toBeUndefined();
  });

  it('keeps an offset inside the bounds a preceding zoom write installed (graph_edit.cpp:2448, :488-493)', () => {
    // A zoom that MOVES runs `_update_scrollbars` over the still-empty child
    // list, so the clamp that follows reads -size to (size - size), a proper
    // range rather than the inverted one.
    const state = resolveGraphEditLoadState({
      ...SIZED_400_320,
      zoom: '2.0',
      scroll_offset: 'Vector2(-64, -48)',
    });
    expect(state.scrollOffset).toEqual({ x: -64, y: -48 });
  });

  it('sends a positive offset to the max end of those bounds, which is (0, 0)', () => {
    const state = resolveGraphEditLoadState({
      ...SIZED_400_320,
      zoom: '2.0',
      scroll_offset: 'Vector2(32, 16)',
    });
    expect(state.scrollOffset).toEqual({ x: 0, y: 0 });
  });

  it('leaves the bounds inverted when the preceding zoom write changes nothing (graph_edit.cpp:2435-2437)', () => {
    // `zoom = 1.0` is already the constructor's value, so set_zoom_custom
    // returns before `_update_scrollbars` and the bounds stay at (0, 0).
    const state = resolveGraphEditLoadState({
      ...SIZED_400_320,
      zoom: '1.0',
      scroll_offset: 'Vector2(-64, -48)',
    });
    expect(state.scrollOffset).toEqual({ x: 0, y: 0 });
  });

  it('installs the bounds from a zoom the file moved through a LIMIT (graph_edit.cpp:2487)', () => {
    const state = resolveGraphEditLoadState({
      ...SIZED_400_320,
      zoom_min: '1.5',
      scroll_offset: 'Vector2(-64, -48)',
    });
    expect(state.scrollOffset).toEqual({ x: -64, y: -48 });
  });

  it('measures the bounds at the ZOOM key and the page at its own key', () => {
    // `max_scroll_offset - get_size()` samples the rect at two different
    // moments, so a rect that grows in between gives an asymmetric range:
    // min -400 from the zoom key, max 400 - 600 from this one.
    const state = resolveGraphEditLoadState({
      offset_right: '400.0',
      offset_bottom: '320.0',
      zoom: '2.0',
      custom_minimum_size: 'Vector2(600, 500)',
      scroll_offset: 'Vector2(-500, -400)',
    });
    expect(state.scrollOffset).toEqual({ x: -400, y: -320 });
  });

  it('ignores a zoom written AFTER the offset, which cannot move a clamp already applied', () => {
    const state = resolveGraphEditLoadState({
      ...SIZED_400_320,
      scroll_offset: 'Vector2(-64, -48)',
      zoom: '2.0',
    });
    expect(state.scrollOffset).toEqual({ x: 0, y: 0 });
  });
});

describe('resolveGraphEditLoadState — zoom', () => {
  it('starts from the constructor bounds of 1/1.2^8 and 1.2^4 (graph_edit.cpp:3175-3177)', () => {
    expect(GRAPH_EDIT_DEFAULT_ZOOM_MIN).toBeCloseTo(0.2325680, 6);
    expect(GRAPH_EDIT_DEFAULT_ZOOM_MAX).toBeCloseTo(2.0736, 5);
  });

  it('clamps an authored zoom against the CONSTRUCTOR bounds when the file states none (graph_edit.cpp:2434, :3175-3177)', () => {
    const state = resolveGraphEditLoadState({ zoom: '10.0' });
    expect(state.zoom).toBe(GRAPH_EDIT_DEFAULT_ZOOM_MAX);
    expect(state.zoomPlusDisabled).toBe(true);
    expect(state.zoomMinusDisabled).toBe(false);
  });

  it('disables the plus button when a bound written FIRST parks zoom on it (graph_edit.cpp:2445-2446)', () => {
    const state = resolveGraphEditLoadState({ zoom_max: '2.0', zoom: '2.0' });
    expect(state.zoom).toBe(2);
    expect(state.zoomPlusDisabled).toBe(true);
  });

  it('leaves the buttons alone when the bound arrives AFTER zoom, because set_zoom_custom returns early (graph_edit.cpp:2435-2437)', () => {
    const state = resolveGraphEditLoadState({ zoom: '2.0', zoom_max: '2.0' });
    expect(state.zoom).toBe(2);
    expect(state.zoomPlusDisabled).toBe(false);
  });

  it('re-clamps the CURRENT zoom when a bound moves past it (graph_edit.cpp:2486-2487)', () => {
    const state = resolveGraphEditLoadState({ zoom_min: '1.5' });
    expect(state.zoom).toBe(1.5);
    expect(state.zoomMinusDisabled).toBe(true);
  });

  it('leaves zoom at its default when a new min does not reach it', () => {
    const state = resolveGraphEditLoadState({ zoom_min: '0.5' });
    expect(state.zoom).toBe(1);
    expect(state.zoomMinusDisabled).toBe(false);
  });

  it('refuses a min above the current max, so neither bound nor zoom moves (graph_edit.cpp:2480)', () => {
    const state = resolveGraphEditLoadState({ zoom_min: '5.0', zoom: '0.5' });
    expect(state.zoom).toBe(0.5);
    expect(state.zoomMinusDisabled).toBe(false);
  });

  it('refuses a max below the current min (graph_edit.cpp:2495)', () => {
    const state = resolveGraphEditLoadState({ zoom_max: '0.1', zoom: '10.0' });
    expect(state.zoom).toBe(GRAPH_EDIT_DEFAULT_ZOOM_MAX);
  });

  it('parks zoom on the constructor min when the file drives it below', () => {
    const state = resolveGraphEditLoadState({ zoom: '0.01' });
    expect(state.zoom).toBe(GRAPH_EDIT_DEFAULT_ZOOM_MIN);
    expect(state.zoomMinusDisabled).toBe(true);
  });

  it('leaves zoom unset when the file states neither it nor a bound', () => {
    const state = resolveGraphEditLoadState(SIZED_400_320);
    expect(state.zoom).toBeUndefined();
    expect(state.zoomMinusDisabled).toBe(false);
    expect(state.zoomPlusDisabled).toBe(false);
  });
});
