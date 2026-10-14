/**
 * Whether the compositor's tone pass mounts, and whether it carries glow. Godot runs the glow chain
 * whenever the environment enables glow (`renderer_scene_render_rd.cpp:575`, `:686`), whatever the
 * scene holds, and its bright pass picks the pixels.
 */

import { describe, expect, it } from 'vitest';
import { compositorPassFor } from './compositorPass';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering';

function settingsOf(properties: Record<string, string>) {
  return createEnvironmentSettings(decodeEnvironment(properties), DEFAULT_CLEAR_COLOR);
}

const NOTHING_BLENDED = false;

describe('compositorPassFor', () => {
  it('carries glow when the environment enables it, with nothing emissive in the scene', () => {
    const pass = compositorPassFor(settingsOf({ glow_enabled: 'true' }), NOTHING_BLENDED);
    expect(pass?.glow).not.toBeNull();
  });

  it('mounts no pass when glow is disabled and nothing else needs one', () => {
    expect(compositorPassFor(settingsOf({ glow_enabled: 'false' }), NOTHING_BLENDED)).toBeNull();
  });

  it('mounts a pass without glow for a blended surface', () => {
    const pass = compositorPassFor(settingsOf({ glow_enabled: 'false' }), true);
    expect(pass).toEqual({ glow: null });
  });

  it('mounts a pass without glow for the adjustments alone', () => {
    const pass = compositorPassFor(settingsOf({ adjustment_enabled: 'true' }), NOTHING_BLENDED);
    expect(pass).toEqual({ glow: null });
  });

  it('mounts no pass for an enabled glow whose every level weight is zero', () => {
    const levels = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((level) => [`glow_levels/${level}`, '0.0']));
    expect(compositorPassFor(settingsOf({ glow_enabled: 'true', ...levels }), NOTHING_BLENDED)).toBeNull();
  });
});
