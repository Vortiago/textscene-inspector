/**
 * `StyleBoxTexture` — a resolved `StyleBoxTexture` SubResource
 * (`style_box_texture.h`/`.cpp`), the generic parse any `theme_override_
 * styles/*` slot resolves to when it names this kind. Reuses
 * `native/ninePatchGeometry.ts` for its draw geometry — `StyleBoxTexture::
 * draw` funnels through the identical `canvas_item_add_nine_patch` call
 * `NinePatchRect` does (`style_box_texture.cpp:183`), so no separate
 * tessellator exists for it.
 *
 * `texture` stays a RAW resource ref: resolving pixels needs `useTexture2D`,
 * a hook this pure-data parser cannot call. `resources` carries the scope
 * (`SceneScope`) that ref names ids against — the node's OWN, not the ambient
 * top-level scene's, mirroring every other resource resolved off a `SolveNode`
 * — so the painter that eventually resolves it (`StyleBoxQuad.tsx`) needs no
 * separate prop threaded in from its caller.
 *
 * `margin` is the RAW `texture_margin_*` the nine-patch draw itself samples
 * with (`StyleBoxTexture::draw`'s `start_offset`/`end_offset`,
 * `style_box_texture.cpp:178-179`) — independent of the EFFECTIVE content
 * margin (`StyleBox::get_margin`'s `content_margin_*`-or-`texture_margin_*`
 * fallback), which a caller reaches through the wrapping `StyleBoxFlatData`
 * core's own `contentMargin` instead (`native/parseStyleBox.ts`). The two
 * can diverge the moment `content_margin_*` is authored, and Godot keeps them
 * that way: the drawn nine-patch margin never moves with it.
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
  /** Raw `texture` ref (e.g. `ExtResource("id")`); `undefined` draws nothing (`StyleBoxTexture::draw`'s `texture.is_null()` guard). */
  texture: string | undefined;
  /** The scope `texture` resolves ids against. */
  resources: SceneScope;
  /** `texture_margin_*` (`style_box_texture.h`) — default `0`. The RAW nine-patch draw margin, not the effective content margin. */
  margin: { left: number; top: number; right: number; bottom: number };
  /**
   * `StyleBox::get_margin` (`style_box.cpp:78-86`): the authored
   * `content_margin_<side>`, or — when unset (the `-1` sentinel) —
   * `StyleBoxTexture::get_style_margin` (`style_box_texture.cpp:33-36`),
   * which returns `texture_margin[side]` directly. Diverges from `margin`
   * above the moment `content_margin_*` is authored; the drawn nine-patch
   * always uses `margin`, never this.
   */
  contentMargin: { left: number; top: number; right: number; bottom: number };
  /** `expand_margin_*` — default `0`. */
  expandMargin: { left: number; top: number; right: number; bottom: number };
  /** `region_rect` — `undefined` (or all-zero) means the whole texture. */
  regionRect: Rect2Value | undefined;
  axisStretchHorizontal: NinePatchAxisMode;
  axisStretchVertical: NinePatchAxisMode;
  /** `draw_center` — default `true`. */
  drawCenter: boolean;
  /** `modulate_color` — default `Color(1, 1, 1, 1)`. */
  modulateColor: ControlColor;
}

const CONTEXT = 'StyleBoxTexture';
const DEFAULT_MODULATE: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

/** `style_box.cpp:143`'s sentinel — "ask `get_style_margin`" (also `parseStyleBox.ts`'s `CONTENT_MARGIN_UNSET`). */
const CONTENT_MARGIN_UNSET = -1;

function toAxisMode(value: number): NinePatchAxisMode {
  return value === 1 || value === 2 ? value : NINE_PATCH_STRETCH;
}

function contentMarginOr(raw: string | undefined, textureMarginSide: number): number {
  const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, CONTEXT);
  return parsed < 0 ? textureMarginSide : parsed;
}

/**
 * Resolve a `theme_override_styles/*` (or any StyleBox-slot) ref to a
 * `StyleBoxTextureData`, or `null` for an absent/malformed ref, a
 * non-SubResource form, an unknown id, or a resource that is not a
 * `StyleBoxTexture` at all.
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
