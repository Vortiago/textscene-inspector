/**
 * Sprite-frame composition — the shared region_rect + hframes/vframes UV math
 * for SpriteBase nodes (Sprite2D and Sprite3D consume it; AnimatedSprite2D /
 * TileMap are future consumers).
 *
 * Godot's SpriteBase computes a base_rect (the region when `region_enabled`,
 * else the full texture) and THEN subdivides it by hframes/vframes — region and
 * frames COMPOSE, they are not mutually exclusive. This module is the single
 * home of that math; it was previously hand-synced between the two sprite
 * slices and diverged once (the B12 parity bug).
 *
 * What stays per-slice (the parts that legitimately differ):
 *   - flip_h/flip_v: Sprite2D mirrors via mesh scale, Sprite3D via UV negation.
 *   - World sizing: Sprite2D uses pixels directly (1 px = 1 unit); Sprite3D
 *     multiplies the frame pixel size by `pixel_size`.
 *   - The sampler wrap mode — see `SpriteWrapMode`.
 */

import * as THREE from 'three';
import { pinNoColorSpace } from './canvas2DTextureDecode';

/**
 * What shows where a frame's UVs fall outside the texture.
 *
 * This only ever matters for a `region_rect` bigger than its texture. Godot
 * does NOT clip such a region: `Sprite2D::_get_rects` takes `base_rect =
 * region_rect` verbatim, and `Texture2D::get_rect_region` is a pass-through
 * (`r_src_rect = p_src_rect`), so the quad keeps the full region size and the
 * UVs simply run past 1.0. Only the sampler decides what is drawn there — and
 * the two sprite families sample through different ones:
 *
 *   'clamp'  — the 2D canvas. `Viewport::default_canvas_item_texture_repeat`
 *              defaults to `DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_DISABLED`
 *              (scene/main/viewport.h), which the renderer maps to
 *              `sampler_state.repeat_u = RD::SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE`
 *              (renderer_rd/storage_rd/material_storage.cpp). The overrun shows
 *              the edge texel column stretched — transparent when that column
 *              is transparent, which is why an oversized background region
 *              reads as "the texture, then nothing".
 *   'repeat' — Sprite3D, and only where it must. `SpriteBase3D` DERIVES the
 *              `texture_repeat` it passes to `get_material_for_2d` from the
 *              frame's own UV corners (`sprite_3d.cpp:163`), so a window inside
 *              `[0, 1]` clamps and only an overrun tiles. `spriteWrapMode()` is
 *              that derivation.
 *
 * Required rather than defaulted on purpose: a default is exactly the silent
 * hand-syncing this module exists to prevent.
 */
export type SpriteWrapMode = 'clamp' | 'repeat';

const WRAP: Record<SpriteWrapMode, THREE.Wrapping> = {
  clamp: THREE.ClampToEdgeWrapping,
  repeat: THREE.RepeatWrapping,
};

export interface SpriteFrameProps {
  region_enabled: boolean;
  region_rect?: { x: number; y: number; width: number; height: number };
  hframes: number;
  vframes: number;
  frame: number;
  /** Explicit (col, row) frame coordinates; overrides the linear `frame` index. */
  frame_coords?: { x: number; y: number };
}

/**
 * Clone the loaded texture and window its UVs to the current frame
 * (region_rect and/or sprite-sheet grid). The clone is essential: `useResource`
 * returns the same THREE.Texture reference to every consumer of a given path,
 * so mutating in place would clobber other sprites' repeat/offset state.
 *
 * `colorSpace` is required rather than inherited from the source texture for
 * the same reason `wrap` is (see `SpriteWrapMode`'s own comment): Sprite2D's
 * 2D canvas and Sprite3D's 3D billboard sample through Godot's two different
 * filtering rules (`r3f/canvas2DTextureDecode.ts`) — Sprite2D passes
 * `THREE.NoColorSpace` (paired with `useCanvasDecodeDefines` at its own
 * material), Sprite3D passes `THREE.SRGBColorSpace` to keep its current,
 * already-correct hardware decode. A default here is exactly the silent
 * hand-syncing this module exists to prevent.
 *
 * Returns undefined when no texture is loaded yet.
 */
export function composeFrameTexture(
  texture: THREE.Texture | undefined,
  props: SpriteFrameProps,
  wrap: SpriteWrapMode,
  colorSpace: THREE.ColorSpace
): THREE.Texture | undefined {
  if (!texture) return undefined;

  const cloned = texture.clone();
  // `pinNoColorSpace` when the caller wants NoColorSpace: a plain assignment
  // loses to `@react-three/fiber`'s own auto sRGB-tagging the moment this
  // clone reaches a `map` JSX prop (see that function's doc comment).
  // SRGBColorSpace needs no pin — it's what that auto-tagging already forces.
  if (colorSpace === THREE.NoColorSpace) {
    pinNoColorSpace(cloned);
  } else {
    cloned.colorSpace = colorSpace;
  }
  cloned.wrapS = WRAP[wrap];
  cloned.wrapT = WRAP[wrap];

  windowFrameUv(cloned, props);

  cloned.needsUpdate = true;
  return cloned;
}

