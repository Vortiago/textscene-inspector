/**
 * Resolve a Control's StyleBox theme override (e.g. `theme_override_styles/panel
 * = SubResource("StyleBoxFlat_x")`) to a typed `ResolvedStyleBox`, via the
 * SubResource resolution funnel `parseResourceReference` + `findSubResource`,
 * covering all four concrete StyleBox kinds Godot ships
 * (`scene/resources/style_box*.cpp`): `StyleBoxFlat`, `StyleBoxEmpty`,
 * `StyleBoxLine` and `StyleBoxTexture`.
 *
 * Degrades to `null`, never throws, for: an absent ref, a non-SubResource
 * reference (ExtResource / malformed string), an unknown id, or an id that
 * resolves to something that is not a StyleBox at all. `null` means "no
 * override" — consumers fall back to the default theme on it, so a resolved
 * `StyleBoxEmpty` must NOT take that route: Godot's local-override branch
 * returns it unconditionally and `StyleBoxEmpty::draw` has an empty body, so
 * it REPLACES the widget's chrome with nothing. It comes back as a box that
 * paints nothing and carries zero style margin. A resolved `StyleBoxFlat` with
 * absent keys fills them from Godot's documented defaults; see
 * `native/styleBoxFlat.ts` for the field-by-field citation.
 *
 * `StyleBoxLineBox`/`StyleBoxTextureBox` EXTEND `StyleBoxFlatData` rather than
 * replacing it in a bare union — `SolveNode.styleBoxes` (`native/solveTree.ts`)
 * is typed `Record<string, StyleBoxFlatData>`, and every existing consumer
 * across the codebase (`PanelChrome`, `contentMarginSize`, a dozen
 * `nativeSolver.ts`s) already reads that field assuming exactly that shape. A
 * type that ADDS fields on top of `StyleBoxFlatData` is still assignable
 * wherever a bare `StyleBoxFlatData` is expected, so `ResolvedStyleBox` (the
 * union of all three) is a drop-in `StyleBoxFlatData` for every one of those —
 * min-size math reads the WRAPPER's own `contentMargin` (kind-correct, see
 * `styleBoxLine.ts`/`styleBoxTexture.ts`) and gets the right answer without
 * knowing a wrapper exists, while `StyleBoxQuad.tsx` (which DOES know) reads
 * the extra `styleBoxKind` tag to draw the real thing. The wrapped core is
 * otherwise a NEUTRAL, no-draw `StyleBoxFlatData` (`neutralFlatCore`) — a
 * consumer that draws a `styleBoxes` entry directly, bypassing
 * `StyleBoxQuad`, silently paints nothing for a line/texture override rather
 * than the wrong thing, mirroring how `StyleBoxEmpty` already degrades.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver';
import { colorOr } from '../../../utils/colorParser';
import { floatOr, boolOr } from '../../../parser/valueParsers';
import { parseVector2 } from '../../../parser/vectors';
import type { Vec2 } from './rect';
import type { StyleBoxFlatData } from './styleBoxFlat';
import { parseStyleBoxLine, type StyleBoxLineData } from './styleBoxLine';
import { parseStyleBoxTexture, type StyleBoxTextureData } from './styleBoxTexture';

const DEFAULT_BG_COLOR = { r: 0.6, g: 0.6, b: 0.6, a: 1 }; // style_box_flat.h:38
const DEFAULT_BORDER_COLOR = { r: 0.8, g: 0.8, b: 0.8, a: 1 }; // style_box_flat.h:40
const DEFAULT_SHADOW_COLOR = { r: 0, g: 0, b: 0, a: 0.6 }; // style_box_flat.h:39
const ZERO_VECTOR2: Vec2 = { x: 0, y: 0 }; // `skew`/`shadow_offset` (style_box_flat.h:48,53)
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

const CONTEXT = 'StyleBoxFlat';

/** `content_margin_<side>`'s `-1` sentinel (`style_box.cpp:143`): "ask the stylebox's own style margin". */
const CONTENT_MARGIN_UNSET = -1;

