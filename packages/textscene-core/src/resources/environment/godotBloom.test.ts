import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './parser';
import { createEnvironmentSettings } from './renderer';
import { bloomParamsFor } from './godotBloom';

function settings(props: Record<string, string>) {
  return createEnvironmentSettings(parseEnvironment(props));
}

describe('bloomParamsFor', () => {
  it('is null when glow is disabled — no post-process is mounted', () => {
    expect(bloomParamsFor(settings({}))).toBeNull();
  });

  it('maps the Godot glow defaults onto BloomEffect parameters', () => {
    const params = bloomParamsFor(settings({ glow_enabled: 'true' }));
    expect(params).not.toBeNull();
    // glow_hdr_threshold 1.0 -> luminanceThreshold; glow_intensity 0.8 -> intensity.
    expect(params?.luminanceThreshold).toBe(1);
    expect(params?.intensity).toBeCloseTo(0.8);
    // glow_strength 1.0 -> the base mip-blur radius.
    expect(params?.radius).toBeCloseTo(0.85);
    expect(params?.mipmapBlur).toBe(true);
  });

  it('reads authored values rather than hardcoding them', () => {
    const params = bloomParamsFor(
      settings({
        glow_enabled: 'true',
        glow_hdr_threshold: '2.0',
        glow_intensity: '1.5',
        glow_strength: '0.5',
      })
    );
    expect(params?.luminanceThreshold).toBe(2);
    expect(params?.intensity).toBeCloseTo(1.5);
    expect(params?.radius).toBeCloseTo(0.425); // 0.85 * 0.5
  });

  it('folds glow_bloom into a lowered effective threshold with a softer knee', () => {
    const params = bloomParamsFor(
      settings({ glow_enabled: 'true', glow_hdr_threshold: '1.0', glow_bloom: '0.4' })
    );
    // sub-threshold lift: threshold drops by glow_bloom, knee widens.
    expect(params?.luminanceThreshold).toBeCloseTo(0.6);
    expect(params?.luminanceSmoothing).toBeGreaterThan(0.05);
  });

  it('clamps the blur radius into 0..1 for a very high glow_strength', () => {
    const params = bloomParamsFor(settings({ glow_enabled: 'true', glow_strength: '10' }));
    expect(params?.radius).toBe(1);
  });
});
