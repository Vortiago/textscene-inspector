import { describe, it, expect } from 'vitest';
import { LINE_CAP_MODE_NAMES, LINE_JOINT_MODE_NAMES, LINE_TEXTURE_MODE_NAMES } from './line2d.js';

describe('Line2D mode names', () => {
  it('names each joint mode as `line_2d.cpp:404` hints it', () => {
    expect(LINE_JOINT_MODE_NAMES).toEqual({ 0: 'SHARP', 1: 'BEVEL', 2: 'ROUND' });
  });

  it('names each cap mode as `line_2d.cpp:405` hints it', () => {
    expect(LINE_CAP_MODE_NAMES).toEqual({ 0: 'NONE', 1: 'BOX', 2: 'ROUND' });
  });

  it('names each texture mode as `line_2d.cpp:402` hints it', () => {
    expect(LINE_TEXTURE_MODE_NAMES).toEqual({ 0: 'NONE', 1: 'TILE', 2: 'STRETCH' });
  });
});
