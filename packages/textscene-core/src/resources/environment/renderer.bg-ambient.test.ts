/**
 * AMBIENT_SOURCE_BG — the DEFAULT `ambient_light_source` — lights the scene
 * from the background colour.
 *
 * Both Godot renderers agree (render_scene_data_rd.cpp / rasterizer_scene_gles3.cpp):
 *
 *   source == BG && (bg == CLEAR_COLOR || bg == COLOR):
 *     colour  = bg == CLEAR_COLOR ? project default_clear_color : background_color
 *     ambient = srgbToLinear(colour) * background_energy_multiplier
 *
 * We emitted flat ambient only for sources COLOR(2)/SKY(3), so an Environment
 * that never names a source — the common case, and what
 * scenes/demos/3d/graphics_settings/control.tscn does with a 0.6 grey
 * background — got no ambient at all.
 */
import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './parser';
import { createEnvironmentSettings } from './renderer';

function ambientFor(properties: Record<string, string>) {
  return createEnvironmentSettings(parseEnvironment(properties)).ambient;
}

describe('ambient from the background source', () => {
  it('uses background_color when background_mode is BG_COLOR (1)', () => {
    const ambient = ambientFor({
      background_mode: '1',
      background_color: 'Color(0.6, 0.6, 0.6, 1)',
    });
    expect(ambient).toEqual({ color: { r: 0.6, g: 0.6, b: 0.6, a: 1 }, energy: 1 });
  });

  it('scales that ambient by background_energy_multiplier', () => {
    const ambient = ambientFor({
      background_mode: '1',
      background_color: 'Color(0.6, 0.6, 0.6, 1)',
      background_energy_multiplier: '2.5',
    });
    expect(ambient?.energy).toBe(2.5);
  });

  it("uses Godot's default clear colour for BG_CLEAR_COLOR (0), the default mode", () => {
    // ProjectSettings rendering/environment/defaults/default_clear_color.
    expect(ambientFor({})).toEqual({ color: { r: 0.3, g: 0.3, b: 0.3, a: 1 }, energy: 1 });
  });

  it('emits no flat ambient for a sky background — that path is a cubemap', () => {
    expect(ambientFor({ background_mode: '2' })).toBeNull();
  });

  it('emits none when the source is explicitly DISABLED (1)', () => {
    expect(
      ambientFor({ ambient_light_source: '1', background_mode: '1', background_color: 'Color(1, 1, 1, 1)' })
    ).toBeNull();
  });

  it('still reads ambient_light_color/energy for an explicit COLOR source (2)', () => {
    const ambient = ambientFor({
      ambient_light_source: '2',
      ambient_light_color: 'Color(0.2, 0.4, 0.8, 1)',
      ambient_light_energy: '1.5',
      background_color: 'Color(1, 0, 0, 1)',
    });
    expect(ambient).toEqual({ color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, energy: 1.5 });
  });
});
