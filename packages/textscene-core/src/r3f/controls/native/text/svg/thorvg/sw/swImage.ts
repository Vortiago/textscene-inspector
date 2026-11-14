/**
 * ThorVG's bitmap in the software engine (`tvgSwImage.cpp`): how the transform draws it, a shift
 * or a scale or a full map, and the outline of its quad, which gives its region and its clip.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, isEqual, isZero, type Matrix } from '../math';
import { mathTransform, mathUpdateOutlineBBox, nearbyint, type SwBBox } from './swMath';
import { emptyOutline, SW_CURVE_TYPE_POINT, type SwOutline } from './swOutline';
import { rleRender } from './swRle';
import type { SwImage } from './swSurface';

const isOnlyShifted = (m: Matrix): boolean =>
  isEqual(m.e11, 1) && isEqual(m.e22, 1) && isZero(m.e12) && isZero(m.e21);

function imageOutline(image: SwImage, transform: Matrix): SwOutline {
  const outline = emptyOutline();
  const corners = [
    { x: 0, y: 0 },
    { x: image.w, y: 0 },
    { x: image.w, y: image.h },
    { x: 0, y: image.h },
  ];
  for (const corner of corners) {
    outline.pts.push(mathTransform(corner, transform));
    outline.types.push(SW_CURVE_TYPE_POINT);
  }
  outline.pts.push({ ...outline.pts[0]! });
  outline.types.push(SW_CURVE_TYPE_POINT);
  outline.cntrs.push(outline.pts.length - 1);
  outline.closed.push(true);
  return outline;
}

/** `imagePrepare`: how the image draws, and its region in `renderRegion`, or false where none is left. */
export function imagePrepare(
  image: SwImage,
  transform: Matrix,
  clipRegion: SwBBox,
  renderRegion: SwBBox
): boolean {
  image.direct = isOnlyShifted(transform);
  if (image.direct) {
    image.ox = -nearbyint(transform.e13);
    image.oy = -nearbyint(transform.e23);
  } else {
    const scaleX = f32(
      Math.sqrt(f32(f32(transform.e11 * transform.e11) + f32(transform.e21 * transform.e21)))
    );
    const scaleY = f32(
      Math.sqrt(f32(f32(transform.e22 * transform.e22) + f32(transform.e12 * transform.e12)))
    );
    image.scale = Math.abs(f32(scaleX - scaleY)) > f32(0.01) ? 1 : scaleX;
    image.scaled = isZero(transform.e12) && isZero(transform.e21);
  }
  image.outline = imageOutline(image, transform);
  return mathUpdateOutlineBBox(image.outline.pts, true, clipRegion, renderRegion, image.direct);
}

/** `imageGenRle`: the coverage of the image's quad, which a clip cuts. */
export function imageGenRle(image: SwImage, renderRegion: SwBBox, isAntiAliased: boolean): void {
  image.rle = rleRender(image.outline!, renderRegion, isAntiAliased);
}
