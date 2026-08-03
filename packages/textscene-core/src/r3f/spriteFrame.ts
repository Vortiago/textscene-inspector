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
 *   'repeat' — Sprite3D. `SpriteBase3D` draws through
 *              `StandardMaterial3D::get_material_for_2d`, which never clears
 *              `FLAG_USE_TEXTURE_REPEAT`; its default is `true`
 *              (scene/resources/material.cpp), emitting `repeat_enable`. The
 *              overrun tiles.
 *
 * Required rather than defaulted on purpose: a default is exactly the silent
 * hand-syncing this module exists to prevent.
 */
export type SpriteWrapMode = 'clamp' | 'repeat';

const WRAP: Record<SpriteWrapMode, THREE.Wrapping> = {
  clamp: THREE.ClampToEdgeWrapping,
  repeat: THREE.RepeatWrapping,
};

export interface SpriteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
 * Whether {@link composeFrameTexture} would window anything for these props —
 * false when the frame is the whole image (no region, no atlas cell, no
 * sprite-sheet grid).
 *
 * Callers use this to skip composition and draw the source texture directly:
 * cloning is not free even though it shares the pixel `Source`, because
 * `Texture.copy` marks `needsUpdate`, which bumps the shared Source's version
 * and forces the GPU to re-upload the pixel buffer — per mount, and per
 * keyframe when an animation drives the frame. For a cached procedural texture
 * that re-upload is exactly what `proceduralTextureCache` exists to prevent.
 * A borrowed texture keeps its own wrap mode where composition would set the
 * sampler's; with the whole image mapped, UVs stay inside [0, 1] and wrap
 * never applies, so nothing observable differs. Callers that mutate the
 * result (Sprite3D's UV flips) must still clone.
 */
export function needsFrameComposition(props: SpriteFrameProps, atlasRegion?: SpriteRect): boolean {
  return (
    atlasRegion !== undefined ||
    Boolean(props.region_enabled && props.region_rect) ||
    props.hframes > 1 ||
    props.vframes > 1
  );
}

/**
 * Clone the loaded texture and window its UVs to the current frame
 * (region_rect and/or sprite-sheet grid). The clone is essential: `useResource`
 * returns the same THREE.Texture reference to every consumer of a given path,
 * so mutating in place would clobber other sprites' repeat/offset state.
 *
 * Returns undefined when no texture is loaded yet.
 */
export function composeFrameTexture(
  texture: THREE.Texture | undefined,
  props: SpriteFrameProps,
  wrap: SpriteWrapMode,
  atlasRegion?: SpriteRect
): THREE.Texture | undefined {
  if (!texture) return undefined;

  const baseRect = baseRectFor(props, atlasRegion);
  // An empty intersection is Godot's "draw nothing": `get_rect_region` returns
  // false and the draw is skipped. Decided before the clone so the discarded
  // frame costs no GPU texture.
  if (baseRect === null) return undefined;

  const cloned = texture.clone();
  cloned.wrapS = WRAP[wrap];
  cloned.wrapT = WRAP[wrap];

  if (baseRect) {
    applyRegionRect(cloned, baseRect);
  }
  if (props.hframes > 1 || props.vframes > 1) {
    applySpritesheetUV(cloned, props);
  }

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
  props: SpriteFrameProps,
  atlasRegion?: SpriteRect
): { width: number; height: number } {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  const H = Math.max(1, props.hframes);
  const V = Math.max(1, props.vframes);

  let pxW = atlasRegion?.width ?? image?.width ?? 1;
  let pxH = atlasRegion?.height ?? image?.height ?? 1;
  if (props.region_enabled && props.region_rect && image?.width && image.height) {
    // The CLIPPED rect, so the quad matches the pixels that survive the atlas
    // clip — otherwise the cell's content stretches over a quad Godot never
    // draws that big. Null (no overlap) draws nothing, so any size will do.
    const clipped = baseRectFor(props, atlasRegion) ?? props.region_rect;
    pxW = clipped.width;
    pxH = clipped.height;
  }
  return { width: pxW / H, height: pxH / V };
}

/**
 * The rect UVs window to, in SHEET pixels: the sprite's own region (translated
 * into the atlas cell and clipped to it when there is one), else the cell, else
 * undefined for a full-image sprite. Null means the sprite's region misses the
 * cell entirely — Godot draws nothing.
 *
 * The clip is the one place an AtlasTexture differs from a plain Texture2D:
 * `get_rect_region` intersects the source rect with the cell
 * (`src_clipped = _get_region_rect().intersection(src)`,
 * `scene/resources/atlas_texture.cpp:204`) and bails when that is empty, while a
 * plain texture's oversized region is passed through untouched and simply runs
 * its UVs past 1.0 (see `SpriteWrapMode`). Without it a sprite would sample its
 * neighbours' cells.
 */
function baseRectFor(
  props: SpriteFrameProps,
  atlasRegion: SpriteRect | undefined
): SpriteRect | undefined | null {
  if (!props.region_enabled || !props.region_rect) return atlasRegion;
  if (!atlasRegion) return props.region_rect;
  const translated = {
    x: atlasRegion.x + props.region_rect.x,
    y: atlasRegion.y + props.region_rect.y,
    width: props.region_rect.width,
    height: props.region_rect.height,
  };
  return intersectRects(atlasRegion, translated);
}

/** Rect intersection; null when empty (Godot's `Rect2::intersection` + its zero-size test). */
function intersectRects(a: SpriteRect, b: SpriteRect): SpriteRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (!(right > x) || !(bottom > y)) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function applySpritesheetUV(texture: THREE.Texture, props: SpriteFrameProps): void {
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
  texture: THREE.Texture,
  rect: { x: number; y: number; width: number; height: number }
): void {
  const image = texture.image as { width?: number; height?: number } | undefined;
  // Without dimensions we can't compute a sensible sub-rectangle; the sprite
  // renders with the full texture (the linter warns on region misuse).
  if (!image?.width || !image.height) return;
  texture.repeat.set(rect.width / image.width, rect.height / image.height);
  texture.offset.set(rect.x / image.width, 1 - (rect.y + rect.height) / image.height);
}
