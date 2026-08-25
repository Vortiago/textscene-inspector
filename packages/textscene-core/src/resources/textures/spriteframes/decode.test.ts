/**
 * SpriteFrames decode: the `animations` dict-array literal → per-animation
 * frames + timing, with Godot's own defaults and duration clamp.
 */
import { describe, it, expect } from 'vitest';
import {
  decodeSpriteFrames,
  parseSpriteFramesAnimations,
  SPRITE_FRAME_MINIMUM_DURATION,
} from './decode';

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

describe('decodeSpriteFrames', () => {
  it('decodes a SpriteFrames section into its animations map', () => {
    const data = decodeSpriteFrames({ animations: ANIMATIONS });
    expect([...data!.animations.keys()]).toEqual(['right', 'up']);
    expect(data!.animations.get('up')!.fps).toBe(8);
  });

  it('returns null when the section declares no animations property', () => {
    expect(decodeSpriteFrames({})).toBeNull();
  });

  it('returns null for a non-string animations value (a mis-typed property bag)', () => {
    expect(decodeSpriteFrames({ animations: 42 })).toBeNull();
    expect(decodeSpriteFrames({ animations: undefined })).toBeNull();
  });

  it('returns null when the value parses to no animations at all', () => {
    // An empty array and unparseable text are the same answer: nothing to show.
    expect(decodeSpriteFrames({ animations: '[]' })).toBeNull();
    expect(decodeSpriteFrames({ animations: 'not an animations literal' })).toBeNull();
  });
});

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
    // `struct Anim { double speed = 5.0; bool loop = true; }` — sprite_frames.h:45-47.
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.0, "texture": ExtResource("9")}], "name": &"default"}]'
    );
    const a = map.get('default')!;
    expect(a.fps).toBe(5);
    expect(a.loop).toBe(true);
  });

  it('names an animation "default" when the dict carries no name', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.0, "texture": ExtResource("9")}], "speed": 5.0}]'
    );
    expect([...map.keys()]).toEqual(['default']);
  });

  it('captures per-frame durations parallel to frames', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 2.0, "texture": ExtResource("1")}, {"duration": 0.5, "texture": ExtResource("2")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([2, 0.5]);
  });

  it('clamps a zero duration to Godot\'s frame minimum, not to 1.0', () => {
    // `MAX(SPRITE_FRAME_MINIMUM_DURATION, (float)f["duration"])` — sprite_frames.cpp:225.
    // A 0-duration frame BLINKS in Godot (0.01/fps); rounding it up to a full
    // frame time instead made such a frame linger 100x too long.
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 0.0, "texture": ExtResource("1")}, {"duration": 1.0, "texture": ExtResource("2")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([SPRITE_FRAME_MINIMUM_DURATION, 1]);
  });

  it('falls back to 1.0 for a malformed duration (no Godot counterpart)', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.2.3, "texture": ExtResource("1")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([1]);
  });

  it('keeps its neighbours when one duration is written `inf`', () => {
    // `add_frame` has no is_finite guard (sprite_frames.cpp:39) and `rtos_fix`
    // spells infinity `inf`, so Godot writes this file. The scan must consume
    // the literal to stay paired with the frames; only the VALUE falls back.
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 3.0, "texture": ExtResource("1")}, {"duration": inf, "texture": ExtResource("2")}, {"duration": 2.0, "texture": ExtResource("3")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([3, 1, 2]);
  });

  it('uses uniform durations when the captured count does not match the frames', () => {
    // Godot always writes a duration per frame (sprite_frames.cpp:185) and its
    // reader drops a frame that lacks one; the preview keeps the frame instead
    // and shows every frame for the default 1.0.
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"texture": ExtResource("1")}, {"duration": 3.0, "texture": ExtResource("2")}], "name": &"x", "speed": 4.0}]'
    );
    expect(map.get('x')!.durations).toEqual([1, 1]);
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

  it('keeps a SubResource frame ref raw for the AtlasTexture slice to resolve', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.0, "texture": SubResource("AtlasTexture_0ik14")}], "name": &"x"}]'
    );
    expect(map.get('x')!.frames).toEqual(['SubResource("AtlasTexture_0ik14")']);
  });

  it('returns empty for a malformed / empty value', () => {
    expect(parseSpriteFramesAnimations('[]').size).toBe(0);
    expect(parseSpriteFramesAnimations('').size).toBe(0);
  });
});
