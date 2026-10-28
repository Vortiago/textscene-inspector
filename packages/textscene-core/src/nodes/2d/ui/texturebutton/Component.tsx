/**
 * `<TextureButton>`: the native (WebGL canvas) painter, one `<ControlQuad>` placed by
 * `textureButtonDraw` and textured from the slot `resolveTextureButtonSlot` picks, prepared as
 * TextureRect's, through `rectTextureSampler`. Tint is the walker's `tint` as is, like TextureRect,
 * and `useInheritedTextureSampler` resolves the sampler. The walker owns the transform.
 */

import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { useTexture2D, type Texture2DResult } from '../../../../resources/useTexture2D';
import { rectTextureSampler, sampledDraw } from '../texturerect/rectTexture';
import {
  resolveTextureButtonDrawState,
  resolveTextureButtonSlot,
  textureButtonDraw,
  type TextureButtonSlot,
} from './nativeSolver';
import type { TextureButtonProperties } from './types';
import { useOwnedTextureView } from '../../../../r3f/useTextureView';

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

  const draw = useMemo(
    () =>
      sampledDraw(rawTexture, (reported) =>
        textureButtonDraw({ x: rect.w, y: rect.h }, reported, props.stretchMode)
      ),
    [rawTexture, rect.w, rect.h, props.stretchMode]
  );

  const drawnTexture = useOwnedTextureView(
    rawTexture,
    draw && rectTextureSampler(draw, sampler, { flipH: props.flipH === true, flipV: props.flipV === true })
  );

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
