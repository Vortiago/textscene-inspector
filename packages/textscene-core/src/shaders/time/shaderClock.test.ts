import { describe, expect, it } from 'vitest';
import { PlaybackShaderTime, ShaderClock } from './shaderClock.js';

describe('ShaderClock', () => {
  it('starts at 0 and adds each frame step before the frame draws', () => {
    const clock = new ShaderClock();
    expect(clock.time).toBe(0);
    expect(clock.advance(0.25)).toBe(0.25);
    expect(clock.advance(0.5)).toBe(0.75);
  });

  it("takes the sum modulo Godot's default rollover of 3600 s", () => {
    const clock = new ShaderClock();
    clock.set(3599.75);
    expect(clock.advance(0.5)).toBe(0.25);
  });

  it("takes the sum modulo the project's rollover", () => {
    const clock = new ShaderClock(10);
    expect(clock.advance(12.5)).toBe(2.5);
  });

  it('keeps the double sum, as Godot keeps `time` in a double', () => {
    const clock = new ShaderClock();
    for (let frame = 0; frame < 3; frame += 1) clock.advance(0.1);
    expect(clock.time).toBe(0.1 + 0.1 + 0.1);
  });
});

const playback = (playState: 'stopped' | 'playing' | 'paused', playhead = 0, seeks = 0) => ({
  hasPlayer: true,
  playState,
  playhead,
  seeks,
});

describe('PlaybackShaderTime jumps', () => {
  const paused = { hasPlayer: true, playState: 'paused', playhead: 0, seeks: 0 } as const;

  it('counts a seek that moves TIME', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(paused, 0);
    time.frame({ ...paused, seeks: 1, playhead: 2 }, 0);
    expect(time.jumps).toBe(1);
  });

  it('counts a stop that moves TIME to 0 once, while it stays stopped', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame({ ...paused, playState: 'playing' }, 0.5);
    time.frame({ ...paused, playState: 'stopped' }, 0.5);
    time.frame({ ...paused, playState: 'stopped' }, 0.5);
    expect(time.jumps).toBe(1);
  });

  it('counts no frame that advances TIME, nor a seek to the TIME it holds (edge case)', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame({ ...paused, playState: 'playing' }, 0.5);
    time.frame({ ...paused, seeks: 1, playhead: 0.5 }, 0);
    expect(time.jumps).toBe(0);
  });
});

describe('PlaybackShaderTime', () => {
  it('advances every frame in a scene with no AnimationPlayer', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    const none = { hasPlayer: false, playState: 'stopped', playhead: 0, seeks: 0 } as const;
    time.frame(none, 0.5);
    expect(time.frame(none, 0.5)).toBe(1);
  });

  it('shows 0 while stopped', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('playing'), 2);
    expect(time.frame(playback('stopped'), 2)).toBe(0);
  });

  it('advances while playing and holds while paused', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('playing', 0.5), 0.5);
    time.frame(playback('playing', 1), 0.5);
    expect(time.frame(playback('paused', 1), 0.5)).toBe(1);
    expect(time.frame(playback('paused', 1), 0.5)).toBe(1);
  });

  it('sets TIME to the playhead on a seek', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('paused', 1), 0.5);
    expect(time.frame(playback('paused', 4.25, 1), 0.5)).toBe(4.25);
  });

  it('sets TIME to the playhead on a seek to the playhead it is at', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('playing', 1), 0.5);
    time.frame(playback('paused', 1), 0.5);
    expect(time.frame(playback('paused', 1, 1), 0.5)).toBe(1);
  });

  it('sets TIME to the playhead on a seek while playing', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('playing', 0), 0.5);
    expect(time.frame(playback('playing', 3, 1), 0.5)).toBe(3);
  });

  it('holds TIME when the playhead moves with no seek while paused', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('paused', 1), 0.5);
    expect(time.frame(playback('paused', 2), 0.5)).toBe(0);
  });

  it('advances from the sought time when play starts again', () => {
    const time = new PlaybackShaderTime(new ShaderClock());
    time.frame(playback('paused', 0), 0.5);
    time.frame(playback('paused', 4.25, 1), 0.5);
    expect(time.frame(playback('playing', 4.75, 1), 0.5)).toBe(4.75);
  });
});
