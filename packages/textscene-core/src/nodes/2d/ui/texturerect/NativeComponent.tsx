/**
 * `<TextureRectNative>` — the native (WebGL canvas) painter for TextureRect:
 * one `<ControlQuad>` (`native/controlQuad.tsx`) sized/positioned per the
 * `stretch_mode` draw-rect math in `nativeSolver.ts`, textured through the
 * SAME `useResource`/`resolveTexture2DPath` path the DOM `<TextureRect>`
 * (`Component.tsx`) uses — that file is the feature spec for what's in scope.
 * `expand_mode`'s minimum-size contribution is a SEPARATE concern, registered
 * from `index.r3f.ts` via `controlSolverRegistry.registerMinimumSize`; this
 * component only draws.
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the `Modulate2DContext` value it provides AROUND this painter (ancestor ×
 * this node's `modulate`), so re-running `modulate` here would multiply it a
 * second time — the exact bug `ColorRectNative` (`colorrect/NativeComponent.tsx`)
 * documents and avoids. This painter therefore calls `useCanvasItemTint`
 * directly with `modulate: WHITE_MODULATE` (already folded in via context),
 * `self_modulate` from this node's own properties (own-pixels only, never
 * propagated), and `ownMultiplier` left at its `WHITE_MODULATE` default —
 * unlike ColorRect, TextureRect has no `color` property of its own to fold
 * in as a further tint before the one sRGB→linear conversion.
 *
 * The free-Control rotate/scale-about-`pivot_offset` transform is the
 * walker's job (`ControlCanvasWalker.tsx`, gated on
 * `controlSolverRegistry.containerLayout(type) === undefined`), applied
 * around every registered painter generically — this component implements no
 * transform of its own.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveTexture2DPath } from '../../../../resources/SubResourceResolver';
import { useResource } from '../../../../resources/useResource';
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

export function TextureRectNative({ solveNode, rect, renderOrder }: NativeControlComponentProps) {
  const props = solveNode.node.properties as TextureRectProperties;
  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const { externalResources, internalResources } = useSceneResources();
  const path = resolveTexture2DPath(props.texture, externalResources, internalResources);
  const texResult = useResource<THREE.Texture>(path ?? '', 'Texture2D');
  const rawTexture = texResult.value;

  const draw = useMemo(() => {
    const image = rawTexture?.image as ImageLike | undefined;
    const textureSize = { x: image?.width ?? 0, y: image?.height ?? 0 };
    if (!rawTexture || textureSize.x <= 0 || textureSize.y <= 0) return null;
    return { textureSize, ...textureRectDraw({ x: rect.w, y: rect.h }, textureSize, props.stretchMode) };
  }, [rawTexture, rect.w, rect.h, props.stretchMode]);

  // Clone: `useResource` hands out the SAME cached THREE.Texture to every
  // consumer of this path, and every mutation below (filter, wrap, UV
  // repeat/offset for a crop, tile, or flip) is per-CONSUMER sampler state —
  // the identical reason `composeFrameTexture` clones (`r3f/spriteFrame.ts`).
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !draw) return null;
    const cloned = rawTexture.clone();

    const filter = FILTER[resolveTextureRectFilter(props.textureFilter)];
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
    } else {
      cloned.wrapS = cloned.wrapT = WRAP[resolveTextureRectRepeat(props.textureRepeat)];
      if (draw.region) {
        // Texture-pixel-space crop (KEEP_ASPECT_COVERED) → normalized UV
        // repeat/offset; three.js UV-Y is bottom-left, image-Y is top-left —
        // the same flip `r3f/spriteFrame.ts`'s `applyRegionRect` documents.
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
  }, [rawTexture, draw, props.textureFilter, props.textureRepeat, props.flipH, props.flipV]);

  useEffect(() => () => preparedTexture?.dispose(), [preparedTexture]);

  if (!draw || !preparedTexture) return null;

  return (
    <group position={[draw.offset.x, -draw.offset.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={draw.size.x}
        height={draw.size.y}
        color={tint.color}
        opacity={tint.opacity}
        map={preparedTexture}
      />
    </group>
  );
}
