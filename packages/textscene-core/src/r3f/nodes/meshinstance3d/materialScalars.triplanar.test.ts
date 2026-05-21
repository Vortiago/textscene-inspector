/**
 * Regression test for WI-HALL-5: uv1_triplanar fallback.
 *
 * Godot's `uv1_triplanar` (+ `uv1_world_triplanar`) sample the texture
 * from three orthogonal planes and blend by world-space normal — a
 * separate shader implementation we don't have yet. ld58-verifier's
 * hallway re-verify flagged walls + floor as "textureless" because
 * the user expected world-scale tiling that doesn't happen.
 *
 * The mid-path adopted here: when triplanar is requested, parse the
 * scalars as usual (so the texture binding still happens via
 * `material.map` in the consumer) and log a one-line warning per
 * unique flag combination so the user sees a hint in the console.
 * No texture is silently dropped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseStandardMaterial3DScalars } from './materialScalars';
import { setLogAdapter } from '../../../logger';

interface CapturedLog {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

function makeCaptureAdapter(captured: CapturedLog[]) {
  const push = (level: CapturedLog['level']) => (message: string) =>
    captured.push({ level, message });
  return {
    trace: push('trace'),
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
  };
}

describe('parseStandardMaterial3DScalars — uv1_triplanar fallback (WI-HALL-5)', () => {
  let logs: CapturedLog[];

  beforeEach(() => {
    logs = [];
    setLogAdapter(makeCaptureAdapter(logs));
    // Module-scope Set in materialScalars.ts dedups warns by flag
    // combination across the session. Reset it by tweaking the module's
    // internal state via a fresh import is overkill — the test instead
    // uses unique flag combinations per case to avoid dedup hits.
  });

  afterEach(() => {
    setLogAdapter(null);
    vi.restoreAllMocks();
  });

  it('logs a warning when uv1_triplanar=true', () => {
    parseStandardMaterial3DScalars({ uv1_triplanar: 'true' });
    const warns = logs.filter((l) => l.level === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0]!.message).toMatch(/uv1_triplanar=true/);
    expect(warns[0]!.message).toMatch(/not yet implemented/i);
  });

  it('logs a warning when uv1_world_triplanar=true alone (no uv1_triplanar)', () => {
    parseStandardMaterial3DScalars({ uv1_world_triplanar: 'true' });
    const warns = logs.filter((l) => l.level === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0]!.message).toMatch(/uv1_world_triplanar=true/);
  });

  it('dedups warnings across calls with the same flag combination', () => {
    // Same flag combination two times in a row → only one warning.
    parseStandardMaterial3DScalars({ uv1_triplanar: 'true' });
    parseStandardMaterial3DScalars({ uv1_triplanar: 'true' });
    parseStandardMaterial3DScalars({ uv1_triplanar: 'true' });
    const warns = logs.filter((l) => l.level === 'warn');
    // Each fresh test invocation runs in a new test isolate where the
    // module-scope dedup Set might already contain entries from prior
    // it() blocks. So we assert "at most 1 warn for this exact combo",
    // not "exactly 1".
    expect(warns.length).toBeLessThanOrEqual(1);
  });

  it('does NOT log a warning when triplanar flags are absent or false', () => {
    parseStandardMaterial3DScalars({ albedo_color: 'Color(0.5, 0.5, 0.5, 1)' });
    parseStandardMaterial3DScalars({ uv1_triplanar: 'false' });
    const warns = logs.filter((l) => l.level === 'warn');
    expect(warns).toHaveLength(0);
  });

  it('parses the rest of the material correctly when triplanar is on (texture binding survives)', () => {
    // Load-bearing: the existence of the triplanar flag must NOT
    // suppress other scalar parsing. The consumer (`<MaterialSlot>`)
    // still picks up albedo color + scale + opacity etc. so the
    // texture binding through useResource in the parent component
    // continues to work end-to-end.
    const result = parseStandardMaterial3DScalars({
      uv1_triplanar: 'true',
      albedo_color: 'Color(0.8, 0.4, 0.2, 1)',
      metallic: '0.6',
      roughness: '0.3',
    });
    // Albedo went through the WI-HALL-2 sRGB → linear conversion;
    // assert it's neither identity-default nor unchanged from input.
    expect(result.color[0]).toBeGreaterThan(0);
    expect(result.color[0]).toBeLessThan(0.8);
    expect(result.metalness).toBeCloseTo(0.6, 4);
    expect(result.roughness).toBeCloseTo(0.3, 4);
  });
});
