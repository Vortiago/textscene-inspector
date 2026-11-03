import { describe, expect, it } from 'vitest';
import { ReflectionFrames } from './reflectionFrames';

describe('ReflectionFrames', () => {
  it('asks for a second frame after the first, which reflects no last frame', () => {
    expect(new ReflectionFrames().traced()).toBe(true);
  });

  it('asks for no frame after the one it asked for, which reflects a settled last frame', () => {
    const frames = new ReflectionFrames();
    frames.traced();

    expect(frames.traced()).toBe(false);
  });

  it('asks again after a later frame, which may draw a changed scene its reflection lags', () => {
    const frames = new ReflectionFrames();
    frames.traced();
    frames.traced();

    expect(frames.traced()).toBe(true);
  });
});
