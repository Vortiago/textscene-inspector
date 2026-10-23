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
import { FULL_UV_WINDOW, regionUvWindow, type UvWindow } from './uvWindow';
import { frameCoords } from '../godot/scene/spriteFrames';
import { WRAP } from './canvasItemTextureSampler';

/**
 * What shows where a frame's UVs fall outside the texture, which only a
 * `region_rect` bigger than its texture reaches: Godot does not clip it
 * (`Sprite2D::_get_rects`, and `Texture2D::get_rect_region` passes it through).
 * Required, since a default is the silent hand-syncing this module prevents. `SpriteBase3D` derives
 * `texture_repeat` from the frame's UV corners (`sprite_3d.cpp:163`), as `spriteWrapMode()` does: a
 * frame inside the texture clamps, so its edge texels stretch past it, and only an overrun tiles.
 */
type SpriteWrapMode = 'clamp' | 'repeat';

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
 * Clone the loaded texture with the sprite's sampler state. `useResource` shares one
 * texture per path, so an in-place edit clobbers other sprites. `colorSpace` is required
 * like `wrap`: Sprite3D passes the colour space its albedo sampler reads the texture in.
 * The frame's UVs are not set here: `useUvWindow` sets them on the clone that draws.
 */
export function spriteSamplerClone(
  texture: THREE.Texture,
  wrap: SpriteWrapMode,
  colorSpace: THREE.ColorSpace
): THREE.Texture {
  const cloned = texture.clone();
  // A plain assignment loses to R3F's auto sRGB-tagging once the clone reaches a
  // `map` prop, so NoColorSpace is pinned. SRGBColorSpace is what that tagging forces anyway.
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

/**
 * The current frame's UV window over `texture`: the region-then-frame-grid composition, over the
 * full-image window.
 */
export function frameUvWindow(texture: THREE.Texture | undefined, props: SpriteFrameProps): UvWindow {
  const base = regionWindow(texture, props) ?? FULL_UV_WINDOW;
  return props.hframes > 1 || props.vframes > 1 ? cellWindow(base, props) : base;
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

/**
 * The region's window, or null for no region. Without the image's dimensions there is no
 * sub-rectangle, so the sprite renders the full texture (the linter warns on region misuse).
 */
function regionWindow(texture: THREE.Texture | undefined, props: SpriteFrameProps): UvWindow | null {
  const rect = props.region_enabled ? props.region_rect : undefined;
  const image = texture?.image as { width?: number; height?: number } | undefined;
  if (!rect || !image?.width || !image.height) return null;
  return regionUvWindow(
    { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    { x: image.width, y: image.height }
  );
}

/**
 * The frame's cell of the grid over `base`, the full image or the region's window. three's `v` runs
 * bottom-up and Godot's image `y` top-down, so row 0 sits at the top of `base`.
 */
function cellWindow({ repeat, offset }: UvWindow, props: SpriteFrameProps): UvWindow {
  const H = Math.max(1, props.hframes);
  const V = Math.max(1, props.vframes);
  const { x: col, y: row } = props.frame_coords ?? frameCoords({ frame: props.frame, hframes: H });
  return {
    repeat: { x: repeat.x / H, y: repeat.y / V },
    offset: { x: offset.x + col * (repeat.x / H), y: offset.y + repeat.y - (row + 1) * (repeat.y / V) },
  };
}
