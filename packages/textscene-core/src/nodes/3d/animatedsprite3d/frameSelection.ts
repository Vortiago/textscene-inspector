/**
 * The frame an AnimatedSprite3D draws, once the scene loader has set `sprite_frames`, `animation`
 * and `frame` in file order (`sprite_3d.cpp:1208-1287,1431-1461`). Order matters: a SpriteFrames
 * that lacks the animation picks its first, and `frame` clamps to the animation it lands on.
 */

import { holdsResource } from '../../../godot/geometryBase';
import { parseOptionalInt } from '../../../parser/valueParsers';
import { unquoteLiteral } from '../../../parser/utils';
import type { SpriteFramesAnimation } from '../../../resources/textures/spriteframes/types';

type Animations = ReadonlyMap<string, SpriteFramesAnimation>;

/** `AnimatedSprite3D()` starts on the animation named `default` (`sprite_3d.h:234`). */
const DEFAULT_ANIMATION = 'default';

class AnimatedSpriteState {
  frames: Animations | null = null;
  animation = DEFAULT_ANIMATION;
  frame = 0;

  setSpriteFrames(frames: Animations | null): void {
    this.frames = frames;
    if (!frames) return;
    const first = frames.keys().next();
    if (first.done) this.setAnimation('');
    else if (!frames.has(this.animation)) this.setAnimation(first.value);
  }

  setAnimation(name: string): void {
    if (name === this.animation) return;
    this.animation = name;
    if (!this.frames) {
      this.animation = '';
      return;
    }
    // A name the frames lack counts 0 frames, so it stays set (`sprite_3d.cpp:1446-1448`).
    if (name === '' || (this.frames.get(name)?.frames.length ?? 0) === 0) return;
    // Not playing at load, so the playing speed is 0 and the frame resets to the first (`:1297-1300,1455-1459`).
    this.setFrame(0);
  }

  setFrame(frame: number): void {
    if (!this.frames) return;
    const current = this.frames.get(this.animation);
    const endFrame = current ? Math.max(0, current.frames.length - 1) : 0;
    if (frame < 0) this.frame = 0;
    else if (current && frame > endFrame) this.frame = endFrame;
    else this.frame = frame;
  }

  /** `_draw`'s frame texture (`sprite_3d.cpp:1036-1044`), or null where it draws none. */
  frameTexture(): string | null {
    return this.frames?.get(this.animation)?.frames[this.frame] ?? null;
  }
}

/**
 * The texture reference of the frame the node draws, from its raw properties and the animations of
 * the SpriteFrames `sprite_frames` names, or null where it draws none.
 */
export function selectedFrameTexture(
  raw: Readonly<Record<string, string>>,
  animations: Animations | null
): string | null {
  const state = new AnimatedSpriteState();
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'sprite_frames') state.setSpriteFrames(holdsResource(value) ? animations : null);
    else if (key === 'animation') state.setAnimation(unquoteLiteral(value));
    else if (key === 'frame') state.setFrame(parseOptionalInt(value) ?? state.frame);
  }
  return state.frameTexture();
}
