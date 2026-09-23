/**
 * `TextureProgressBar::draw_nine_patch_stretched` (`texture_progress_bar.cpp`, `:257-425`): the rects
 * and margins of a partial nine-patch, short of `RS::canvas_item_add_nine_patch`, which
 * `r3f/controls/native/ninePatchGeometry.ts` turns into quads. Pure TS, no React or THREE.
 *
 * `Texture2D::get_rect_region` (`:424`) is not modelled: it passes every texture but `AtlasTexture`
 * through (`texture.cpp:85-89` in `scene/resources`), and `useTexture2D` crops an `AtlasTexture` first.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Vec2 } from '../../../../r3f/controls/native/rect';

export interface NinePatchMargin {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface NinePatchStretchedDraw {
  srcOffset: Vec2;
  srcSize: Vec2;
  dstOffset: Vec2;
  dstSize: Vec2;
  margin: NinePatchMargin;
}

export const FILL_LEFT_TO_RIGHT = 0;
export const FILL_RIGHT_TO_LEFT = 1;
export const FILL_TOP_TO_BOTTOM = 2;
export const FILL_BOTTOM_TO_TOP = 3;
export const FILL_CLOCKWISE = 4;
export const FILL_COUNTER_CLOCKWISE = 5;
export const FILL_BILINEAR_LEFT_AND_RIGHT = 6;
export const FILL_BILINEAR_TOP_AND_BOTTOM = 7;
export const FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE = 8;

/**
 * `progressOffset` is `null` for under and over (`:421` offsets only `progress`), else
 * `texture_progress_offset`. `ratio` is `1.0` for under and over (a full nine-patch, `:439,445`),
 * else `get_as_ratio()`. `fillMode` is read only when `ratio < 1.0`, and never a radial mode (`:452`),
 * so the `default` arms (`:346`, `:313-317,411-415`) are kept for fidelity but never run.
 */
