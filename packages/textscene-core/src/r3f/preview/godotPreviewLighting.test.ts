/**
 * Godot's editor preview lighting: what it is, and when it yields.
 *
 * `Node3DEditor::_node_added` keeps TWO INDEPENDENT counters over the edited
 * scene:
 *
 *   if (Object::cast_to<WorldEnvironment>(p_node))        world_env_count++;
 *   else if (Object::cast_to<DirectionalLight3D>(p_node)) directional_light_count++;
 *
 *   bool disable_light = directional_light_count > 0 || !sun_button->is_pressed();
 *   bool disable_env   = world_env_count > 0        || !environ_button->is_pressed();
 *
 * So the test matrix is: by node TYPE only (never visibility, never whether the
 * node emits anything), and the two previews never move together.
 *
 * The values come from `_load_default_preview_settings` and
 * `_preview_settings_changed`, which are pinned here because a wrong preview is
 * indistinguishable from a wrong renderer once it is on screen.
 */
import { describe, expect, it } from 'vitest';
import { BackgroundMode } from '../../resources/environment/types';
import {
  PREVIEW_SUN_ALTITUDE_DEG,
  PREVIEW_SUN_AZIMUTH_DEG,
  previewEnvironment,
  previewSunDirection,
  previewYield,
} from './godotPreviewLighting';
import type { ProceduralSkyProperties } from '../../resources/sky/types';

describe('previewYield', () => {
  const on = { sun: true, environment: true };

  it('gives an empty scene both previews', () => {
    expect(previewYield([], on)).toEqual({ sun: true, environment: true });
  });

  it('drops only the sun when the scene has a DirectionalLight3D', () => {
    expect(previewYield(['Node3D', 'DirectionalLight3D'], on)).toEqual({
      sun: false,
      environment: true,
    });
  });

  it('drops only the environment when the scene has a WorldEnvironment', () => {
    expect(previewYield(['WorldEnvironment', 'MeshInstance3D'], on)).toEqual({
      sun: true,
      environment: false,
    });
  });

  it('drops both when the scene has both', () => {
    expect(previewYield(['DirectionalLight3D', 'WorldEnvironment'], on)).toEqual({
      sun: false,
      environment: false,
    });
  });

  it('keeps the preview sun for lights that are not directional', () => {
    // Godot's cast_to<DirectionalLight3D> matches neither; a scene lit only by
    // an OmniLight still gets the preview sun, and looks it.
    expect(previewYield(['OmniLight3D', 'SpotLight3D'], on).sun).toBe(true);
  });

  it('counts a node however deep it sits', () => {
    // The counter walks the whole edited scene, instanced sub-scenes included.
    expect(previewYield(['Node3D', 'Node3D', 'DirectionalLight3D'], on).sun).toBe(false);
  });

  it('honours the manual toggles independently of the scene', () => {
    expect(previewYield([], { sun: false, environment: true })).toEqual({
      sun: false,
      environment: true,
    });
    expect(previewYield([], { sun: true, environment: false })).toEqual({
      sun: true,
      environment: false,
    });
  });
});

describe('previewSunDirection', () => {
  it('points down and to the side, from Godot’s authored angles', () => {
    // altitude -60°, azimuth 150°, applied to the light's local -Z in Godot's
    // YXZ euler order. Hand-computed: Ry(150°)·Rx(-60°)·(0,0,-1).
    const direction = previewSunDirection();
    expect(direction.x).toBeCloseTo(-0.25, 4);
    expect(direction.y).toBeCloseTo(-0.866025, 4);
    expect(direction.z).toBeCloseTo(0.433013, 4);
  });

  it('is a unit vector', () => {
    expect(previewSunDirection().length()).toBeCloseTo(1, 6);
  });

  it('sits at the documented 60 degrees above the horizon', () => {
    // "These default rotations place the preview sun at an angular altitude of
    // 60 degrees" — the comment in _load_default_preview_settings.
    const altitude = Math.asin(-previewSunDirection().y) * (180 / Math.PI);
    expect(altitude).toBeCloseTo(60, 4);
    expect(PREVIEW_SUN_ALTITUDE_DEG).toBe(-60);
    expect(PREVIEW_SUN_AZIMUTH_DEG).toBe(150);
  });
});

describe('previewEnvironment', () => {
  it('is a sky background whose ambient comes from that sky', () => {
    const { settings } = previewEnvironment();
    expect(settings.background.mode).toBe(BackgroundMode.BG_SKY);
    expect(settings.skyAmbient).toEqual({ energy: 1, contribution: 1 });
  });

  it('tonemaps with FILMIC, as the editor preview does', () => {
    expect(previewEnvironment().settings.toneMapping.mode).toBe(2);
  });

  it('carries Godot’s authored sky and ground colours', () => {
    const sky = previewEnvironment().sky as ProceduralSkyProperties;
    expect(sky.kind).toBe('procedural');
    expect(sky.sky_top_color).toMatchObject({ r: 0.385, g: 0.454, b: 0.55 });
    expect(sky.ground_bottom_color).toMatchObject({ r: 0.2, g: 0.169, b: 0.133 });
  });

  it('derives the horizon colour by Godot’s luminance push, not by a plain blend', () => {
    // _preview_settings_changed:
    //   hz     = sky.lerp(ground, 0.5)              -> (0.2925, 0.3115, 0.3415)
    //   hz_lum = hz.get_luminance() * 3.333         -> 1.0320
    //   hz     = hz.lerp(Color(lum, lum, lum), 0.5) -> (0.6623, 0.6718, 0.6868)
    // The midpoint alone would be a muddy grey-blue; the push is what makes
    // Godot's horizon bright.
    const sky = previewEnvironment().sky as ProceduralSkyProperties;
    expect(sky.sky_horizon_color.r).toBeCloseTo(0.6623, 3);
    expect(sky.sky_horizon_color.g).toBeCloseTo(0.6718, 3);
    expect(sky.sky_horizon_color.b).toBeCloseTo(0.6868, 3);
  });

  it('uses one horizon colour for both the sky and the ground half', () => {
    const sky = previewEnvironment().sky as ProceduralSkyProperties;
    expect(sky.ground_horizon_color).toEqual(sky.sky_horizon_color);
  });
});
