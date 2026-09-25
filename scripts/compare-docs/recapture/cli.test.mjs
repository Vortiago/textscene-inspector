/**
 * The recapture flags: a dropped `--only` re-renders every committed image and
 * reports success.
 */

import { describe, expect, it } from 'vitest';
import { parseArgs } from './cli.mjs';

describe('recapture flags', () => {
  it('renders both sides by default', () => {
    expect(parseArgs([])).toEqual({ godot: true, ours: true, only: null });
  });

  it('lets each flag select its own side', () => {
    expect(parseArgs(['--ours'])).toEqual({ godot: false, ours: true, only: null });
    expect(parseArgs(['--godot'])).toEqual({ godot: true, ours: false, only: null });
  });

  it('takes the fragment after --only', () => {
    expect(parseArgs(['--only', 'unit-decal']).only).toBe('unit-decal');
  });

  it('refuses a flag it does not know, rather than re-rendering everything', () => {
    expect(() => parseArgs(['--onl', 'unit-decal'])).toThrow(/Unknown flag --onl/);
    expect(() => parseArgs(['--force'])).toThrow(/Unknown flag --force/);
  });

  it('refuses --only with nothing after it', () => {
    expect(() => parseArgs(['--only'])).toThrow(/--only needs an image-name fragment/);
  });

  it('refuses the pair that selects neither side', () => {
    expect(() => parseArgs(['--godot', '--ours'])).toThrow(/mutually exclusive/);
  });
});
