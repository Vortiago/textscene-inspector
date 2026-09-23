import { describe, it, expect } from 'vitest';
import { parsePointLight2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

const nodeHeading = heading('PointLight2D', { name: 'Light' });

describe('parsePointLight2D', () => {
  it('parses all typed properties correctly', () => {
    const p = parsePointLight2D(nodeHeading, {
      enabled: 'false',
      color: 'Color(1, 0.5, 0.25, 0.8)',
      energy: '3.5',
      blend_mode: '2',
      texture: 'ExtResource("1")',
      texture_scale: '2.0',
      offset: 'Vector2(10, -5)',
    });

    expect(p.enabled).toBe(false);
    expect(p.color).toEqual({ r: 1, g: 0.5, b: 0.25, a: 0.8 });
    expect(p.energy).toBe(3.5);
    expect(p.blend_mode).toBe(2);
    expect(p.texture).toBe('ExtResource("1")');
    expect(p.texture_scale).toBe(2.0);
    expect(p.offset).toEqual({ x: 10, y: -5 });
  });

  it('applies property-absent defaults (energy 1, blend_mode 0, texture_scale 1, enabled true, color white, offset (0,0))', () => {
    const p = parsePointLight2D(nodeHeading, {});

    expect(p.enabled).toBe(true);
    expect(p.color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(p.energy).toBe(1.0);
    expect(p.blend_mode).toBe(0);
    expect(p.texture).toBeUndefined();
    expect(p.texture_scale).toBe(1.0);
    expect(p.offset).toEqual({ x: 0, y: 0 });
  });

  it('warns and falls back on invalid energy', () => {
    const p = parsePointLight2D(nodeHeading, { energy: 'not_a_number' });
    expect(p.energy).toBe(1.0);
  });

  it('warns and falls back on invalid blend_mode (out of range)', () => {
    const p = parsePointLight2D(nodeHeading, { blend_mode: '99' });
    expect(p.blend_mode).toBe(0);
  });

  it('warns and falls back on invalid blend_mode (non-integer)', () => {
    // '1.5' → parseInt → 1 which is in [0,1,2], so it resolves to 1 (not a fallback)
    const p = parsePointLight2D(nodeHeading, { blend_mode: '1.5' });
    expect(p.blend_mode).toBe(1);
  });

  it('warns and falls back on invalid texture_scale', () => {
    const p = parsePointLight2D(nodeHeading, { texture_scale: 'abc' });
    expect(p.texture_scale).toBe(1.0);
  });

  it('warns and falls back on invalid enabled', () => {
    const p = parsePointLight2D(nodeHeading, { enabled: 'maybe' });
    expect(p.enabled).toBe(true);
  });

  it('warns and falls back on invalid color', () => {
    const p = parsePointLight2D(nodeHeading, { color: 'not_a_color' });
    expect(p.color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('warns and falls back on invalid offset', () => {
    const p = parsePointLight2D(nodeHeading, { offset: 'not_a_vector2' });
    expect(p.offset).toEqual({ x: 0, y: 0 });
  });

  it('parses all valid blend modes', () => {
    expect(parsePointLight2D(nodeHeading, { blend_mode: '0' }).blend_mode).toBe(0);
    expect(parsePointLight2D(nodeHeading, { blend_mode: '1' }).blend_mode).toBe(1);
    expect(parsePointLight2D(nodeHeading, { blend_mode: '2' }).blend_mode).toBe(2);
  });

  it('parses enabled as false', () => {
    const p = parsePointLight2D(nodeHeading, { enabled: 'false' });
    expect(p.enabled).toBe(false);
  });

  it('parses the two item cull masks', () => {
    const p = parsePointLight2D(nodeHeading, {
      range_item_cull_mask: '145',
      shadow_item_cull_mask: '17',
    });
    expect(p.range_item_cull_mask).toBe(145);
    expect(p.shadow_item_cull_mask).toBe(17);
  });

  it('defaults both cull masks to 1, so an untouched light reaches an untouched item', () => {
    const p = parsePointLight2D(nodeHeading, {});
    expect(p.range_item_cull_mask).toBe(1);
    expect(p.shadow_item_cull_mask).toBe(1);
  });

  it('keeps range_item_cull_mask separate from the node\'s own light_mask', () => {
    // A Light2D's `light_mask` is its CanvasItem mask, meaning which lights
    // reach the light node itself. It says nothing about what the light lights.
    // The dungeon's torches set it to 2 while culling items with the default 1.
    const p = parsePointLight2D(nodeHeading, { light_mask: '2' });
    expect(p.light_mask).toBe(2);
    expect(p.range_item_cull_mask).toBe(1);
  });

  it('warns and falls back on an invalid cull mask', () => {
    const p = parsePointLight2D(nodeHeading, { range_item_cull_mask: 'not_an_int' });
    expect(p.range_item_cull_mask).toBe(1);
  });

  it('parses the z and layer range windows', () => {
    const p = parsePointLight2D(nodeHeading, {
      range_z_min: '-8',
      range_z_max: '4',
      range_layer_min: '1',
      range_layer_max: '3',
    });
    expect(p.range_z_min).toBe(-8);
    expect(p.range_z_max).toBe(4);
    expect(p.range_layer_min).toBe(1);
    expect(p.range_layer_max).toBe(3);
  });

  it('defaults the range windows to Godot\'s own', () => {
    // `scene/2d/light_2d.h:50-53`: z_min = -1024, z_max = 1024, layer_min = 0,
    // layer_max = 0. The layer pair stops a default light reaching a default
    // CanvasLayer, whose `layer` is 1.
    const p = parsePointLight2D(nodeHeading, {});
    expect(p.range_z_min).toBe(-1024);
    expect(p.range_z_max).toBe(1024);
    expect(p.range_layer_min).toBe(0);
    expect(p.range_layer_max).toBe(0);
  });

  it('keeps a window value Godot itself would keep, unclamped', () => {
    // `Light2D::set_z_range_min` in `scene/2d/light_2d.cpp`, like its three
    // siblings, assigns with no CLAMP and no swap. Only the item's accumulated z
    // is clamped, at +/-4096, so nothing here may narrow the window.
    const p = parsePointLight2D(nodeHeading, { range_z_min: '-99999' });
    expect(p.range_z_min).toBe(-99999);
  });

  it('warns and falls back on an invalid range window value', () => {
    const p = parsePointLight2D(nodeHeading, { range_z_max: 'not_an_int', range_layer_min: 'x' });
    expect(p.range_z_max).toBe(1024);
    expect(p.range_layer_min).toBe(0);
  });

  it('inherits Node2D transform properties', () => {
    const p = parsePointLight2D(nodeHeading, {
      position: 'Vector2(50, 100)',
      z_index: '3',
    });
    expect(p.position).toEqual({ x: 50, y: 100 });
    expect(p.z_index).toBe(3);
  });
});
