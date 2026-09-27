/**
 * The one side selector the capture CLIs share. A copy that reads each flag as turning the
 * other side off skips both sides for `--godot --ours`, then exits 0 claiming it re-rendered.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCaptureFlags } from './captureFlags.mjs';
import { parseArgs as parseCaptureArgs } from './capture/cli.mjs';
import { parseArgs as parseRecaptureArgs } from './recapture/cli.mjs';

describe('parseCaptureFlags', () => {
  it('selects both sides when no side flag is given', () => {
    expect(parseCaptureFlags([])).toEqual({ godot: true, ours: true, only: null });
  });

  it('selects exactly the named sides', () => {
    expect(parseCaptureFlags(['--godot'])).toEqual({ godot: true, ours: false, only: null });
    expect(parseCaptureFlags(['--ours'])).toEqual({ godot: false, ours: true, only: null });
    expect(parseCaptureFlags(['--ours', '--godot'])).toEqual({ godot: true, ours: true, only: null });
  });

  it('reads the fragment after --only', () => {
    expect(parseCaptureFlags(['--ours', '--only', 'sky']).only).toBe('sky');
  });

  it('refuses an unknown flag and a bare --only', () => {
    expect(() => parseCaptureFlags(['--onl', 'sky'])).toThrow('Unknown flag --onl');
    expect(() => parseCaptureFlags(['--only'])).toThrow('--only needs a name fragment');
  });

  it('accepts a switch only where the caller names it, defaulting it off', () => {
    expect(parseCaptureFlags([], ['force'])).toEqual({ godot: true, ours: true, only: null, force: false });
    expect(parseCaptureFlags(['--force'], ['force']).force).toBe(true);
    expect(() => parseCaptureFlags(['--force'])).toThrow('Unknown flag --force');
  });
});

describe('the capture CLIs select sides alike', () => {
  const COMBINATIONS = [[], ['--godot'], ['--ours'], ['--godot', '--ours'], ['--ours', '--godot']];

  it.each(COMBINATIONS)('capture and recapture agree on %j', (...flags) => {
    const { godot, ours } = parseCaptureArgs(flags);
    expect(parseRecaptureArgs(flags)).toEqual({ godot, ours, only: null });
  });

  it('parses a side flag only in captureFlags.mjs', () => {
    const here = import.meta.dirname;
    const sources = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs')) sources.push(path);
      }
    };
    walk(here);
    // A comparison or a `case` on the flag text is a parse. Emitting the flag for a child
    // process, as `recapture/complex.mjs` does, is not.
    const PARSES_SIDE_FLAG = /(?:===\s*|case\s+)'--(?:godot|ours)'/;
    const parsers = sources
      .filter((file) => PARSES_SIDE_FLAG.test(readFileSync(file, 'utf8')))
      .map((file) => relative(here, file));
    expect(parsers).toEqual([]);
  });
});