export function drawNinePatchStretched(
  textureSize: Vec2,
  stretchMargin: NinePatchMargin,
  fillMode: number | undefined,
  ratio: number,
  controlSize: Vec2,
  progressOffset: Vec2 | null
): NinePatchStretchedDraw {
  let topleft = { x: stretchMargin.left, y: stretchMargin.top };
  let bottomright = { x: stretchMargin.right, y: stretchMargin.bottom };
  let srcOffset = { x: 0, y: 0 };
  let srcSize = { x: textureSize.x, y: textureSize.y };
  let dstOffset = { x: 0, y: 0 };
  let dstSize = { x: controlSize.x, y: controlSize.y };

  if (ratio < 1.0) {
    let widthTotal = 0;
    let widthTexture = 0;
    let firstSectionSize = 0;
    let lastSectionSize = 0;

    switch (fillMode) {
      case FILL_LEFT_TO_RIGHT:
        widthTotal = dstSize.x;
        widthTexture = textureSize.x;
        firstSectionSize = topleft.x;
        lastSectionSize = bottomright.x;
        break;
      case FILL_RIGHT_TO_LEFT:
        widthTotal = dstSize.x;
        widthTexture = textureSize.x;
        firstSectionSize = bottomright.x;
        lastSectionSize = topleft.x;
        break;
      case FILL_TOP_TO_BOTTOM:
        widthTotal = dstSize.y;
        widthTexture = textureSize.y;
        firstSectionSize = topleft.y;
        lastSectionSize = bottomright.y;
        break;
      case FILL_BOTTOM_TO_TOP:
        widthTotal = dstSize.y;
        widthTexture = textureSize.y;
        firstSectionSize = bottomright.y;
        lastSectionSize = topleft.y;
        break;
      case FILL_BILINEAR_LEFT_AND_RIGHT:
        widthTotal = dstSize.x;
        widthTexture = textureSize.x;
        firstSectionSize = topleft.x;
        lastSectionSize = bottomright.x;
        break;
      case FILL_BILINEAR_TOP_AND_BOTTOM:
        widthTotal = dstSize.y;
        widthTexture = textureSize.y;
        firstSectionSize = topleft.y;
        lastSectionSize = bottomright.y;
        break;
      default:
        break;
    }

    const widthFilled = widthTotal * ratio;
    let middleSectionSize = Math.max(0, widthTexture - firstSectionSize - lastSectionSize);
    const maxMiddleTextureSize = middleSectionSize;
    const maxMiddleRealSize = Math.max(0, widthTotal - (firstSectionSize + lastSectionSize));

    if (fillMode === FILL_BILINEAR_LEFT_AND_RIGHT || fillMode === FILL_BILINEAR_TOP_AND_BOTTOM) {
      lastSectionSize = Math.max(0, lastSectionSize - (widthTotal - widthFilled) * 0.5);
      firstSectionSize = Math.max(0, firstSectionSize - (widthTotal - widthFilled) * 0.5);
      // `:339`: `real_middle_size` is signed and unclamped, and the division by
      // `max_middle_real_size` below is as unguarded as the source.
      const realMiddleSize = widthFilled - firstSectionSize - lastSectionSize;
      middleSectionSize *= Math.min(maxMiddleRealSize, realMiddleSize) / maxMiddleRealSize;
      widthTexture = Math.min(widthTexture, firstSectionSize + middleSectionSize + lastSectionSize);
    } else {
      middleSectionSize *=
        Math.min(1, Math.max(0, widthFilled - firstSectionSize) / Math.max(1, widthTotal - firstSectionSize - lastSectionSize));
      lastSectionSize = Math.max(0, lastSectionSize - (widthTotal - widthFilled));
      firstSectionSize = Math.min(firstSectionSize, widthFilled);
      widthTexture = Math.min(widthTexture, firstSectionSize + middleSectionSize + lastSectionSize);
    }

    switch (fillMode) {
      case FILL_LEFT_TO_RIGHT:
        srcSize = { ...srcSize, x: widthTexture };
        dstSize = { ...dstSize, x: widthFilled };
        topleft = { ...topleft, x: firstSectionSize };
        bottomright = { ...bottomright, x: lastSectionSize };
        break;
      case FILL_RIGHT_TO_LEFT:
        srcOffset = { ...srcOffset, x: srcOffset.x + (srcSize.x - widthTexture) };
        srcSize = { ...srcSize, x: widthTexture };
        dstOffset = { ...dstOffset, x: dstOffset.x + (widthTotal - widthFilled) };
        dstSize = { ...dstSize, x: widthFilled };
        topleft = { ...topleft, x: lastSectionSize };
        bottomright = { ...bottomright, x: firstSectionSize };
        break;
      case FILL_TOP_TO_BOTTOM:
        srcSize = { ...srcSize, y: widthTexture };
        dstSize = { ...dstSize, y: widthFilled };
        bottomright = { ...bottomright, y: lastSectionSize };
        topleft = { ...topleft, y: firstSectionSize };
        break;
      case FILL_BOTTOM_TO_TOP:
        srcOffset = { ...srcOffset, y: srcOffset.y + (srcSize.y - widthTexture) };
        srcSize = { ...srcSize, y: widthTexture };
        dstOffset = { ...dstOffset, y: dstOffset.y + (widthTotal - widthFilled) };
        dstSize = { ...dstSize, y: widthFilled };
        topleft = { ...topleft, y: lastSectionSize };
        bottomright = { ...bottomright, y: firstSectionSize };
        break;
      case FILL_BILINEAR_LEFT_AND_RIGHT: {
        const centerMappedFromRealWidth =
          ((widthTotal * 0.5 - topleft.x) / maxMiddleRealSize) * maxMiddleTextureSize + topleft.x;
        let drift = 0;
        // `:386` compares `bottomright.y !== topleft.y` even in this X-axis
        // branch, transcribed as written.
        if (bottomright.y !== topleft.y) {
          drift =
            ((srcSize.x * 0.5 - centerMappedFromRealWidth) * (lastSectionSize - firstSectionSize)) /
            (bottomright.x - topleft.x);
        }
        srcOffset = { ...srcOffset, x: srcOffset.x + centerMappedFromRealWidth + drift - widthTexture * 0.5 };
        srcSize = { ...srcSize, x: widthTexture };
        dstOffset = { ...dstOffset, x: dstOffset.x + (widthTotal - widthFilled) * 0.5 };
        dstSize = { ...dstSize, x: widthFilled };
        topleft = { ...topleft, x: firstSectionSize };
        bottomright = { ...bottomright, x: lastSectionSize };
        break;
      }
      case FILL_BILINEAR_TOP_AND_BOTTOM: {
        const centerMappedFromRealWidth =
          ((widthTotal * 0.5 - topleft.y) / maxMiddleRealSize) * maxMiddleTextureSize + topleft.y;
        let drift = 0;
        if (bottomright.y !== topleft.y) {
          drift =
            ((srcSize.y * 0.5 - centerMappedFromRealWidth) * (lastSectionSize - firstSectionSize)) /
            (bottomright.y - topleft.y);
        }
        srcOffset = { ...srcOffset, y: srcOffset.y + centerMappedFromRealWidth + drift - widthTexture * 0.5 };
        srcSize = { ...srcSize, y: widthTexture };
        dstOffset = { ...dstOffset, y: dstOffset.y + (widthTotal - widthFilled) * 0.5 };
        dstSize = { ...dstSize, y: widthFilled };
        topleft = { ...topleft, y: firstSectionSize };
        bottomright = { ...bottomright, y: lastSectionSize };
        break;
      }
      default:
        break;
    }
  }

  if (progressOffset) {
    dstOffset = { x: dstOffset.x + progressOffset.x, y: dstOffset.y + progressOffset.y };
  }

  return {
    srcOffset,
    srcSize,
    dstOffset,
    dstSize,
    margin: { left: topleft.x, top: topleft.y, right: bottomright.x, bottom: bottomright.y },
  };
}
