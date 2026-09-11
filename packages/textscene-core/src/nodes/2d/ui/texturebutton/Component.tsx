/**
 * `<TextureButton>` — the native (WebGL canvas) painter for TextureButton:
 * one `<ControlQuad>` sized/positioned per the `stretch_mode` draw-rect math
 * in `nativeSolver.ts`'s `textureButtonDraw`, textured through `useTexture2D`
 * from whichever of the four REACHABLE texture slots
 * (`normal`/`pressed`/`hover`/`disabled`) `resolveTextureButtonSlot`
 * resolves for this draw state — mirroring `texturerect/Component.tsx`'s own
 * clone/sampler/region/flip preparation almost exactly, since both are a
 * single textured `CanvasItem` quad underneath.
 *
 * `texture_focused` is resolved by NEITHER this component NOR its solver:
 * `TextureButton::_notification`'s `draw_focus` gate is
 * `has_focus(true) && focused.is_valid()`, and a static, pointer-less/
 * keyboard-less preview never holds focus (the same restriction every other
 * Button-family painter in this codebase carries for hover/focus draw
 * states) — so that texture can never contribute a pixel, and calling
 * `useTexture2D` for it would load a GPU resource nothing ever samples.
 * `texture_click_mask` affects hit-testing only in Godot, never pixels, and
 * this previewer has no pointer input to hit-test against — not resolved
 * either.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. Used as-is, matching TextureRect (no own `color`
 * property to fold in).
 *
 * Sampler: `texture_filter`/`texture_repeat` resolve through
 * `useInheritedTextureSampler`, same as TextureRect — both are plain
 * `CanvasItem` properties, already generic on `ControlProperties`.
 *
 * The free-Control rotate/scale-about-`pivot_offset` transform is the
 * walker's job — this component implements no transform of its own.
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

  // The node's OWN scope, not the ambient provider's: a TextureButton that
  // arrived through an instanced sub-scene names ids from that scene.
  const { externalResources, internalResources } = solveNode.resources;
  // Every hook call is UNCONDITIONAL (hooks cannot branch on `slot`); which
  // result feeds the draw is decided afterwards, by plain object lookup.
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

  // Clone: the resolved texture is a SHARED cache entry, handed to every
  // consumer of it, and every mutation below (filter, wrap, UV repeat/offset
  // for a crop, tile, or flip) is per-CONSUMER sampler state.
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !draw) return null;
    const cloned = rawTexture.clone();
    // NoColorSpace, pinned: the 2D canvas's hardware filter blends undecoded
    // sRGB bytes; `ControlQuad` decodes the already-filtered sample once it
    // sees this tag. `pinNoColorSpace` because this clone reaches
    // `ControlQuad`'s `map` JSX prop, which `@react-three/fiber`'s own auto
    // sRGB-tagging would otherwise silently overwrite on commit.
    pinNoColorSpace(cloned);

    const filter = FILTER[resolveTextureRectFilter(sampler.filter)];
    cloned.magFilter = filter;
    cloned.minFilter = filter;

    let repeat = { x: 1, y: 1 };
    let offset = { x: 0, y: 0 };
    if (draw.tile) {
      // STRETCH_TILE forces repeat wrapping for THIS draw regardless of the
      // node's own texture_repeat (`draw_texture_rect(texture, rect, tile=true)`
      // is a per-call sampler override in Godot, not a texture_repeat read).
      cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
      repeat = { x: draw.size.x / draw.textureSize.x, y: draw.size.y / draw.textureSize.y };
      // Godot tiles from the rect's TOP-left; three's `v` runs bottom-up, so a
      // zero offset would anchor the pattern at the BOTTOM. `1 - repeat.y`
      // puts `v = 1` (the quad's top edge) exactly on the image's own top row.
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
