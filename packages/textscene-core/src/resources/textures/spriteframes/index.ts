/**
 * SpriteFrames resource slice — registration + the slice's public surface.
 *
 * A SpriteFrames arrives either inline (`[sub_resource type="SpriteFrames"]`) or
 * as an external `.tres`, and both hand the same property bag to `decode.ts` —
 * which is why the slice claims the generic `resource` bus slot (a
 * ParsedResource) rather than a texture slot: its own `animations` value is text,
 * and only its frame refs become textures.
 *
 * THREE-free and React-free: no `./build`, no r3f import. The host adapter
 * (`nodes/2d/animatedsprite2d/useSpriteFrames.ts`) consumes this.
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