/** `StyleBoxFlat::set_aa_size`'s clamp range (`style_box_flat.cpp`), applied to every authored `aa_size`. */
const AA_SIZE_MIN = 0.01;
const AA_SIZE_MAX = 10;
/** `StyleBoxFlat::set_corner_detail` (`style_box_flat.cpp:130`) — CLAMP(detail, 1, 20). */
const CORNER_DETAIL_MIN = 1;
const CORNER_DETAIL_MAX = 20;

/** A `Vector2(x, y)` property, or `fallback` when absent or ungrammatical — this resolver degrades, never throws (see the module doc). */
function vector2Or(raw: string | undefined, fallback: Vec2): Vec2 {
  if (raw === undefined) return fallback;
  try {
    return parseVector2(raw);
  } catch {
    return fallback;
  }
}

function contentMarginOr(raw: string | undefined, borderWidth: number): number {
  // style_box.cpp::get_margin: content_margin[side] < 0 (default -1) reads
  // through get_style_margin(side), which StyleBoxFlat overrides
  // (style_box_flat.cpp::get_style_margin) to return border_width[side].
  const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, CONTEXT);
  return parsed < 0 ? borderWidth : parsed;
}

/**
 * A `StyleBoxLine`/`StyleBoxTexture` wrapper's `StyleBoxFlatData` core — see
 * the module doc for why one is needed at all. Every field except
 * `contentMargin` is the same no-draw neutral `StyleBoxEmpty` already uses:
 * a bare `styleBoxFlatGeometry` call against it emits zero vertices.
 */
function neutralFlatCore(contentMargin: StyleBoxFlatData['contentMargin']): StyleBoxFlatData {
  return {
    bgColor: TRANSPARENT,
    borderColor: TRANSPARENT,
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin,
    drawCenter: false,
    borderBlend: false,
    antiAliased: false,
    aaSize: 1,
    cornerDetail: 1,
    skew: ZERO_VECTOR2,
    shadowColor: TRANSPARENT,
    shadowSize: 0,
    shadowOffset: ZERO_VECTOR2,
  };
}

/**
 * A resolved `StyleBoxEmpty` as `StyleBoxFlatData`: nothing to draw
 * (`StyleBoxEmpty::draw` is empty), and `get_style_margin` is the base
 * `StyleBox`'s 0 rather than `StyleBoxFlat`'s border width, so an unset
 * `content_margin_<side>` resolves to 0. Unlike the flat core's OWN
 * `expandMargin`, which stays neutral for a line/texture WRAPPER, a
 * StyleBoxEmpty's `expand_margin_*` is real Godot state (`StyleBox`'s own
 * base property) and is kept.
 */
function emptyStyleBox(data: Record<string, string>): StyleBoxFlatData {
  const contentMargin = (raw: string | undefined): number => {
    const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, CONTEXT);
    return parsed < 0 ? 0 : parsed;
  };
  return {
    ...neutralFlatCore({
      left: contentMargin(data.content_margin_left),
      top: contentMargin(data.content_margin_top),
      right: contentMargin(data.content_margin_right),
      bottom: contentMargin(data.content_margin_bottom),
    }),
    expandMargin: {
      left: floatOr(data.expand_margin_left, 0, CONTEXT),
      top: floatOr(data.expand_margin_top, 0, CONTEXT),
      right: floatOr(data.expand_margin_right, 0, CONTEXT),
      bottom: floatOr(data.expand_margin_bottom, 0, CONTEXT),
    },
  };
}

/** A resolved `theme_override_styles/*` slot naming a `StyleBoxLine`. See the module doc for why this EXTENDS `StyleBoxFlatData`. */
export interface StyleBoxLineBox extends StyleBoxFlatData {
  styleBoxKind: 'line';
  line: StyleBoxLineData;
}

