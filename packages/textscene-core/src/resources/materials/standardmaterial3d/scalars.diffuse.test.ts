/**
 * StandardMaterial3D `diffuse_mode`: the direct diffuse term Godot's light function writes. The
 * render side applies it (`godotDiffuse.ts`).
 */

import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';
import { DiffuseMode } from '../../../godot/diffuseMode';

describe('parseStandardMaterial3DScalars: diffuse_mode', () => {
  it('defaults to Burley', () => {
    // `material.h:608`.
    expect(parseStandardMaterial3DScalars({}).diffuseMode).toBe(DiffuseMode.DIFFUSE_BURLEY);
  });

  it('reads an authored mode', () => {
    expect(parseStandardMaterial3DScalars({ diffuse_mode: '3' }).diffuseMode).toBe(DiffuseMode.DIFFUSE_TOON);
  });

  it('keeps a mode past the enum, which the setter stores unchecked', () => {
    // `material.cpp:2462-2468`: no range check, and `_update_shader` writes no render mode for it.
    expect(parseStandardMaterial3DScalars({ diffuse_mode: '7' }).diffuseMode).toBe(7);
  });

  it('falls back to Burley for a malformed mode', () => {
    expect(parseStandardMaterial3DScalars({ diffuse_mode: 'nope' }).diffuseMode).toBe(
      DiffuseMode.DIFFUSE_BURLEY
    );
  });
});
