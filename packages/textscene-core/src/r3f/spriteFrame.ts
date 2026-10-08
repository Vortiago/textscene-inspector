/**
 * Sprite-frame composition: the region_rect and hframes/vframes UV math for
 * Sprite2D and Sprite3D. Godot's SpriteBase takes a base rect (the region when
 * `region_enabled`, else the full texture) and then subdivides it by the frame
 * grid, so region and frames compose.
 *
 * The sampler clone and the frame's UV window are separate on purpose. three keys a
 * GPU texture by source and sampler state, never by offset or repeat, so a frame
 * change moves the window on the clone already drawn and uploads nothing.
 */

import * as THREE from 'three';
import { pinNoColorSpace } from './canvas2DTextureDecode';

/**
 * What shows where a frame's UVs fall outside the texture, which only a
 * `region_rect` bigger than its texture reaches: Godot does not clip it
 * (`Sprite2D::_get_rects`, and `Texture2D::get_rect_region` passes it through).
 * Required, since a default is the silent hand-syncing this module prevents.
 */
export type SpriteWrapMode = 'clamp' | 'repeat';

const WRAP: Record<SpriteWrapMode, THREE.Wrapping> = {
  // The 2D canvas: `default_canvas_item_texture_repeat` defaults to DISABLED
  // (scene/main/viewport.h), which maps to `SAMPLER_REPEAT_MODE_CLAMP_TO_EDGE`
  // (renderer_rd/storage_rd/material_storage.cpp): the edge texel column stretches.
  clamp: THREE.ClampToEdgeWrapping,
  // Sprite3D: `SpriteBase3D` derives `texture_repeat` from the frame's UV corners
  // (`sprite_3d.cpp:163`), so only an overrun tiles. `spriteWrapMode()` derives it.
  repeat: THREE.RepeatWrapping,
};

/**
 * Flip and world size stay per slice: Sprite2D mirrors by mesh scale at 1 px per
 * unit, and Sprite3D negates UVs and multiplies by `pixel_size`.
 */
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
 * A frame that is the whole of the texture it names, as an AnimatedSprite's frame is:
 * `useTexture2D` crops a sheet cell (AtlasTexture) to its own texture, so nothing is windowed.
 */
export const WHOLE_FRAME: SpriteFrameProps = Object.freeze({
  region_enabled: false,
  hframes: 1,
  vframes: 1,
  frame: 0,
});

/**
 * Clone the loaded texture with the sprite's sampler state, or undefined before it
 * loads. `useResource` shares one texture per path, so an in-place edit clobbers
 * other sprites. `colorSpace` is required like `wrap`: Sprite2D passes NoColorSpace
 * and Sprite3D SRGBColorSpace (`r3f/canvas2DTextureDecode.ts`). The frame's UVs are
 * not set here: `useUvWindow` sets them on the clone that draws.
 */
export function spriteSamplerClone(
  texture: THREE.Texture | undefined,
  wrap: SpriteWrapMode,
  colorSpace: THREE.ColorSpace
): THREE.Texture | undefined {
  if (!texture) return undefined;

  const cloned = texture.clone();
  // A plain assignment loses to R3F's auto sRGB-tagging once the clone reaches a
  // `map` prop, so NoColorSpace is pinned, and Sprite2D pairs it with
  // `useCanvasDecodeDefines`. SRGBColorSpace is what that tagging forces anyway.
  if (colorSpace === THREE.NoColorSpace) {
    pinNoColorSpace(cloned);
  } else {
    cloned.colorSpace = colorSpace;
  }
  cloned.wrapS = WRAP[wrap];
  cloned.wrapT = WRAP[wrap];
  cloned.needsUpdate = true;
  return cloned;
}

/** A frame's UV window: the texture region a sprite quad samples. */
export interface UvWindow {
  offset: THREE.Vector2;
  repeat: THREE.Vector2;
}

/** The current frame's UV window over `texture`, from the full-image window. */
export function frameUvWindow(texture: THREE.Texture | undefined, props: SpriteFrameProps): UvWindow {
  const uv: FrameWindow = {
    offset: new THREE.Vector2(0, 0),
    repeat: new THREE.Vector2(1, 1),
    image: texture?.image,
  };
  windowFrameUv(uv, props);
  return { offset: uv.offset, repeat: uv.repeat };
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

/** The window the frame math writes, and the image whose dimensions it reads. */
interface FrameWindow extends UvWindow {
  /** `unknown`, as three types it, narrowed where the dimensions are read. */
  image: unknown;
}

/**
 * Godot's `texture_repeat` (`sprite_3d.cpp:163`): repeat only where the frame's UV
 * window leaves `[0, 1]`, on strict tests. Flips only swap the box's diagonal,
 * and our v-window is Godot's mirrored about 0.5, which the test is symmetric under.
 */
export function spriteWrapMode(texture: THREE.Texture | undefined, props: SpriteFrameProps): SpriteWrapMode {
  if (!texture) return 'clamp';
  const uv = frameUvWindow(texture, props);
  const outside = (min: number, size: number): boolean => min < 0 || min + size > 1;
  return outside(uv.offset.x, uv.repeat.x) || outside(uv.offset.y, uv.repeat.y) ? 'repeat' : 'clamp';
}

/** The region-then-frame-grid composition, over an identity window. */
function windowFrameUv(target: FrameWindow, props: SpriteFrameProps): void {
  if (props.region_enabled && props.region_rect) {
    applyRegionRect(target, props.region_rect);
  }
  if (props.hframes > 1 || props.vframes > 1) {
    applySpritesheetUV(target, props);
  }
}

function applySpritesheetUV(texture: FrameWindow, props: SpriteFrameProps): void {
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

  // Compose over the base window: identity (full image) or
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
  texture: FrameWindow,
  rect: { x: number; y: number; width: number; height: number }
): void {
  const image = texture.image as { width?: number; height?: number } | undefined;
  // Without dimensions there is no sub-rectangle, so the sprite renders the full
  // texture (the linter warns on region misuse).
  if (!image?.width || !image.height) return;
  texture.repeat.set(rect.width / image.width, rect.height / image.height);
  texture.offset.set(rect.x / image.width, 1 - (rect.y + rect.height) / image.height);
}