/** A resolved `theme_override_styles/*` slot naming a `StyleBoxTexture`. See the module doc for why this EXTENDS `StyleBoxFlatData`. */
export interface StyleBoxTextureBox extends StyleBoxFlatData {
  styleBoxKind: 'texture';
  texture: StyleBoxTextureData;
}

/** Every concrete StyleBox kind `parseStyleBox` can resolve to. A bare `StyleBoxFlatData` covers both `StyleBoxFlat` and `StyleBoxEmpty` — the two have always shared one shape (see the module doc for `StyleBoxEmpty`'s own history here). */
export type ResolvedStyleBox = StyleBoxFlatData | StyleBoxLineBox | StyleBoxTextureBox;

/**
 * Wraps an already-resolved `StyleBoxLineData` (e.g. `Separator`'s own
 * default-theme box, `nodes/2d/ui/separator/styleBoxLine.ts`'s
 * `defaultSeparatorStyleBoxLine` — never itself a `theme_override_styles/*`
 * ref, so it never goes through `parseStyleBox` itself) into the same
 * `StyleBoxLineBox` shape a resolved override does, so a caller can feed
 * EITHER to `<StyleBoxQuad>`/`separatorPlacementRect` without branching on
 * which one it got.
 */
/** Whether a resolved slot holds a `StyleBoxTexture` — the one kind whose tint is a multiply rather than a substitution. */
export function isStyleBoxTexture(box: ResolvedStyleBox): box is StyleBoxTextureBox {
  return (box as StyleBoxTextureBox).styleBoxKind === 'texture';
}

/** The `StyleBoxTextureBox` counterpart to {@link styleBoxLineBox}, for an already-resolved texture box. */
export function styleBoxTextureBox(texture: StyleBoxTextureData): StyleBoxTextureBox {
  return { ...neutralFlatCore(texture.contentMargin), styleBoxKind: 'texture', texture };
}

export function styleBoxLineBox(line: StyleBoxLineData): StyleBoxLineBox {
  return { ...neutralFlatCore(line.margin), styleBoxKind: 'line', line };
}

export function parseStyleBox(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): ResolvedStyleBox | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource) return null;

  const data = resource.data as Record<string, string>;

  if (resource.type === 'StyleBoxEmpty') return emptyStyleBox(data);
  if (resource.type === 'StyleBoxLine') {
    const line = parseStyleBoxLine(ref, internalResources);
    return line && { ...neutralFlatCore(line.margin), styleBoxKind: 'line', line };
  }
  if (resource.type === 'StyleBoxTexture') {
    const texture = parseStyleBoxTexture(ref, externalResources, internalResources);
    return texture && { ...neutralFlatCore(texture.contentMargin), styleBoxKind: 'texture', texture };
  }
  if (resource.type !== 'StyleBoxFlat') return null;

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
    // Scene-file keys, not the C++ member names: `_bind_methods` exports
    // `set_anti_aliased`/`set_aa_size` as `anti_aliasing`/`anti_aliasing_size`.
    antiAliased: boolOr(data.anti_aliasing, true, CONTEXT),
    aaSize: clamp(floatOr(data.anti_aliasing_size, 1, CONTEXT), AA_SIZE_MIN, AA_SIZE_MAX),
    cornerDetail: Math.round(
      clamp(floatOr(data.corner_detail, 8, CONTEXT), CORNER_DETAIL_MIN, CORNER_DETAIL_MAX)
    ),
    skew: vector2Or(data.skew, ZERO_VECTOR2),
    shadowColor: colorOr(data.shadow_color, DEFAULT_SHADOW_COLOR),
    // `set_shadow_size` takes an int and the property is INT-typed
    // (`style_box_flat.cpp:727`), so a fractional authored value truncates
    // rather than growing the ring by a fraction.
    shadowSize: Math.trunc(floatOr(data.shadow_size, 0, CONTEXT)),
    shadowOffset: vector2Or(data.shadow_offset, ZERO_VECTOR2),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
