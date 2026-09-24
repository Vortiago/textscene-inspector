/**
 * SpriteFrames resource slice: registration and public surface. It claims the
 * `resource` slot: its `animations` value is text, and only frame refs become
 * textures. THREE-free and React-free, consumed by `nodes/2d/animatedsprite2d/useSpriteFrames.ts`.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'spriteframes',
  kind: 'godot-text',
  typeNames: ['SpriteFrames'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export * from './decode';
export * from './playback';
export * from './types';
