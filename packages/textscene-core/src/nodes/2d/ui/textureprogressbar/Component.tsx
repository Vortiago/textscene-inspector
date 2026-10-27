/**
 * `<TextureProgressBar>`: the native (WebGL canvas) painter, drawing under, progress and over in
 * that order (`texture_progress_bar.cpp:439-482`). A layer is a full-texture quad, a cropped quad
 * (`linearFill.ts`), or a `<TexturedFillMesh>` of a nine-patch grid or a radial fan. The walker owns
 * visibility, children and transform.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlLayoutOrder, painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { multiplyModulate, WHITE_MODULATE } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { useCanvas2DTexture } from '../../../../r3f/canvas2DTextureDecode';
import {
  useInheritedTextureSampler,
  type CanvasItemTextureSampler,
} from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { useOwnedTextureView } from '../../../../r3f/useTextureView';
import { regionUvWindow } from '../../../../r3f/uvWindow';
import { rangeRatio } from '../shared/range';
import { ninePatchGeometry } from '../../../../r3f/controls/native/ninePatchGeometry';
import { drawNinePatchStretched, type NinePatchMargin } from './ninePatchProgress';
import { linearProgressDraw } from './linearFill';
import {
  radialFillGeometry,
  radialFillValue,
  radialRelativeCenter,
  clampRadialFillDegrees,
  normalizeRadialInitialAngle,
} from './radialFill';
import { normalizeTextureProgressBarFillMode } from './nativeSolver';
import { TexturedFillMesh } from './TexturedFillMesh';
import type { TextureProgressBarProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { AxisStretchMode, TextureProgressBarFillMode } from '../../../../godot/scene/gui';

const ZERO: Vector2 = { x: 0, y: 0 };

interface ImageLike {
  width?: number;
  height?: number;
}

function naturalSize(texture: THREE.Texture | null): Vector2 | null {
  const image = texture?.image as ImageLike | undefined;
  const w = image?.width ?? 0;
  const h = image?.height ?? 0;
  return texture && w > 0 && h > 0 ? { x: w, y: h } : null;
}

/** One decoded, sampler-configured texture: `TextureRect`'s load path, once per slot. */
function useLayerTexture(
  ref: string | undefined,
  externalResources: NativeControlComponentProps['solveNode']['resources']['externalResources'],
  internalResources: NativeControlComponentProps['solveNode']['resources']['internalResources'],
  sampler: CanvasItemTextureSampler
): THREE.Texture | null {
  const { texture: raw } = useTexture2D(ref, externalResources, internalResources);
  return useCanvas2DTexture(raw, sampler);
}

/** `Texture2D::get_rect_region`'s cropped clone: identity except the UV window (`linearFill.ts`). */
function useCroppedTexture(
  texture: THREE.Texture | null,
  region: { x: number; y: number; w: number; h: number } | undefined,
  textureSize: Vector2 | null
): THREE.Texture | null {
  return useOwnedTextureView(
    texture,
    region &&
      textureSize && {
        colorSpace: THREE.NoColorSpace,
        wrap: THREE.ClampToEdgeWrapping,
        window: regionUvWindow(region, textureSize),
      }
  );
}

