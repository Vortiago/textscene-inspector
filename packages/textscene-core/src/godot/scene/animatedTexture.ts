import { defineIndexedFamily } from '../classdb/indexedFamily.js';

export const ANIMATED_TEXTURE_FRAMES = defineIndexedFamily({
  owner: 'AnimatedTexture',
  prefix: 'frame_',
  indexParse: 'itos',
  countKey: { key: 'frames' },
  indexLimit: { value: 256, at: 'animated_texture.h:43' },
  outOfBounds: { policy: 'assigned', at: 'animated_texture.cpp:268' },
});
