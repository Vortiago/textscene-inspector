/**
 * `<TextureRect>`: the native (WebGL canvas) painter, one `<ControlQuad>` placed by the `stretch_mode`
 * math in `nativeSolver.ts` and textured through `useTexture2D`, so an image file and a procedural
 * texture arrive alike. Tint is the walker's `tint` as is, since TextureRect has no `color`. The
 * walker owns the transform, and `index.r3f.ts` registers the minimum size.
 */

import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { pinNoColorSpace } from '../../../../r3f/canvas2DTextureDecode';
import { applyCanvasItemSampler, useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { textureRectDraw, textureRectUvWindow } from './nativeSolver';
import type { TextureRectProperties } from './types';
import { useUploadedClone } from '../../../../r3f/tiledUpload/useTiledUpload';

interface ImageLike {
  width?: number;
  height?: number;
}

export function TextureRect({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<TextureRectProperties>(solveNode);
  // Walks PARENT_NODE up to the nearest ancestor naming a value. The walker folds the same
  // way, but the fold is idempotent, so repeating it keeps this painter correct on its own.
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);

  // The node's own scope, not the ambient provider's: a TextureRect that
  // arrived through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  // `useTexture2D`, not the path-only resolver: `texture` may be an inline
  // procedural texture, which has no path and rasterises out of the scene.
  const { texture: rawTexture } = useTexture2D(props.texture, externalResources, internalResources);

  const draw = useMemo(() => {
    const image = rawTexture?.image as ImageLike | undefined;
    const textureSize = { x: image?.width ?? 0, y: image?.height ?? 0 };
    if (!rawTexture || textureSize.x <= 0 || textureSize.y <= 0) return null;
    return { textureSize, ...textureRectDraw({ x: rect.w, y: rect.h }, textureSize, props.stretchMode) };
  }, [rawTexture, rect.w, rect.h, props.stretchMode]);

  // Clone: the resolved texture is a shared cache entry (the loader's or the procedural cache's),
  // and every mutation below (filter, wrap, UV repeat and offset for a crop, tile or flip) is
  // per-consumer state, as in `composeFrameTexture` (`r3f/spriteFrame.ts`).
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !draw) return null;
    const cloned = rawTexture.clone();
    // NoColorSpace: the 2D canvas filters undecoded sRGB bytes (`canvas2DTextureDecode.ts`), and
    // `ControlQuad` decodes the filtered sample. Pinned, because this clone reaches the `map` JSX
    // prop, whose `@react-three/fiber` sRGB auto-tagging would overwrite a plain assignment.
    pinNoColorSpace(cloned);

    applyCanvasItemSampler(cloned, sampler);

    // STRETCH_TILE forces repeat wrapping for this draw whatever the node's
    // texture_repeat: `draw_texture_rect(texture, rect, tile=true)` is a per-call override.
    if (draw.tile) cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
    const { repeat, offset } = textureRectUvWindow(draw, props.flipH === true, props.flipV === true);
    cloned.repeat.set(repeat.x, repeat.y);
    cloned.offset.set(offset.x, offset.y);
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture, draw, sampler, props.flipH, props.flipV]);

  const drawnTexture = useUploadedClone(preparedTexture);

  if (!draw || !drawnTexture) return null;

  return (
    <CanvasItemGroup position={[draw.offset.x, -draw.offset.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={draw.size.x}
        height={draw.size.y}
        color={tint.color}
        opacity={tint.opacity}
        map={drawnTexture}
      />
    </CanvasItemGroup>
  );
}
