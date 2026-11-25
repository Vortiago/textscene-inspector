import { describe, it, expect } from 'vitest';
import { formatSprite3DProperties } from './propertyFormatter';
import { sectionIn } from '../../testing/inspectedScene';

async function section(title: string, properties: Record<string, string> = {}) {
  return sectionIn(formatSprite3DProperties, 'Sprite3D', title, properties, {
    ext: { '1_tex': 'Texture2D' },
  });
}

describe('formatSprite3DProperties', () => {
  it('lists texture, pixel size, and billboard with defaults (billboard disabled)', async () => {
    const texture = (await section('Texture'))!;

    expect(texture.items).toEqual([
      { label: 'Texture', value: '(none)' },
      { label: 'Pixel Size', value: '0.0100' },
      { label: 'Billboard', value: 'Disabled' },
    ]);
  });

  it('lists the Axis item only when billboard is Y-Axis Only (FIXED_Y)', async () => {
    const withoutAxis = (await section('Texture'))!;
    expect(withoutAxis.items.some((i) => i.label === 'Axis')).toBe(false);

    const withAxis = (await section('Texture', { billboard: '2', axis: '0' }))!;
    expect(withAxis.items).toContainEqual({ label: 'Billboard', value: 'Y-Axis Only' });
    expect(withAxis.items).toContainEqual({ label: 'Axis', value: 'X' });
  });

  it('reports every billboard mode name', async () => {
    expect((await section('Texture', { billboard: '1' }))!.items).toContainEqual({
      label: 'Billboard',
      value: 'Enabled',
    });
  });

  it('lists the texture resource path the file sets', async () => {
    const texture = (await section('Texture', { texture: 'ExtResource("1_tex")' }))!;
    expect(texture.items).toContainEqual({ label: 'Texture', value: 'res://1_tex' });
  });

  it('lists no Sprite Sheet section for a single-frame sprite (default)', async () => {
    expect(await section('Sprite Sheet')).toBeUndefined();
  });

  it('lists the Sprite Sheet section with frame coords when hframes/vframes/frame are set', async () => {
    const sheet = (await section('Sprite Sheet', {
      hframes: '4',
      vframes: '2',
      frame: '3',
      frame_coords: 'Vector2i(3, 0)',
    }))!;
    expect(sheet.items).toEqual([
      { label: 'HFrames', value: '4' },
      { label: 'VFrames', value: '2' },
      { label: 'Frame', value: '3' },
      { label: 'Frame Coords', value: '(3, 0)' },
    ]);
  });

  it('lists the Region section only when region_enabled with a rect', async () => {
    const withRegion = (await section('Region', {
      region_enabled: 'true',
      region_rect: 'Rect2(0, 0, 32, 16)',
    }))!;
    expect(withRegion.items).toEqual([
      { label: 'Enabled', value: 'true' },
      { label: 'Rect', value: '(0, 0, 32, 16)' },
    ]);

    const withoutFlag = await section('Region', { region_rect: 'Rect2(0, 0, 32, 16)' });
    expect(withoutFlag).toBeUndefined();
  });

  it('lists the Appearance section with modulate, transparency, alpha cut, offset, render priority', async () => {
    const appearance = (await section('Appearance', {
      modulate: 'Color(1, 0.5, 0, 0.8)',
      transparency: '0.25',
      alpha_cut: '1',
      offset: 'Vector2(2, -3)',
      render_priority: '5',
    }))!;
    expect(appearance.items).toEqual([
      { label: 'Modulate', value: 'rgba(255, 128, 0, 0.80)' },
      { label: 'Transparency', value: '0.25' },
      { label: 'Alpha Cut', value: 'Discard' },
      { label: 'Offset', value: '(2, -3)' },
      { label: 'Render Priority', value: '5' },
    ]);
  });

  it('reports every alpha-cut mode name', async () => {
    const appearance = (await section('Appearance', { alpha_cut: '2' }))!;
    expect(appearance.items).toContainEqual({ label: 'Alpha Cut', value: 'Opaque Prepass' });
  });

  it('appends the Node3D transform sections', async () => {
    const transform = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)' };
    expect(await section('Position', transform)).toBeDefined();
    expect(await section('Scale', transform)).toBeDefined();
  });
});

describe('formatSprite3DProperties alpha_cut', () => {
  it("names ALPHA_CUT_HASH with Godot's hint label (sprite_3d.cpp:691)", async () => {
    expect((await section('Appearance', { alpha_cut: '3' }))!.items).toContainEqual({
      label: 'Alpha Cut',
      value: 'Alpha Hash',
    });
  });
});
