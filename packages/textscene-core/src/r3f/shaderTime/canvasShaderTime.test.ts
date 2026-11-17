import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { canvasShaderTime } from './canvasShaderTime';
import type { Playback } from '../../shaders/time/shaderClock';

const NO_PLAYER: Playback = { hasPlayer: false, playState: 'stopped', playhead: 0, seeks: 0 };

describe('CanvasShaderTime', () => {
  it('advances by the step of each frame', () => {
    const time = canvasShaderTime({} as THREE.WebGLRenderer);
    time.advance(1, NO_PLAYER, 0.5, 3600);
    time.advance(2, NO_PLAYER, 0.25, 3600);
    expect(time.time).toBe(0.75);
  });

  it('advances once for a frame that two shaders ask for', () => {
    const time = canvasShaderTime({} as THREE.WebGLRenderer);
    time.advance(1, NO_PLAYER, 0.5, 3600);
    time.advance(1, NO_PLAYER, 0.5, 3600);
    expect(time.time).toBe(0.5);
  });

  it("wraps at the project's rollover", () => {
    const time = canvasShaderTime({} as THREE.WebGLRenderer);
    time.advance(1, NO_PLAYER, 1.5, 1);
    expect(time.time).toBe(0.5);
  });

  it('keeps its time, wrapped, when the rollover changes', () => {
    const time = canvasShaderTime({} as THREE.WebGLRenderer);
    time.advance(1, NO_PLAYER, 2.5, 3600);
    time.advance(2, NO_PLAYER, 0, 2);
    expect(time.time).toBe(0.5);
  });

  it('holds while the animation is paused', () => {
    const time = canvasShaderTime({} as THREE.WebGLRenderer);
    time.advance(1, NO_PLAYER, 0.5, 3600);
    time.advance(2, { hasPlayer: true, playState: 'paused', playhead: 0, seeks: 0 }, 0.5, 3600);
    expect(time.time).toBe(0.5);
  });
});
