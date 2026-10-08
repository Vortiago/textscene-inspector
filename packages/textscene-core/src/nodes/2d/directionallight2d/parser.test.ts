import { describe, it, expect } from 'vitest';
import { parseDirectionalLight2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

const nodeHeading = heading('DirectionalLight2D', { name: 'Sun' });

describe('parseDirectionalLight2D', () => {
  it('parses its own members', () => {
    const p = parseDirectionalLight2D(nodeHeading, { height: '0.5', max_distance: '2000.0' });

    expect(p.height).toBe(0.5);
    expect(p.max_distance).toBe(2000);
  });

  it('parses the inherited Light2D surface', () => {
    const p = parseDirectionalLight2D(nodeHeading, {
      enabled: 'false',
      color: 'Color(1, 0.5, 0.25, 0.8)',
      energy: '0.5',
      blend_mode: '2',
      range_layer_min: '-1',
      range_layer_max: '3',
      shadow_enabled: 'true',
      shadow_color: 'Color(0, 0, 1, 0.5)',
      shadow_filter: '1',
      shadow_filter_smooth: '1.2',
      shadow_item_cull_mask: '6',
    });

    expect(p.enabled).toBe(false);
    expect(p.color).toEqual({ r: 1, g: 0.5, b: 0.25, a: 0.8 });
    expect(p.energy).toBe(0.5);
    expect(p.blend_mode).toBe(2);
    expect([p.range_layer_min, p.range_layer_max]).toEqual([-1, 3]);
    expect(p.shadow_enabled).toBe(true);
    expect(p.shadow_color).toEqual({ r: 0, g: 0, b: 1, a: 0.5 });
    expect(p.shadow_filter).toBe(1);
    expect(p.shadow_filter_smooth).toBe(1.2);
    expect(p.shadow_item_cull_mask).toBe(6);
  });

  it('takes Godot defaults for an untouched light: height 0 and max_distance 10000', () => {
    // light_2d.h:59 (height) and light_2d.h:188 (max_distance).
    const p = parseDirectionalLight2D(nodeHeading, {});

    expect(p.height).toBe(0);
    expect(p.max_distance).toBe(10000);
    expect(p.enabled).toBe(true);
    expect(p.energy).toBe(1);
    expect(p.shadow_enabled).toBe(false);
    expect([p.range_layer_min, p.range_layer_max]).toEqual([0, 0]);
  });

  it('falls back to the default on a malformed max_distance', () => {
    const p = parseDirectionalLight2D(nodeHeading, { max_distance: 'far' });
    expect(p.max_distance).toBe(10000);
  });

  it('keeps the Node2D transform it inherits', () => {
    const p = parseDirectionalLight2D(nodeHeading, { rotation: '0.5' });
    expect(p.rotation).toBe(0.5);
  });
});