/**
 * Frame size in texture pixels: the base rect (region when enabled, else the
 * full image), subdivided by the frame grid. Falls back to 1×1 without a
 * loaded image so placeholders keep a sensible scale.
 */
export function frameSizePx(
  texture: THREE.Texture | undefined,
  props: SpriteFrameProps
): { width: number; height: number } {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  const H = Math.max(1, props.hframes);
  const V = Math.max(1, props.vframes);

  let pxW = image?.width ?? 1;
  let pxH = image?.height ?? 1;
  if (props.region_enabled && props.region_rect && image?.width && image.height) {
    pxW = props.region_rect.width;
    pxH = props.region_rect.height;
  }
  return { width: pxW / H, height: pxH / V };
}

/**
 * The offset/repeat pair the frame math writes, and the image it needs to do
 * it. `THREE.Texture` satisfies it structurally, so `spriteWrapMode()` can run
 * the SAME two helpers over a throwaway window rather than a second
 * implementation that could drift from the one that draws.
 */
interface UvWindow {
  offset: THREE.Vector2;
  repeat: THREE.Vector2;
  /** `unknown`, as three types it — narrowed where the dimensions are read. */
  image: unknown;
}

/**
 * Godot's `texture_repeat` (`sprite_3d.cpp:163`): REPEAT only where the frame's
 * UV window leaves `[0, 1]`, on strict `< 0` / `> 1` tests. flip_h/flip_v swap
 * the uv pairs and hand the test the other diagonal of the same bounding box,
 * so they cannot change the answer; and our v-window is Godot's mirrored about
 * 0.5, which the `min < 0 || max > 1` pair is symmetric under.
 */
export function spriteWrapMode(
  texture: THREE.Texture | undefined,
  props: SpriteFrameProps
): SpriteWrapMode {
  if (!texture) return 'clamp';
  const window: UvWindow = {
    offset: new THREE.Vector2(0, 0),
    repeat: new THREE.Vector2(1, 1),
    image: texture.image,
  };
  windowFrameUv(window, props);
  const outside = (min: number, size: number): boolean => min < 0 || min + size > 1;
  return outside(window.offset.x, window.repeat.x) || outside(window.offset.y, window.repeat.y)
    ? 'repeat'
    : 'clamp';
}

/** The region-then-frame-grid composition, on anything carrying a UV window. */
function windowFrameUv(target: UvWindow, props: SpriteFrameProps): void {
  if (props.region_enabled && props.region_rect) {
    applyRegionRect(target, props.region_rect);
  }
  if (props.hframes > 1 || props.vframes > 1) {
    applySpritesheetUV(target, props);
  }
}

function applySpritesheetUV(texture: UvWindow, props: SpriteFrameProps): void {
  const H = Math.max(1, props.hframes);
  const V = Math.max(1, props.vframes);

  let col: number;
  let row: number;
  if (props.frame_coords) {
    col = props.frame_coords.x;
    row = props.frame_coords.y;
  } else {
    col = props.frame % H;
    row = Math.floor(props.frame / H);
  }

  // Compose over the base UV already on the texture: identity (full image) or
  // the region rect applied above. Multiplying keeps region + frames additive.
  const baseRepeatX = texture.repeat.x;
  const baseRepeatY = texture.repeat.y;
  const baseOffsetX = texture.offset.x;
  const baseOffsetY = texture.offset.y;
  texture.repeat.set(baseRepeatX / H, baseRepeatY / V);
  // UV-Y origin is bottom-left in three.js; image-Y origin is top-left.
  // Flip Y so row 0 sits at the top of the (region's) window.
  texture.offset.set(
    baseOffsetX + col * (baseRepeatX / H),
    baseOffsetY + baseRepeatY - (row + 1) * (baseRepeatY / V)
  );
}

function applyRegionRect(
  texture: UvWindow,
  rect: { x: number; y: number; width: number; height: number }
): void {
  const image = texture.image as { width?: number; height?: number } | undefined;
  // Without dimensions we can't compute a sensible sub-rectangle; the sprite
  // renders with the full texture (the linter warns on region misuse).
  if (!image?.width || !image.height) return;
  texture.repeat.set(rect.width / image.width, rect.height / image.height);
  texture.offset.set(rect.x / image.width, 1 - (rect.y + rect.height) / image.height);
}
