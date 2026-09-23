/**
 * `<TextureButton>`: the native (WebGL canvas) painter, one `<ControlQuad>` placed by
 * `textureButtonDraw` and textured from the slot `resolveTextureButtonSlot` picks, prepared as
 * `texturerect/Component.tsx` prepares its quad. Tint is the walker's `tint` as is, like TextureRect,
 * and `useInheritedTextureSampler` resolves the sampler. The walker owns the transform.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { pinNoColorSpace } from '../../../../r3f/canvas2DTextureDecode';
import { useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D, type Texture2DResult } from '../../../../resources/useTexture2D';
import { applyFlip, resolveTextureRectFilter, resolveTextureRectRepeat } from '../texturerect/nativeSolver';
import {
  resolveTextureButtonDrawState,
  resolveTextureButtonSlot,
  textureButtonDraw,
  type TextureButtonSlot,
} from './nativeSolver';
import type { TextureButtonProperties } from './types';

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

export function TextureButton({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  const props = painterView<TextureButtonProperties>(solveNode);
  const state = resolveTextureButtonDrawState(props);
  const slot = resolveTextureButtonSlot(props, state);

  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);

  // The node's own scope, not the ambient provider's: a TextureButton that
  // arrived through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  // Every hook call is unconditional, since hooks cannot branch on `slot`. A plain
  // lookup then picks the result that draws. `texture_focused` needs focus, which a
  // static preview never holds, and `texture_click_mask` only hit-tests, so neither loads.
  const normal = useTexture2D(props.textureNormal, externalResources, internalResources);
  const pressedTex = useTexture2D(props.texturePressed, externalResources, internalResources);
  const hoverTex = useTexture2D(props.textureHover, externalResources, internalResources);
  const disabledTex = useTexture2D(props.textureDisabled, externalResources, internalResources);

  const bySlot: Record<TextureButtonSlot, Texture2DResult> = {
    textureNormal: normal,
    texturePressed: pressedTex,
    textureHover: hoverTex,
    textureDisabled: disabledTex,
  };
  const rawTexture = slot ? bySlot[slot].texture : null;

  const draw = useMemo(() => {
    const image = rawTexture?.image as ImageLike | undefined;
    const textureSize = { x: image?.width ?? 0, y: image?.height ?? 0 };
    if (!rawTexture || textureSize.x <= 0 || textureSize.y <= 0) return null;
    return { textureSize, ...textureButtonDraw({ x: rect.w, y: rect.h }, textureSize, props.stretchMode) };
  }, [rawTexture, rect.w, rect.h, props.stretchMode]);

  // Clone: the resolved texture is a shared cache entry, and every mutation below
  // (filter, wrap, UV repeat and offset for a crop, tile or flip) is per-consumer state.
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !draw) return null;
    const cloned = rawTexture.clone();
    // NoColorSpace: the 2D canvas filters undecoded sRGB bytes, and `ControlQuad` decodes
    // the filtered sample. Pinned, because this clone reaches the `map` JSX prop, whose
    // `@react-three/fiber` sRGB auto-tagging would overwrite it on commit.
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
      // Godot tiles from the rect's top-left, and three's `v` runs bottom-up, so a
      // zero offset would anchor the pattern at the bottom. `1 - repeat.y` puts
      // `v = 1` (the quad's top edge) on the image's top row.
      offset = { x: 0, y: 1 - repeat.y };
    } else {
      cloned.wrapS = cloned.wrapT = WRAP[resolveTextureRectRepeat(sampler.repeat)];
      if (draw.region) {
        // Texture-pixel-space crop (KEEP_ASPECT_COVERED) -> normalized UV
        // repeat/offset; three.js UV-Y is bottom-left, image-Y is top-left.
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
