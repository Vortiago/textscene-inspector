/**
 * `<TextureRect>`: the native (WebGL canvas) painter, one `<ControlQuad>` placed by the `stretch_mode`
 * math in `nativeSolver.ts` and textured through `useTexture2D`, so an image file and a procedural
 * texture arrive alike. Tint is the walker's `tint` as is, since TextureRect has no `color`. The
 * walker owns the transform, and `index.r3f.ts` registers the minimum size.
 */

import { useEffect, useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { pinNoColorSpace } from '../../../../r3f/canvas2DTextureDecode';
import { useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D } from '../../../../resources/useTexture2D';
import { textureRectDraw, resolveTextureRectFilter, resolveTextureRectRepeat, applyFlip } from './nativeSolver';
import type { TextureRectProperties } from './types';

const FILTER: Record<'nearest' | 'linear', THREE.MagnificationTextureFilter> = {
  nearest: THREE.NearestFilter,
  linear: THREE.LinearFilter,
};

const WRAP: Record<'clamp' | 'repeat' | 'mirror', THREE.Wrapping> = {
  clamp: THREE.ClampToEdgeWrapping,
  repeat: THREE.RepeatWrapping,
  mirror: THREE.MirroredRepeatWrapping,
};

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

    const filter = FILTER[resolveTextureRectFilter(sampler.filter)];
    cloned.magFilter = filter;
    cloned.minFilter = filter;

    let repeat = { x: 1, y: 1 };
    let offset = { x: 0, y: 0 };
    if (draw.tile) {
      // STRETCH_TILE forces repeat wrapping for this draw whatever the node's
      // texture_repeat: `draw_texture_rect(texture, rect, tile=true)` is a per-call override.
      cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
      repeat = { x: draw.size.x / draw.textureSize.x, y: draw.size.y / draw.textureSize.y };
      // Godot tiles from the rect's top-left, and three's `v` runs bottom-up, so a zero offset
      // would show the texture's bottom rows in the partial top tile. `1 - repeat.y` puts `v = 1`
      // on the image's top row, as the region branch does. `u` is not flipped.
      offset = { x: 0, y: 1 - repeat.y };
    } else {
      cloned.wrapS = cloned.wrapT = WRAP[resolveTextureRectRepeat(sampler.repeat)];
      if (draw.region) {
        // Texture-pixel-space crop (KEEP_ASPECT_COVERED) → normalized UV
        // repeat/offset. three.js UV-Y is bottom-left and image-Y is top-left,
        // the flip `r3f/spriteFrame.ts`'s `applyRegionRect` documents.
        repeat = { x: draw.region.w / draw.textureSize.x, y: draw.region.h / draw.textureSize.y };
        offset = {
          x: draw.region.x / draw.textureSize.x,
          y: 1 - (draw.region.y + draw.region.h) / draw.textureSize.y,
        };
      }
    }

    const flipped = applyFlip(repeat, offset, props.flipH === true, props.flipV === true);
    cloned.repeat.set(flipped.repeat.x, flipped.repeat.y);
    cloned.offset.set(flipped.offset.x, flipped.offset.y);
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture, draw, sampler.filter, sampler.repeat, props.flipH, props.flipV]);

  useEffect(() => () => preparedTexture?.dispose(), [preparedTexture]);

  if (!draw || !preparedTexture) return null;

  return (
    <CanvasItemGroup position={[draw.offset.x, -draw.offset.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={draw.size.x}
        height={draw.size.y}
        color={tint.color}
        opacity={tint.opacity}
        map={preparedTexture}
      />
    </CanvasItemGroup>
  );
}
