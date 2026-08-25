/**
 * `<TextureRect>` — the native (WebGL canvas) painter for TextureRect:
 * one `<ControlQuad>` (`native/controlQuad.tsx`) sized/positioned per the
 * `stretch_mode` draw-rect math in `nativeSolver.ts`, textured through
 * `useTexture2D` — so an image file and an inline procedural texture reach it
 * the same way.
 * `expand_mode`'s minimum-size contribution is a SEPARATE concern, registered
 * from `index.r3f.ts` via `controlSolverRegistry.registerMinimumSize`; this
 * component only draws.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. Used as-is: unlike ColorRect, TextureRect has no
 * `color` property of its own to fold in before the one sRGB→linear conversion.
 *
 * Sampler: `texture_filter`/`texture_repeat` resolve through
 * `useInheritedTextureSampler` (`r3f/canvasItemTextureSampler.ts`) — PARENT_NODE
 * walks the ancestor chain to the nearest one naming a concrete value.
 *
 * The free-Control rotate/scale-about-`pivot_offset` transform is the
 * walker's job (`ControlCanvasWalker.tsx`, gated on
 * `controlSolverRegistry.containerLayout(type) === undefined`), applied
 * around every registered painter generically — this component implements no
 * transform of its own.
 */
import { useEffect, useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { pinNoColorSpace } from '../../../../r3f/canvas2DTextureDecode';
import { useInheritedTextureSampler } from '../../../../r3f/canvasItemTextureSampler';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
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
  // Own-or-ambient. The walker folds the same way before providing the context,
  // but the fold is idempotent (unlike modulate's), so repeating it costs
  // nothing and keeps this painter correct mounted on its own.
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);

  const { externalResources, internalResources } = useSceneResources();
  // `useTexture2D`, not the path-only resolver: `texture` may be an inline
  // procedural texture, which has no path and rasterises out of the scene.
  const { texture: rawTexture } = useTexture2D(props.texture, externalResources, internalResources);

  const draw = useMemo(() => {
    const image = rawTexture?.image as ImageLike | undefined;
    const textureSize = { x: image?.width ?? 0, y: image?.height ?? 0 };
    if (!rawTexture || textureSize.x <= 0 || textureSize.y <= 0) return null;
    return { textureSize, ...textureRectDraw({ x: rect.w, y: rect.h }, textureSize, props.stretchMode) };
  }, [rawTexture, rect.w, rect.h, props.stretchMode]);

  // Clone: the resolved texture is a SHARED cache entry — the loader's for an
  // image, the procedural cache's for a rasterised one — handed to every
  // consumer of it, and every mutation below (filter, wrap, UV
  // repeat/offset for a crop, tile, or flip) is per-CONSUMER sampler state —
  // the identical reason `composeFrameTexture` clones (`r3f/spriteFrame.ts`).
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !draw) return null;
    const cloned = rawTexture.clone();
    // NoColorSpace, pinned: the 2D canvas's hardware filter blends undecoded
    // sRGB bytes (`canvas2DTextureDecode.ts`); `ControlQuad` decodes the
    // already-filtered sample once it sees this tag. `pinNoColorSpace` (not a
    // plain assignment) because this clone reaches `ControlQuad`'s `map` JSX
    // prop, which `@react-three/fiber`'s own auto sRGB-tagging would
    // otherwise silently overwrite on commit — see that function's doc.
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
      // zero offset would anchor the pattern at the BOTTOM and leave the
      // partial tile at the top showing the texture's bottom rows instead of
      // its top ones. `1 - repeat.y` puts `v = 1` (the quad's top edge) exactly
      // on the image's own top row — the same UV-Y flip the region branch below
      // applies for a crop. `u` needs no equivalent: it is not flipped.
      offset = { x: 0, y: 1 - repeat.y };
    } else {
      cloned.wrapS = cloned.wrapT = WRAP[resolveTextureRectRepeat(sampler.repeat)];
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
