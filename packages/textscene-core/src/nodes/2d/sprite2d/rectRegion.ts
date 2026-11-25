import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import { frameRectPx, spriteDestRect } from '../../../r3f/spriteFrame';
import type { CanvasRectRegion } from '../../../r3f/canvasShader/canvasCommands';
import type { Sprite2DProperties } from './types';

/** The rect a Sprite2D draws its texture of `size` with, unsnapped (`sprite_2d.cpp:95-130, 169`). */
export function sprite2DRectRegion(props: Sprite2DProperties, size: ImageSize): CanvasRectRegion {
  const source = frameRectPx(size, props);
  return {
    rect: spriteDestRect(source.w, source.h, props),
    source,
    clipUv: props.region_enabled && props.region_filter_clip_enabled,
  };
}
