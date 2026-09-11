/**
 * `<TextureProgressBar>` — the native (WebGL canvas) painter for
 * `TextureProgressBar`: `texture_under`, `texture_progress`, `texture_over`
 * in that order (`texture_progress_bar.cpp:439-482`'s `NOTIFICATION_DRAW`).
 * Each layer is one of three shapes:
 *
 *  - a plain full-texture quad (`draw_texture`/the radial `val === 1`
 *    shortcut and `nine_patch_stretch`-less `under`/`over`);
 *  - a cropped quad (`draw_texture_rect_region`, the six non-radial fill
 *    modes without `nine_patch_stretch`, `linearFill.ts`);
 *  - a hand-built textured mesh — a 3x3 nine-patch grid
 *    (`ninePatchGeometry.ts`, reused from `../ninepatchrect/` — see that
 *    module's own doc: it takes no NinePatchRect-shaped input) or a radial
 *    triangle fan (`radialFill.ts`) — both via `<TexturedFillMesh>`.
 *
 * Tint: `tint_under`/`tint_progress`/`tint_over` (raw sRGB) multiply into
 * `tint.own` BEFORE the one sRGB->linear conversion, exactly like `Button`'s
 * icon (`buttonBase.ts`'s `tintColor` + `useGodotLinearColor`).
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { pinNoColorSpace, useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import { rangeRatio } from '../shared/range';
import { controlLayoutOrder } from '../../../../r3f/controls/native/solveTree';
import { ninePatchGeometry, NINE_PATCH_STRETCH } from '../ninepatchrect/ninePatchGeometry';
import { resolveTextureRectFilter } from '../texturerect/nativeSolver';
import { drawNinePatchStretched, type NinePatchMargin } from './ninePatchProgress';
import { linearProgressDraw } from './linearFill';
import {
  radialFillGeometry,
  radialFillValue,
  radialRelativeCenter,
  clampRadialFillDegrees,
  normalizeRadialInitialAngle,
  FILL_CLOCKWISE,
  FILL_COUNTER_CLOCKWISE,
  FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE,
} from './radialFill';
import { normalizeTextureProgressBarFillMode } from './nativeSolver';
import { TexturedFillMesh } from './TexturedFillMesh';
import type { ControlColor } from '../control/types';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { TextureProgressBarProperties } from './types';

const WHITE: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
const ZERO: Vec2 = { x: 0, y: 0 };

const FILTER: Record<'nearest' | 'linear', THREE.MagnificationTextureFilter> = {
  nearest: THREE.NearestFilter,
  linear: THREE.LinearFilter,
};

interface ImageLike {
  width?: number;
  height?: number;
}

function naturalSize(texture: THREE.Texture | null): Vec2 | null {
  const image = texture?.image as ImageLike | undefined;
  const w = image?.width ?? 0;
  const h = image?.height ?? 0;
  return texture && w > 0 && h > 0 ? { x: w, y: h } : null;
}

/** One decoded, sampler-configured texture — `TextureRect`'s own load path, once per slot. */
function useLayerTexture(
  ref: string | undefined,
  externalResources: NativeControlComponentProps['solveNode']['resources']['externalResources'],
  internalResources: NativeControlComponentProps['solveNode']['resources']['internalResources'],
  filter: 'nearest' | 'linear'
): THREE.Texture | null {
  const { texture: raw } = useTexture2D(ref, externalResources, internalResources);
  const decoded = useCanvas2DTexture(raw);
  return useMemo(() => {
    if (!decoded) return null;
    const cloned = decoded.clone();
    pinNoColorSpace(cloned);
    const mag = FILTER[filter];
    cloned.magFilter = mag;
    cloned.minFilter = mag;
    return cloned;
  }, [decoded, filter]);
}

/** `Texture2D::get_rect_region`'s cropped clone (`linearFill.ts`'s own doc — identity except the UV window). */
function useCroppedTexture(
  texture: THREE.Texture | null,
  region: { x: number; y: number; w: number; h: number } | undefined,
  textureSize: Vec2 | null
): THREE.Texture | null {
  const cropped = useMemo(() => {
    if (!texture || !region || !textureSize) return null;
    const cloned = texture.clone();
    cloned.wrapS = THREE.ClampToEdgeWrapping;
    cloned.wrapT = THREE.ClampToEdgeWrapping;
    cloned.repeat.set(region.w / textureSize.x, region.h / textureSize.y);
    cloned.offset.set(region.x / textureSize.x, 1 - (region.y + region.h) / textureSize.y);
    cloned.needsUpdate = true;
    return cloned;
  }, [texture, region, textureSize]);
  useEffect(() => () => cropped?.dispose(), [cropped]);
  return cropped;
}