export function TextureProgressBar({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<TextureProgressBarProperties>(solveNode);
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);

  const { externalResources, internalResources } = solveNode.resources;
  const underTexture = useLayerTexture(props.textureUnder, externalResources, internalResources, sampler);
  const progressTexture = useLayerTexture(
    props.textureProgress,
    externalResources,
    internalResources,
    sampler
  );
  const overTexture = useLayerTexture(props.textureOver, externalResources, internalResources, sampler);

  // Memoised, so the geometry and crop memos that read a size rebuild only when its texture changes.
  const underSize = useMemo(() => naturalSize(underTexture), [underTexture]);
  const progressSize = useMemo(() => naturalSize(progressTexture), [progressTexture]);
  const overSize = useMemo(() => naturalSize(overTexture), [overTexture]);

  const ninePatchStretch = props.ninePatchStretch === true;
  const stretchMarginLeft = props.stretchMarginLeft ?? 0;
  const stretchMarginTop = props.stretchMarginTop ?? 0;
  const stretchMarginRight = props.stretchMarginRight ?? 0;
  const stretchMarginBottom = props.stretchMarginBottom ?? 0;
  const stretchMargin: NinePatchMargin = useMemo(
    () => ({
      left: stretchMarginLeft,
      top: stretchMarginTop,
      right: stretchMarginRight,
      bottom: stretchMarginBottom,
    }),
    [stretchMarginLeft, stretchMarginTop, stretchMarginRight, stretchMarginBottom]
  );
  const controlSize: Vector2 = useMemo(() => ({ x: rect.w, y: rect.h }), [rect.w, rect.h]);

  // `tint_under`/`tint_progress`/`tint_over` (raw sRGB) multiply into `tint.own` before the one
  // sRGB-to-linear conversion, as Button's icon does (`buttonBase.ts`).
  const underColorSrgb = useMemo(
    () => multiplyModulate(props.tintUnder ?? WHITE_MODULATE, tint.own),
    [props.tintUnder, tint.own]
  );
  const progressColorSrgb = useMemo(
    () => multiplyModulate(props.tintProgress ?? WHITE_MODULATE, tint.own),
    [props.tintProgress, tint.own]
  );
  const overColorSrgb = useMemo(
    () => multiplyModulate(props.tintOver ?? WHITE_MODULATE, tint.own),
    [props.tintOver, tint.own]
  );
  const underColor = useGodotLinearColor(underColorSrgb);
  const progressColor = useGodotLinearColor(progressColorSrgb);
  const overColor = useGodotLinearColor(overColorSrgb);

  const fillMode = normalizeTextureProgressBarFillMode(props.fillMode);
  const isRadialMode =
    fillMode === TextureProgressBarFillMode.CLOCKWISE ||
    fillMode === TextureProgressBarFillMode.COUNTER_CLOCKWISE ||
    fillMode === TextureProgressBarFillMode.CLOCKWISE_AND_COUNTER_CLOCKWISE;
  const ratio = rangeRatio(props, controlLayoutOrder(solveNode));
  const progressOffsetX = props.textureProgressOffset?.x ?? 0;
  const progressOffsetY = props.textureProgressOffset?.y ?? 0;
  // Memoised on the numbers: a reparse makes a new offset object, which would crop and upload again.
  const progressOffset: Vector2 = useMemo(
    () => ({ x: progressOffsetX, y: progressOffsetY }),
    [progressOffsetX, progressOffsetY]
  );

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
        axisH: AxisStretchMode.STRETCH,
        axisV: AxisStretchMode.STRETCH,
        drawCenter: true,
      }),
    };
  }, [underTexture, underSize, ninePatchStretch, stretchMargin, fillMode, controlSize]);

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
        axisH: AxisStretchMode.STRETCH,
        axisV: AxisStretchMode.STRETCH,
        drawCenter: true,
      }),
    };
  }, [overTexture, overSize, ninePatchStretch, stretchMargin, fillMode, controlSize]);

  const progressNinePatch = useMemo(() => {
    if (!progressTexture || !progressSize || !ninePatchStretch || isRadialMode) return null;
    const draw = drawNinePatchStretched(
      progressSize,
      stretchMargin,
      fillMode,
      ratio,
      controlSize,
      progressOffset
    );
    return {
      draw,
      geometry: ninePatchGeometry({
        rectSize: draw.dstSize,
        textureSize: progressSize,
        regionOffset: draw.srcOffset,
        regionSize: draw.srcSize,
        margin: draw.margin,
        axisH: AxisStretchMode.STRETCH,
        axisV: AxisStretchMode.STRETCH,
        drawCenter: true,
      }),
    };
  }, [
    progressTexture,
    progressSize,
    ninePatchStretch,
    isRadialMode,
    stretchMargin,
    fillMode,
    ratio,
    controlSize,
    progressOffset,
  ]);

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
        <ControlQuad
          renderOrder={renderOrder}
          width={underSize.x}
          height={underSize.y}
          color={underColor}
          opacity={underColorSrgb.a}
          map={underTexture}
        />
      )}
      {underNinePatch && (
        <CanvasItemGroup position={[underNinePatch.draw.dstOffset.x, -underNinePatch.draw.dstOffset.y, 0]}>
          <TexturedFillMesh
            geometry={underNinePatch.geometry}
            texture={underTexture!}
            color={underColor}
            opacity={underColorSrgb.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}

      {progressNinePatch && (
        <CanvasItemGroup
          position={[progressNinePatch.draw.dstOffset.x, -progressNinePatch.draw.dstOffset.y, 0]}
        >
          <TexturedFillMesh
            geometry={progressNinePatch.geometry}
            texture={progressTexture!}
            color={progressColor}
            opacity={progressColorSrgb.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {isRadialMode && radialVal !== null && radialVal >= 1 && progressTexture && radialSize && (
        <CanvasItemGroup position={[progressOffset.x, -progressOffset.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={radialSize.x}
            height={radialSize.y}
            color={progressColor}
            opacity={progressColorSrgb.a}
            map={progressTexture}
          />
        </CanvasItemGroup>
      )}
      {radialGeometry && progressTexture && (
        <CanvasItemGroup position={[progressOffset.x, -progressOffset.y, 0]}>
          <TexturedFillMesh
            geometry={radialGeometry}
            texture={progressTexture}
            color={progressColor}
            opacity={progressColorSrgb.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {progressLinear && progressCropped && (
        <CanvasItemGroup position={[progressLinear.offset.x, -progressLinear.offset.y, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
            width={progressLinear.size.x}
            height={progressLinear.size.y}
            color={progressColor}
            opacity={progressColorSrgb.a}
            map={progressCropped}
          />
        </CanvasItemGroup>
      )}

      {overTexture && overSize && !ninePatchStretch && (
        <ControlQuad
          renderOrder={renderOrder}
          width={overSize.x}
          height={overSize.y}
          color={overColor}
          opacity={overColorSrgb.a}
          map={overTexture}
        />
      )}
      {overNinePatch && (
        <CanvasItemGroup position={[overNinePatch.draw.dstOffset.x, -overNinePatch.draw.dstOffset.y, 0]}>
          <TexturedFillMesh
            geometry={overNinePatch.geometry}
            texture={overTexture!}
            color={overColor}
            opacity={overColorSrgb.a}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
