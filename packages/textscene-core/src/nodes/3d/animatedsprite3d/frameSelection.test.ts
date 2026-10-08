import { describe, expect, it } from 'vitest';
import type { SpriteFramesAnimation } from '../../../resources/textures/spriteframes/types';
import { selectedFrameTexture } from './frameSelection';

function animation(name: string, frames: (string | null)[]): [string, SpriteFramesAnimation] {
  return [name, { name, frames, durations: frames.map(() => 1), fps: 5, loop: true }];
}

const FRAMES = new Map([
  animation('default', ['ExtResource("d0")', 'ExtResource("d1")']),
  animation('walk', ['ExtResource("w0")', 'ExtResource("w1")', 'ExtResource("w2")']),
]);
const SPRITE_FRAMES = 'SubResource("frames")';

describe('selectedFrameTexture', () => {
  it('draws the authored frame of the authored animation, in Godot’s saved order', () => {
    const raw = { sprite_frames: SPRITE_FRAMES, animation: '&"walk"', frame: '2' };
    expect(selectedFrameTexture(raw, FRAMES)).toBe('ExtResource("w2")');
  });

  it('starts on the default animation', () => {
    expect(selectedFrameTexture({ sprite_frames: SPRITE_FRAMES }, FRAMES)).toBe('ExtResource("d0")');
  });

  it('takes the first animation when the frames lack the default', () => {
    const frames = new Map([animation('run', ['ExtResource("r0")'])]);
    expect(selectedFrameTexture({ sprite_frames: SPRITE_FRAMES }, frames)).toBe('ExtResource("r0")');
  });

  it('clamps a frame past the animation’s end to its last', () => {
    const raw = { sprite_frames: SPRITE_FRAMES, frame: '9' };
    expect(selectedFrameTexture(raw, FRAMES)).toBe('ExtResource("d1")');
  });

  it('ignores a frame set before the SpriteFrames', () => {
    const raw = { frame: '1', sprite_frames: SPRITE_FRAMES };
    expect(selectedFrameTexture(raw, FRAMES)).toBe('ExtResource("d0")');
  });

  it('draws nothing for an animation the frames lack', () => {
    const raw = { sprite_frames: SPRITE_FRAMES, animation: '&"jump"' };
    expect(selectedFrameTexture(raw, FRAMES)).toBeNull();
  });

  it('draws nothing for an empty frame slot', () => {
    const frames = new Map([animation('default', [null])]);
    expect(selectedFrameTexture({ sprite_frames: SPRITE_FRAMES }, frames)).toBeNull();
  });

  it('draws nothing with no SpriteFrames', () => {
    expect(selectedFrameTexture({ animation: '&"walk"' }, FRAMES)).toBeNull();
  });
});
