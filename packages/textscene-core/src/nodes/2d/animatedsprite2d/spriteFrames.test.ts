import { describe, it, expect } from 'vitest';
import { parseSpriteFramesAnimations } from './spriteFrames';

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
"loop": true,
"name": &"up",
"speed": 5.0
}]`;

describe('parseSpriteFramesAnimations', () => {
  it('maps each animation name to its ordered frame texture refs', () => {
    const map = parseSpriteFramesAnimations(ANIMATIONS);
    expect([...map.keys()]).toEqual(['right', 'up']);
    expect(map.get('right')).toEqual(['ExtResource("2")', 'ExtResource("3")']);
    expect(map.get('up')).toEqual(['ExtResource("4")', 'ExtResource("5")']);
  });

  it('does not leak nested frame dicts into the animation split', () => {
    // Two animations, not four frame-dicts.
    expect(parseSpriteFramesAnimations(ANIMATIONS).size).toBe(2);
  });

  it('handles a single-line single-animation form', () => {
    const map = parseSpriteFramesAnimations(
      '[{"frames": [{"duration": 1.0, "texture": ExtResource("9")}], "name": &"default", "speed": 5.0}]'
    );
    expect(map.get('default')).toEqual(['ExtResource("9")']);
  });

  it('returns empty for a malformed / empty value', () => {
    expect(parseSpriteFramesAnimations('[]').size).toBe(0);
  });
});
