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
import { SizeFlags } from '../../../../godot/scene/control';
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
// The band is an HBoxContainer that holds a Label, so its solve needs both classes' solvers.
import '../hboxcontainer/nativeSolver';
import '../label/solverRegistration';

/** `SIZE_EXPAND_FILL` (`control.h:85`), which both Controls set on themselves. */
const EXPAND_FILL = SizeFlags.EXPAND | SizeFlags.FILL;

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

/** `titlebar_hbox` holding `title_label`, whose text `set_title` writes. */
export function titlebarInternalControls(label: TitleLabelSpec): InternalControlsFn {
  return (owner) => {
    const title = (owner.node.properties as { title?: string }).title ?? '';
    const labelProperties: Partial<LabelProperties> = {
      text: title,
      sizeFlagsHorizontal: EXPAND_FILL,
      ...(label.horizontalAlignment !== undefined && { horizontalAlignment: label.horizontalAlignment }),
    };
    return [
      {
        mode: 'front',
        spec: {
          type: 'HBoxContainer',
          name: 'titlebar_hbox',
          properties: { sizeFlagsHorizontal: EXPAND_FILL },
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

/**
 * The band height `_resort` lays the body out below (`graph_node.cpp:165,252`, `graph_frame.cpp:157-160`).
 * It reads the hbox's minimum as a `Size2i`, so the height truncates to whole pixels.
 */
export function titlebarResortHeight(owner: SolveNode, ctx: SolveContext): number {
  const hbox = titlebarHboxMinimumSize(owner, ctx);
  return Math.trunc(hbox.y) + sidesSize(titlebarStyleOf(owner).contentMargin).y;
}

/** The rect the titlebar StyleBox draws in, relative to the owner's top-left. */
export function titlebarRect(ownerWidth: number, bandHeight: number): Rect2 {
  return { x: 0, y: 0, w: ownerWidth, h: bandHeight };
}

/**
 * `fit_child_in_rect(titlebar_hbox, Rect2(sb_titlebar->get_offset(), titlebar_size))` (`graph_node.cpp:159-162`,
 * `graph_frame.cpp:150-154`): the owner's width less the box's margins, at the box's offset. The solve
 * floors the height at the hbox's minimum, as `set_rect` does, and a right-to-left layout mirrors the
 * position (`control.cpp:1773-1797`).
 */
export const titlebarInternalLayout: InternalLayoutFn = (owner, internals, rect) => {
  const { left, top, right } = titlebarStyleOf(owner).contentMargin;
  const hboxRect = { x: owner.rtl ? right : left, y: top, w: Math.max(0, rect.w - left - right), h: 0 };
  return new Map(internals.map(({ node }) => [node.path, hboxRect]));
};
