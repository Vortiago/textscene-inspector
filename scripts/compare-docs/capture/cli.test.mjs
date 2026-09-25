/**
 * The capture flags: the shared side selector plus `--force`, which re-renders an
 * image that already exists instead of resuming past it.
 */

import { describe, expect, it } from 'vitest';
import { parseArgs } from './cli.mjs';

describe('capture flags', () => {
  it('renders both sides and keeps existing images by default', () => {
    expect(parseArgs([])).toEqual({ godot: true, ours: true, only: null, force: false });
  });

  it('takes --force beside a side flag and a fragment', () => {
    expect(parseArgs(['--ours', '--force', '--only', 'decal'])).toEqual({
      godot: false,
      ours: true,
      only: 'decal',
      force: true,
    });
  });

  it('refuses a bare --only rather than capturing every fixture', () => {
    expect(() => parseArgs(['--only'])).toThrow(/--only needs a name fragment/);
  });

  it('refuses a flag it does not know', () => {
    expect(() => parseArgs(['--forse'])).toThrow(/Unknown flag --forse/);
  });
});
