import { describe, it, expect, vi, afterEach } from 'vitest';
import * as logger from '../../../../logger';
import { parseLight2D } from './parser';
import { LIGHT_2D_RANGE_DEFAULTS } from './types';
import { heading } from '../../../../parser/testing/parserKit';

afterEach(() => vi.restoreAllMocks());

describe('parseLight2D', () => {
  it("takes Godot's defaults for every absent property", () => {
    const p = parseLight2D(heading('PointLight2D', { name: 'Light' }), {});

    expect(p.enabled).toBe(true);
    expect(p.color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(p.energy).toBe(1);
    expect(p.blend_mode).toBe(0);
    expect(p.range_item_cull_mask).toBe(LIGHT_2D_RANGE_DEFAULTS.itemCullMask);
    expect([p.range_layer_min, p.range_layer_max]).toEqual([0, 0]);
    expect(p.shadow_enabled).toBe(false);
    expect(p.shadow_color).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('names the light type in the warning for a malformed value, and falls back', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const p = parseLight2D(heading('DirectionalLight2D', { name: 'Sun' }), { energy: '"bright"' });

    expect(p.energy).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DirectionalLight2D'));
  });

  it('keeps an inverted window as authored, since the setters never reorder it', () => {
    const p = parseLight2D(heading('PointLight2D', { name: 'Light' }), {
      range_z_min: '5',
      range_z_max: '4',
    });

    expect([p.range_z_min, p.range_z_max]).toEqual([5, 4]);
  });
});
