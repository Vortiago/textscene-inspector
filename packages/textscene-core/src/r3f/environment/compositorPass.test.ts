/**
 * Whether the compositor's tone pass mounts, and whether it carries glow. Godot runs the glow chain
 * whenever the environment enables glow (`renderer_scene_render_rd.cpp:575`, `:686`), whatever the
 * scene holds, and its bright pass picks the pixels.
 */

import { describe, expect, it } from 'vitest';
import { compositorPassFor } from './compositorPass';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';

function settingsOf(properties: Record<string, string>) {
  return createEnvironmentSettings(decodeEnvironment(properties), DEFAULT_CLEAR_COLOR);
}

const NOTHING_BLENDED = false;
const NO_MSAA = 0;

describe('compositorPassFor', () => {
  it('carries glow when the environment enables it, with nothing emissive in the scene', () => {
    const pass = compositorPassFor(settingsOf({ glow_enabled: 'true' }), NOTHING_BLENDED, NO_MSAA);
    expect(pass?.glow).not.toBeNull();
  });

  it('mounts no pass when glow is disabled and nothing else needs one', () => {
    expect(compositorPassFor(settingsOf({ glow_enabled: 'false' }), NOTHING_BLENDED, NO_MSAA)).toBeNull();
  });

  it('mounts a pass without glow for a blended surface', () => {
    const pass = compositorPassFor(settingsOf({ glow_enabled: 'false' }), true, NO_MSAA);
    expect(pass).toEqual({ glow: null, samples: 0 });
  });

  it('mounts a pass without glow for the adjustments alone', () => {
    const pass = compositorPassFor(settingsOf({ adjustment_enabled: 'true' }), NOTHING_BLENDED, NO_MSAA);
    expect(pass).toEqual({ glow: null, samples: 0 });
  });

  it('mounts a multisampled pass without glow for MSAA alone', () => {
    // Godot resolves the multisampled 3D buffer before the tonemap pass reads it.
    const pass = compositorPassFor(settingsOf({ glow_enabled: 'false' }), NOTHING_BLENDED, 4);
    expect(pass).toEqual({ glow: null, samples: 4 });
  });

  it('multisamples a pass that glow mounts', () => {
    expect(compositorPassFor(settingsOf({ glow_enabled: 'true' }), NOTHING_BLENDED, 2)?.samples).toBe(2);
  });

  it('mounts no pass for an enabled glow whose every level weight is zero', () => {
    const levels = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((level) => [`glow_levels/${level}`, '0.0']));
    expect(
      compositorPassFor(settingsOf({ glow_enabled: 'true', ...levels }), NOTHING_BLENDED, NO_MSAA)
    ).toBeNull();
  });
});

describe('compositorPassFor with no Environment', () => {
  it('mounts no pass when nothing blends and MSAA is off', () => {
    expect(compositorPassFor(null, NOTHING_BLENDED, NO_MSAA)).toBeNull();
  });

  it('mounts a multisampled pass without glow for MSAA alone', () => {
    // Godot multisamples and resolves the 3D buffer with or without an Environment.
    expect(compositorPassFor(null, NOTHING_BLENDED, 4)).toEqual({ glow: null, samples: 4 });
  });

  it('mounts a pass without glow for a blended surface', () => {
    expect(compositorPassFor(null, true, NO_MSAA)).toEqual({ glow: null, samples: 0 });
  });
});
