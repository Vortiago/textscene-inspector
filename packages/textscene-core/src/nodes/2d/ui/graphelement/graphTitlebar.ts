/**
 * The titlebar band GraphNode and GraphFrame build: `titlebar_hbox`, an internal `HBoxContainer`
 * that holds one internal `Label`, `title_label` (`graph_node.cpp:1322-1334`, `graph_frame.cpp:348-360`).
 * Both are `INTERNAL_MODE_FRONT` children and never serialised, so the owning node's `title` is the
 * only `.tscn` input. The Label's own solver and painter size and draw the title.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { SIZE_EXPAND_FILL } from '../../../../godot/scene/control';
import {
  internalControlsOf,
  type InternalControlsFn,
  type InternalLayoutFn,
} from '../../../../r3f/controls/native/internalControls';
import { defineChannel } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { sidesSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { LabelProperties } from '../label/types';
import { parsedSceneLines } from '../../../../r3f/controls/native/sceneLines';

/** How one GraphElement class builds its `title_label`. */
interface TitleLabelSpec {
  /** `title_label->set_theme_type_variation(...)`. */
  variation: string;
  /** `title_label->set_horizontal_alignment(...)`, where the class sets one. */
  horizontalAlignment?: number;
}

/** `graph_node.cpp:1327-1330`. */
export const GRAPH_NODE_TITLE_LABEL: TitleLabelSpec = { variation: 'GraphNodeTitleLabel' };

/** `graph_frame.cpp:353-357`. */
export const GRAPH_FRAME_TITLE_LABEL: TitleLabelSpec = {
  variation: 'GraphFrameTitleLabel',
  horizontalAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
};

/** The scene lines `title_label`'s setters stand for, parsed by the Label parser for its constructor defaults. */
function titleLabelLines(label: TitleLabelSpec): Record<string, string> {
  return {
    size_flags_horizontal: String(SIZE_EXPAND_FILL),
    ...(label.horizontalAlignment !== undefined && {
      horizontal_alignment: String(label.horizontalAlignment),
    }),
  };
}

/** `titlebar_hbox` holding `title_label`, whose text `set_title` writes. */
export function titlebarInternalControls(label: TitleLabelSpec): InternalControlsFn {
  return (owner) => {
    const title = (owner.node.properties as { title?: string }).title ?? '';
    // The title is set after the parse: it is already a value, not a scene-line literal to quote.
    const labelProperties: Partial<LabelProperties> = {
      ...parsedSceneLines('Label', 'title_label', titleLabelLines(label)),
      text: title,
    };
    return [
      {
        mode: 'front',
        spec: {
          type: 'HBoxContainer',
          name: 'titlebar_hbox',
          properties: { sizeFlagsHorizontal: SIZE_EXPAND_FILL },
          children: [
            { type: 'Label', name: 'title_label', variation: label.variation, properties: labelProperties },
          ],
        },
      },
    ];
  };
}

/** The combined minimum size of the owner's `titlebar_hbox`. */
function titlebarHboxMinimumSize(owner: SolveNode, ctx: SolveContext) {
  const [hbox] = internalControlsOf(owner, ctx.theme);
  if (!hbox) throw new Error(`expected ${owner.path} to build a titlebar_hbox, found none`);
  return ctx.combinedMinimumSize(hbox.node);
}

function titlebarStyleOf(owner: SolveNode): StyleBoxFlatData {
  return requiredThemeItem(owner.styleBoxes, 'titlebar');
}

/** `titlebar_hbox->get_minimum_size() + sb_titlebar->get_minimum_size()` (`graph_node.cpp:983`, `graph_frame.cpp:328`). */
export function titlebarMinimumSize(owner: SolveNode, ctx: SolveContext) {
  const hbox = titlebarHboxMinimumSize(owner, ctx);
  const margins = sidesSize(titlebarStyleOf(owner).contentMargin);
  return { x: hbox.x + margins.x, y: hbox.y + margins.y };
}

/** The height the titlebar StyleBox draws at (`graph_node.cpp:634`, `graph_frame.cpp:106`), sealed for the painter. */
export const titlebarBandHeightChannel = defineChannel<number>('GraphElement.titlebarBandHeight');

/** The two heights of the band one `_resort` reads. */
interface TitlebarHeights {
  /**
   * The height `_resort` lays the body out below (`graph_node.cpp:165,252`, `graph_frame.cpp:157-160`).
   * It reads the hbox's minimum as a `Size2i`, so the height truncates to whole pixels.
   */
  resort: number;
  /** The height the box draws at, sealed with {@link titlebarBandHeightChannel}. */
  drawn: number;
}

export function titlebarHeights(owner: SolveNode, ctx: SolveContext): TitlebarHeights {
  const hbox = titlebarHboxMinimumSize(owner, ctx);
  const margins = sidesSize(titlebarStyleOf(owner).contentMargin).y;
  return { resort: Math.trunc(hbox.y) + margins, drawn: hbox.y + margins };
}

/** The titlebar's rect and the body's below it, relative to the owner's top-left, for the band height the solve sealed. */
export function titlebarAndBodyRects(rect: Rect2, bandHeight: number): { titlebar: Rect2; body: Rect2 } {
  return {
    titlebar: { x: 0, y: 0, w: rect.w, h: bandHeight },
    body: { x: 0, y: bandHeight, w: rect.w, h: Math.max(0, rect.h - bandHeight) },
  };
}

/**
 * `fit_child_in_rect(titlebar_hbox, Rect2(sb_titlebar->get_offset(), titlebar_size))` (`graph_node.cpp:159-162`,
 * `graph_frame.cpp:150-154`): the owner's width less the box's margins, at the box's offset. The solve
 * floors the height at the hbox's minimum, as `set_rect` does (`control.cpp:1773-1797`). `set_rect`
 * mirrors the offsets it writes and `_size_changed` mirrors them back, so the offset holds in a
 * right-to-left layout too (`control.cpp:904-915`).
 */
export const titlebarInternalLayout: InternalLayoutFn = (owner, internals, rect) => {
  const { left, top, right } = titlebarStyleOf(owner).contentMargin;
  const hboxRect = { x: left, y: top, w: Math.max(0, rect.w - left - right), h: 0 };
  return new Map(internals.map(({ node }) => [node.path, hboxRect]));
};
