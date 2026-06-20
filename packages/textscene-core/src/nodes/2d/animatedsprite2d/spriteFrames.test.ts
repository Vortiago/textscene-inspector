import { describe, it, expect } from 'vitest';
import { parseSpriteFramesAnimations, frameAtTime, type SpriteFramesAnimation } from './spriteFrames';

// The exact shape Godot writes (from dodge_the_creeps' player.tscn).
const ANIMATIONS = `[{
"frames": [{
"duration": 1.0,
"texture": ExtResource("2")
}, {
"duration": 1.0,
"texture": ExtResource("3")
}],
"loop": true,
"name": &"right",
"speed": 5.0
}, {
"frames": [{
"duration": 1.0,
"texture": ExtResource("4")
}, {
"duration": 1.0,
"texture": ExtResource("5")
}],
"loop": false,
"name": &"up",
"speed": 8.0
}]`;

describe('parseSpriteFramesAnimations', () => {
  it('maps each animation name to its ordered frame texture refs', () => {
    const map = parseSpriteFramesAnimations(ANIMATIONS);
    expect([...map.keys()]).toEqual(['right', 'up']);
    expect(map.get('right')!.frames).toEqual(['ExtResource("2")', 'ExtResource("3")']);
    expect(map.get('up')!.frames).toEqual(['ExtResource("4")', 'ExtResource("5")']);
  });

  it('captures per-animation speed (fps) and loop flag', () => {
    const map = parseSpriteFramesAnimations(ANIMATIONS);
    expect(map.get('right')!.fps).toBe(5);
    expect(map.get('right')!.loop).toBe(true);
    expect(map.get('up')!.fps).toBe(8);
    expect(map.get('up')!.loop).toBe(false);
  });

  it('defaults speed to 5 and loop to true when absent (Godot defaults)', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.0, "texture": ExtResource("9")}], "name": &"default"}]'
    );
    const a = map.get('default')!;
    expect(a.fps).toBe(5);
    expect(a.loop).toBe(true);
  });

  it('captures per-frame durations parallel to frames', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 2.0, "texture": ExtResource("1")}, {"duration": 0.5, "texture": ExtResource("2")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([2, 0.5]);
  });

  it('sanitizes a non-positive or malformed duration to 1.0', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 0.0, "texture": ExtResource("1")}, {"duration": 1.2.3, "texture": ExtResource("2")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([1, 1]); // 0 → 1, NaN → 1
  });

  it('does not leak nested frame dicts into the animation split', () => {
    // Two animations, not four frame-dicts.
    expect(parseSpriteFramesAnimations(ANIMATIONS).size).toBe(2);
  });

  it('handles a single-line single-animation form', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.0, "texture": ExtResource("9")}], "name": &"default", "speed": 5.0}]'
    );
    expect(map.get('default')!.frames).toEqual(['ExtResource("9")']);
  });

  it('returns empty for a malformed / empty value', () => {
    expect(parseSpriteFramesAnimations('[]').size).toBe(0);
  });
});

describe('frameAtTime', () => {
  const make = (frames: number, fps: number, loop: boolean, durations?: number[]): SpriteFramesAnimation => ({
    name: 'a',
    frames: Array.from({ length: frames }, (_, i) => `f${i}`),
    durations: durations ?? Array.from({ length: frames }, () => 1),
    fps,
    loop,
  });

  it('starts on frame 0 at t=0', () => {
    expect(frameAtTime(make(3, 5, true), 0)).toBe(0);
  });

  it('advances one frame per 1/fps seconds', () => {
    const a = make(4, 5, true); // 0.2s per frame
    expect(frameAtTime(a, 0.1)).toBe(0);
    expect(frameAtTime(a, 0.25)).toBe(1);
    expect(frameAtTime(a, 0.45)).toBe(2);
  });

  it('loops back to the start after the last frame when loop=true', () => {
    const a = make(2, 5, true); // total 0.4s
    expect(frameAtTime(a, 0.41)).toBe(0); // wrapped
    expect(frameAtTime(a, 0.61)).toBe(1);
  });

  it('holds the final frame when loop=false', () => {
    const a = make(3, 5, false); // total 0.6s
    expect(frameAtTime(a, 5)).toBe(2);
  });

  it('honours per-frame durations', () => {
    const a = make(2, 1, true, [2, 1]); // frame0 shows 2s, frame1 shows 1s
    expect(frameAtTime(a, 1.5)).toBe(0);
    expect(frameAtTime(a, 2.5)).toBe(1);
  });

  it('stays on frame 0 for a single-frame or zero-fps animation', () => {
    expect(frameAtTime(make(1, 5, true), 3)).toBe(0);
    expect(frameAtTime(make(4, 0, true), 3)).toBe(0);
  });

  it('returns frame 0 (not the last frame) when a duration is NaN — no stall', () => {
    const bad: SpriteFramesAnimation = {
      name: 'a',
      frames: ['f0', 'f1'],
      durations: [NaN, 1],
      fps: 5,
      loop: true,
    };
    // Without the NaN-aware total guard this returns n-1 and freezes there.
    expect(frameAtTime(bad, 3)).toBe(0);
  });
});
