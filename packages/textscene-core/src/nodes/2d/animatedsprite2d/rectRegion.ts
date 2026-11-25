import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import type { CanvasRectRegion } from '../../../r3f/canvasShader/canvasCommands';
import type { AnimatedSprite2DProperties } from './types';

/** The rect a frame's texture of `size` draws with, unsnapped (`animated_sprite_2d.cpp:280-300`). */
export function animatedSprite2DRectRegion(
  props: AnimatedSprite2DProperties,
  size: ImageSize
): CanvasRectRegion {
  const { width: w, height: h } = size;
  const x = props.offset.x - (props.centered ? w / 2 : 0);
  const y = props.offset.y - (props.centered ? h / 2 : 0);
  return {
    rect: { x, y, w: props.flip_h ? -w : w, h: props.flip_v ? -h : h },
    source: { x: 0, y: 0, w, h },
    clipUv: false,
  };
}
