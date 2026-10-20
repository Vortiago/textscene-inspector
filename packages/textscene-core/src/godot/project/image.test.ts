import { describe, expect, it } from 'vitest';
import { byteOf, channelOf } from './image';

describe('channelOf', () => {
  it('reads a byte as a float32 fraction of 255', () => {
    expect(channelOf(128)).toBe(Math.fround(128 / 255));
  });

  it('reads 0 and 255 as the unit ends (edge case)', () => {
    expect([channelOf(0), channelOf(255)]).toEqual([0, 1]);
  });
});

describe('byteOf', () => {
  it('truncates, not rounds, as Godot writes a byte', () => {
    expect(byteOf(0.999)).toBe(254);
  });

  it('clamps a channel past 1 to 255', () => {
    expect(byteOf(1.5)).toBe(255);
  });

  it('clamps a negative channel to 0 (edge case)', () => {
    expect(byteOf(-0.2)).toBe(0);
  });
});
