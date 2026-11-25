import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import type { CanvasRectRegion } from '../../../r3f/canvasShader/canvasCommands';
import { spriteDestRect } from '../../../r3f/spriteFrame';
import type { AnimatedSprite2DProperties } from './types';

/** The rect a frame's texture of `size` draws with, unsnapped (`animated_sprite_2d.cpp:280-300`). */
export function animatedSprite2DRectRegion(
  props: AnimatedSprite2DProperties,
  size: ImageSize
): CanvasRectRegion {
  const { width: w, height: h } = size;
  return {
    rect: spriteDestRect(w, h, props),
    source: { x: 0, y: 0, w, h },
    clipUv: false,
  };
}
