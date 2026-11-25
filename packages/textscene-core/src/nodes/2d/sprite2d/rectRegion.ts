import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import { frameRectPx } from '../../../r3f/spriteFrame';
import type { CanvasRectRegion } from '../../../r3f/canvasShader/canvasCommands';
import type { Sprite2DProperties } from './types';

/** The rect a Sprite2D draws its texture of `size` with, unsnapped (`sprite_2d.cpp:95-130, 169`). */
export function sprite2DRectRegion(props: Sprite2DProperties, size: ImageSize): CanvasRectRegion {
  const source = frameRectPx(size, props);
  const x = props.offset.x - (props.centered ? source.w / 2 : 0);
  const y = props.offset.y - (props.centered ? source.h / 2 : 0);
  return {
    rect: { x, y, w: props.flip_h ? -source.w : source.w, h: props.flip_v ? -source.h : source.h },
    source,
    clipUv: props.region_enabled && props.region_filter_clip_enabled,
  };
}