export function TextureProgressBar({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<TextureProgressBarProperties>(solveNode);
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);
  const filter = resolveTextureRectFilter(sampler.filter);

  const { externalResources, internalResources } = solveNode.resources;
  const underTexture = useLayerTexture(props.textureUnder, externalResources, internalResources, filter);
  const progressTexture = useLayerTexture(props.textureProgress, externalResources, internalResources, filter);
  const overTexture = useLayerTexture(props.textureOver, externalResources, internalResources, filter);

  const underSize = naturalSize(underTexture);
  const progressSize = naturalSize(progressTexture);
  const overSize = naturalSize(overTexture);

  const ninePatchStretch = props.ninePatchStretch === true;
  const stretchMarginLeft = props.stretchMarginLeft ?? 0;
  const stretchMarginTop = props.stretchMarginTop ?? 0;
  const stretchMarginRight = props.stretchMarginRight ?? 0;
  const stretchMarginBottom = props.stretchMarginBottom ?? 0;
  const stretchMargin: NinePatchMargin = useMemo(
    () => ({ left: stretchMarginLeft, top: stretchMarginTop, right: stretchMarginRight, bottom: stretchMarginBottom }),
    [stretchMarginLeft, stretchMarginTop, stretchMarginRight, stretchMarginBottom]
  );
  const controlSize: Vec2 = useMemo(() => ({ x: rect.w, y: rect.h }), [rect.w, rect.h]);

  const underColorSrgb = useMemo(() => multiplyModulate(props.tintUnder ?? WHITE, tint.own), [props.tintUnder, tint.own]);
  const progressColorSrgb = useMemo(
    () => multiplyModulate(props.tintProgress ?? WHITE, tint.own),
    [props.tintProgress, tint.own]
  );
  const overColorSrgb = useMemo(() => multiplyModulate(props.tintOver ?? WHITE, tint.own), [props.tintOver, tint.own]);
  const underColor = useGodotLinearColor(underColorSrgb);
  const progressColor = useGodotLinearColor(progressColorSrgb);
  const overColor = useGodotLinearColor(overColorSrgb);

  const fillMode = normalizeTextureProgressBarFillMode(props.fillMode);
  const isRadialMode =
    fillMode === FILL_CLOCKWISE || fillMode === FILL_COUNTER_CLOCKWISE || fillMode === FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE;
  const ratio = rangeRatio(props, controlLayoutOrder(solveNode));
  const progressOffset = props.textureProgressOffset ?? ZERO;

  // --- under -----------------------------------------------------------
  const underNinePatch = useMemo(() => {
    if (!underTexture || !underSize || !ninePatchStretch) return null;
    const draw = drawNinePatchStretched(underSize, stretchMargin, fillMode, 1.0, controlSize, null);
    return {
      draw,
      geometry: ninePatchGeometry({
        rectSize: draw.dstSize,
        textureSize: underSize,
        regionOffset: draw.srcOffset,
        regionSize: draw.srcSize,
        margin: draw.margin,
        axisH: NINE_PATCH_STRETCH,
        axisV: NINE_PATCH_STRETCH,
        drawCenter: true,
      }),
    };
  }, [underTexture, underSize, ninePatchStretch, stretchMargin, fillMode, controlSize]);

  // --- over --------------------------------------------------------------
  const overNinePatch = useMemo(() => {
    if (!overTexture || !overSize || !ninePatchStretch) return null;
    const draw = drawNinePatchStretched(overSize, stretchMargin, fillMode, 1.0, controlSize, null);
    return {
      draw,
      geometry: ninePatchGeometry({
        rectSize: draw.dstSize,
        textureSize: overSize,
        regionOffset: draw.srcOffset,
        regionSize: draw.srcSize,
        margin: draw.margin,
        axisH: NINE_PATCH_STRETCH,
        axisV: NINE_PATCH_STRETCH,
        drawCenter: true,
      }),
    };
  }, [overTexture, overSize, ninePatchStretch, stretchMargin, fillMode, controlSize]);

  // --- progress ------------------------------------------------------------
  const progressNinePatch = useMemo(() => {
    if (!progressTexture || !progressSize || !ninePatchStretch || isRadialMode) return null;
    const draw = drawNinePatchStretched(progressSize, stretchMargin, fillMode, ratio, controlSize, progressOffset);
    return {
      draw,
      geometry: ninePatchGeometry({
        rectSize: draw.dstSize,
        textureSize: progressSize,
        regionOffset: draw.srcOffset,
        regionSize: draw.srcSize,
        margin: draw.margin,
        axisH: NINE_PATCH_STRETCH,
        axisV: NINE_PATCH_STRETCH,
        drawCenter: true,
      }),
    };
  }, [progressTexture, progressSize, ninePatchStretch, isRadialMode, stretchMargin, fillMode, ratio, controlSize, progressOffset]);

  // Radial: `s = get_size()` under nine_patch_stretch (`:459-461`), else the texture's own size.
  const radialSize = ninePatchStretch ? controlSize : progressSize;
  const radialCenter = useMemo(
    () => (progressSize ? radialRelativeCenter(progressSize, props.radialCenterOffset ?? ZERO) : ZERO),
    [progressSize, props.radialCenterOffset]
  );
  const radialFillDegrees = clampRadialFillDegrees(props.radialFillDegrees);
  const radialInitialAngle = normalizeRadialInitialAngle(props.radialInitialAngle);
  const radialVal = isRadialMode && progressSize ? radialFillValue(ratio, radialFillDegrees) : null;
  const radialGeometry = useMemo(() => {
    if (radialVal === null || radialVal <= 0 || radialVal >= 1 || !radialSize) return null;
    return radialFillGeometry(fillMode, radialVal, radialInitialAngle, radialCenter, radialSize, ZERO);
  }, [radialVal, radialSize, fillMode, radialInitialAngle, radialCenter]);

  const progressLinear = useMemo(() => {
    if (!progressTexture || !progressSize || ninePatchStretch || isRadialMode) return null;
    return linearProgressDraw(fillMode, ratio, progressSize, progressOffset);
  }, [progressTexture, progressSize, ninePatchStretch, isRadialMode, fillMode, ratio, progressOffset]);
  const progressCropped = useCroppedTexture(progressTexture, progressLinear?.region, progressSize);

  return (
    <>
      {underTexture && underSize && !ninePatchStretch && (
        <ControlQuad renderOrder={renderOrder} width={underSize.x} height={underSize.y} color={underColor} opacity={underColorSrgb.a} map={underTexture} />
      )}
      {underNinePatch && (
        <CanvasItemGroup position={[underNinePatch.draw.dstOffset.x, -underNinePatch.draw.dstOffset.y, 0]}>
          <TexturedFillMesh geometry={underNinePatch.geometry} texture={underTexture!} color={underColor} opacity={underColorSrgb.a} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}

      {progressNinePatch && (
        <CanvasItemGroup position={[progressNinePatch.draw.dstOffset.x, -progressNinePatch.draw.dstOffset.y, 0]}>
          <TexturedFillMesh geometry={progressNinePatch.geometry} texture={progressTexture!} color={progressColor} opacity={progressColorSrgb.a} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
      {isRadialMode && radialVal !== null && radialVal >= 1 && progressTexture && radialSize && (
        <CanvasItemGroup position={[progressOffset.x, -progressOffset.y, 0]}>
          <ControlQuad renderOrder={renderOrder} width={radialSize.x} height={radialSize.y} color={progressColor} opacity={progressColorSrgb.a} map={progressTexture} />
        </CanvasItemGroup>
      )}
      {radialGeometry && progressTexture && (
        <CanvasItemGroup position={[progressOffset.x, -progressOffset.y, 0]}>
          <TexturedFillMesh geometry={radialGeometry} texture={progressTexture} color={progressColor} opacity={progressColorSrgb.a} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
      {progressLinear && progressCropped && (
        <CanvasItemGroup position={[progressLinear.offset.x, -progressLinear.offset.y, 0]}>
          <ControlQuad renderOrder={renderOrder} width={progressLinear.size.x} height={progressLinear.size.y} color={progressColor} opacity={progressColorSrgb.a} map={progressCropped} />
        </CanvasItemGroup>
      )}

      {overTexture && overSize && !ninePatchStretch && (
        <ControlQuad renderOrder={renderOrder} width={overSize.x} height={overSize.y} color={overColor} opacity={overColorSrgb.a} map={overTexture} />
      )}
      {overNinePatch && (
        <CanvasItemGroup position={[overNinePatch.draw.dstOffset.x, -overNinePatch.draw.dstOffset.y, 0]}>
          <TexturedFillMesh geometry={overNinePatch.geometry} texture={overTexture!} color={overColor} opacity={overColorSrgb.a} renderOrder={renderOrder} />
        </CanvasItemGroup>
      )}
    </>
  );
}
