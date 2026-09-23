/**
 * A resolved `StyleBoxTexture` SubResource (`style_box_texture.h`/`.cpp`) for any
 * `theme_override_styles/*` slot. It draws through `native/ninePatchGeometry.ts`,
 * since `StyleBoxTexture::draw` makes the same `canvas_item_add_nine_patch` call
 * as `NinePatchRect` (`style_box_texture.cpp:183`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { SceneScope, TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver';
import { colorOr } from '../../../utils/colorParser';
import { floatOr, intOr, boolOr, parseOptionalRect2, type Rect2Value } from '../../../parser/valueParsers';
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import { NINE_PATCH_STRETCH, type NinePatchAxisMode } from './ninePatchGeometry';

export interface StyleBoxTextureData {
  /**
   * The raw `texture` ref, such as `ExtResource("id")`: pixels need `useTexture2D`,
   * which `StyleBoxQuad.tsx` calls. `undefined` draws nothing (`texture.is_null()`).
   */
  texture: string | undefined;
  /** The node's own scope that `texture` resolves ids against, not the top-level scene's. */
  resources: SceneScope;
  /**
   * `texture_margin_*` (`style_box_texture.h`), default `0`: the raw margin the
   * nine-patch samples with (`style_box_texture.cpp:178-179`). It never moves
   * with an authored `content_margin_*`.
   */
  margin: { left: number; top: number; right: number; bottom: number };
  /**
   * `StyleBox::get_margin` (`style_box.cpp:78-86`): the authored
   * `content_margin_<side>`, or, when unset, `texture_margin[side]`
   * (`style_box_texture.cpp:33-36`). The drawn nine-patch never uses it.
   */
  contentMargin: { left: number; top: number; right: number; bottom: number };
  /** `expand_margin_*`, default `0`. */
  expandMargin: { left: number; top: number; right: number; bottom: number };
  /** `region_rect`: `undefined` or all-zero means the whole texture. */
  regionRect: Rect2Value | undefined;
  axisStretchHorizontal: NinePatchAxisMode;
  axisStretchVertical: NinePatchAxisMode;
  /** `draw_center`, default `true`. */
  drawCenter: boolean;
  /** `modulate_color`, default `Color(1, 1, 1, 1)`. */
  modulateColor: ControlColor;
}

const CONTEXT = 'StyleBoxTexture';
const DEFAULT_MODULATE: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/** `style_box.cpp:143`'s sentinel: "ask `get_style_margin`" (also `parseStyleBox.ts`'s `CONTENT_MARGIN_UNSET`). */
const CONTENT_MARGIN_UNSET = -1;

function toAxisMode(value: number): NinePatchAxisMode {
  return value === 1 || value === 2 ? value : NINE_PATCH_STRETCH;
}

function contentMarginOr(raw: string | undefined, textureMarginSide: number): number {
  const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, CONTEXT);
  return parsed < 0 ? textureMarginSide : parsed;
}

/**
 * Resolves a StyleBox-slot ref to a `StyleBoxTextureData`, or `null` for an
 * absent or malformed ref, a non-SubResource form, an unknown id, or a
 * resource that is not a `StyleBoxTexture`.
 */
export function parseStyleBoxTexture(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): StyleBoxTextureData | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'StyleBoxTexture') return null;

  const data = resource.data as Record<string, string>;
  const margin = {
    left: floatOr(data.texture_margin_left, 0, CONTEXT),
    top: floatOr(data.texture_margin_top, 0, CONTEXT),
    right: floatOr(data.texture_margin_right, 0, CONTEXT),
    bottom: floatOr(data.texture_margin_bottom, 0, CONTEXT),
  };

  return {
    texture: data.texture,
    resources: { externalResources, internalResources },
    margin,
    contentMargin: {
      left: contentMarginOr(data.content_margin_left, margin.left),
      top: contentMarginOr(data.content_margin_top, margin.top),
      right: contentMarginOr(data.content_margin_right, margin.right),
      bottom: contentMarginOr(data.content_margin_bottom, margin.bottom),
    },
    expandMargin: {
      left: floatOr(data.expand_margin_left, 0, CONTEXT),
      top: floatOr(data.expand_margin_top, 0, CONTEXT),
      right: floatOr(data.expand_margin_right, 0, CONTEXT),
      bottom: floatOr(data.expand_margin_bottom, 0, CONTEXT),
    },
    regionRect: parseOptionalRect2(data.region_rect, `${CONTEXT} region_rect`),
    axisStretchHorizontal: toAxisMode(intOr(data.axis_stretch_horizontal, NINE_PATCH_STRETCH, CONTEXT)),
    axisStretchVertical: toAxisMode(intOr(data.axis_stretch_vertical, NINE_PATCH_STRETCH, CONTEXT)),
    drawCenter: boolOr(data.draw_center, true, CONTEXT),
    modulateColor: colorOr(data.modulate_color, DEFAULT_MODULATE),
  };
}
