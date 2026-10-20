/**
 * `frame = true` in a Sprite2D stores frame 1 (`variant.h:365-366`). Measured on Godot 4.6.3
 * with `pnpm ref:godot --mode 2d`: a 64x32 texture, left half red and right half blue,
 * `hframes = 2` and `frame = true` probes `rgb(0, 0, 255)`, which is frame 1.
 */

import { describe, expect, it } from 'vitest';
import { replaySpriteFrames } from './spriteFrames.js';

describe('replaySpriteFrames with a boolean in a numeric slot', () => {
  it('lands frame 1 for frame = true', () => {
    expect(replaySpriteFrames({ hframes: '2', frame: 'true' }).frame).toBe(1);
  });

  it('lands frame 0 for frame = false', () => {
    expect(replaySpriteFrames({ hframes: '2', frame: 'false' }).frame).toBe(0);
  });
});
