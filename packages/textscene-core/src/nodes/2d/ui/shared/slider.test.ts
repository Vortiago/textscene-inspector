/**
 * Godot-parity contract for the shared Slider base: `sliderTickIndices` transcribes the tick loop in
 * `Slider::_notification(NOTIFICATION_DRAW)` (scene/gui/slider.cpp). `tick_count` defaults to 0
 * (doc/classes/Slider.xml), so `ticks > 1` makes `ticks_on_borders = true` a no-op without a count,
 * as on `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn`'s HSlider, which Godot draws tickless.
 */
import { describe, it, expect } from 'vitest';
import { parseSlider, sliderTickIndices } from './slider';

const heading = { type: 'node', attributes: { type: 'HSlider', name: 'S' } };

describe('parseSlider', () => {
  it('carries the Control, Range and Slider properties together (happy path)', () => {
    const result = parseSlider(heading, {
      layout_mode: '2',
      value: '40',
      max_value: '80',
      tick_count: '5',
      ticks_on_borders: 'true',
      editable: 'false',
    });
    expect(result.name).toBe('S');
    expect(result.layoutMode).toBe(2);
    expect(result.value).toBe(40);
    expect(result.maxValue).toBe(80);
    expect(result.tickCount).toBe(5);
    expect(result.ticksOnBorders).toBe(true);
    expect(result.editable).toBe(false);
  });

  it('leaves a malformed tick_count undefined rather than defaulting to a count (error path)', () => {
    expect(parseSlider(heading, { tick_count: 'lots' }).tickCount).toBeUndefined();
  });

  it('leaves the Slider-specific properties undefined for a bare node (edge case)', () => {
    const result = parseSlider(heading, {});
    expect(result.tickCount).toBeUndefined();
    expect(result.ticksOnBorders).toBeUndefined();
    expect(result.editable).toBeUndefined();
  });
});

describe('sliderTickIndices', () => {
  it('draws no ticks when tick_count is unset — the acceptance scene case', () => {
    expect(sliderTickIndices({ name: 'S', ticksOnBorders: true })).toEqual([]);
  });

  it('draws no ticks for tick_count 1, since Godot guards on ticks > 1', () => {
    expect(sliderTickIndices({ name: 'S', tickCount: 1, ticksOnBorders: true })).toEqual([]);
  });

  it('skips the first and last tick unless ticks_on_borders is set', () => {
    expect(sliderTickIndices({ name: 'S', tickCount: 5 })).toEqual([1, 2, 3]);
  });

  it('keeps the border ticks when ticks_on_borders is set', () => {
    expect(sliderTickIndices({ name: 'S', tickCount: 5, ticksOnBorders: true })).toEqual([0, 1, 2, 3, 4]);
  });

  it('yields nothing for tick_count 2 without borders — both ticks ARE borders (edge case)', () => {
    expect(sliderTickIndices({ name: 'S', tickCount: 2 })).toEqual([]);
  });
});
