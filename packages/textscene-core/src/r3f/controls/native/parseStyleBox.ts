/**
 * Resolve a Control's StyleBox theme override (e.g. `theme_override_styles/panel
 * = SubResource("StyleBoxFlat_x")`) to a typed `StyleBoxFlatData`. Reuses the
 * same SubResource resolution funnel `resolveStyleBoxCss`
 * (`../resolveStyleBox.ts`) uses — `parseResourceReference` + `findSubResource`
 * — but returns numbers for the native (WebGL) canvas painter instead of CSS
 * for the DOM overlay.
 *
 * Degrades to `null`, never throws, for: an absent ref, a non-SubResource
 * reference (ExtResource / malformed string), an unknown id, or an id that
 * resolves to something other than `StyleBoxFlat` (`StyleBoxEmpty` included —
 * it carries no fill/border data to read). A resolved `StyleBoxFlat` with
 * absent keys fills them from Godot's documented defaults; see
 * `native/styleBoxFlat.ts` for the field-by-field citation.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver';
import { colorOr } from '../../../utils/colorParser';
import { floatOr, boolOr } from '../../../parser/valueParsers';
import type { StyleBoxFlatData } from './styleBoxFlat';

const DEFAULT_BG_COLOR = { r: 0.6, g: 0.6, b: 0.6, a: 1 }; // style_box_flat.h:38
const DEFAULT_BORDER_COLOR = { r: 0.8, g: 0.8, b: 0.8, a: 1 }; // style_box_flat.h:40

const CONTEXT = 'StyleBoxFlat';

/** `content_margin_<side>`'s `-1` sentinel (`style_box.cpp:143`): "ask the stylebox's own style margin". */
const CONTENT_MARGIN_UNSET = -1;

function contentMarginOr(raw: string | undefined, borderWidth: number): number {
  // style_box.cpp::get_margin: content_margin[side] < 0 (default -1) reads
  // through get_style_margin(side), which StyleBoxFlat overrides
  // (style_box_flat.cpp::get_style_margin) to return border_width[side].
  const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, CONTEXT);
  return parsed < 0 ? borderWidth : parsed;
}

export function parseStyleBox(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): StyleBoxFlatData | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'StyleBoxFlat') return null;

  const data = resource.data as Record<string, string>;

  const borderWidth = {
    left: floatOr(data.border_width_left, 0, CONTEXT),
    top: floatOr(data.border_width_top, 0, CONTEXT),
    right: floatOr(data.border_width_right, 0, CONTEXT),
    bottom: floatOr(data.border_width_bottom, 0, CONTEXT),
  };

  return {
    bgColor: colorOr(data.bg_color, DEFAULT_BG_COLOR),
    borderColor: colorOr(data.border_color, DEFAULT_BORDER_COLOR),
    borderWidth,
    cornerRadius: {
      topLeft: floatOr(data.corner_radius_top_left, 0, CONTEXT),
      topRight: floatOr(data.corner_radius_top_right, 0, CONTEXT),
      bottomRight: floatOr(data.corner_radius_bottom_right, 0, CONTEXT),
      bottomLeft: floatOr(data.corner_radius_bottom_left, 0, CONTEXT),
    },
    expandMargin: {
      left: floatOr(data.expand_margin_left, 0, CONTEXT),
      top: floatOr(data.expand_margin_top, 0, CONTEXT),
      right: floatOr(data.expand_margin_right, 0, CONTEXT),
      bottom: floatOr(data.expand_margin_bottom, 0, CONTEXT),
    },
    contentMargin: {
      left: contentMarginOr(data.content_margin_left, borderWidth.left),
      top: contentMarginOr(data.content_margin_top, borderWidth.top),
      right: contentMarginOr(data.content_margin_right, borderWidth.right),
      bottom: contentMarginOr(data.content_margin_bottom, borderWidth.bottom),
    },
    drawCenter: boolOr(data.draw_center, true, CONTEXT),
    borderBlend: boolOr(data.border_blend, false, CONTEXT),
  };
}
