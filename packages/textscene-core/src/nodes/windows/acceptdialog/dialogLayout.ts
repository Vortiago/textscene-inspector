/**
 * An AcceptDialog's layout (`scene/gui/dialogs.cpp:219-316`): the background panel fills the window,
 * the button row sits on the bottom edge at its minimum height, and the message label, the class's
 * body and every authored Control fill what is left. The dialog grows to hold its content and its
 * buttons. Pure functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import { type Vector2, VECTOR2_ZERO, vector2Max } from '../../../godot/math/vector';
import { perObject } from '../../../utils/perObject';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { InternalLayoutFn } from '../../../r3f/controls/native/internalControls';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type {
  ContainerLayoutFn,
  LoadedMinimumSizeFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { labelMinimumSize } from '../../2d/ui/label/nativeSolver';
import { everyChildFills, largestLaidOutChildMinimum } from '../window/contentFill';
import { windowContentScale } from '../window/contentScale';
import type { WindowProperties } from '../window/types';
import type { DialogProperties } from './parser';
import {
  buttonRowNode,
  buttonsSeparation,
  cachedMessageLabelNode,
  dialogBodyNodes,
  dialogPanelBox,
  takesContentRect,
} from './dialogParts';

/** `buttons_hbox->get_combined_minimum_size()` (`dialogs.cpp:238,305`). */
function buttonRowMinimum(dialog: SolveNode, ctx: SolveContext): Vector2 {
  return ctx.combinedMinimumSize(buttonRowNode(dialog, ctx.theme));
}

/** The rect every authored Control takes (`dialogs.cpp:245-246`): the panel less the button row and its separation. */
function contentRectAbove(
  panel: ResolvedStyleBox,
  size: Vector2,
  rowHeight: number,
  separation: number
): Rect2 {
  const margins = contentMarginSize(panel);
  return {
    x: panel.contentMargin.left,
    y: panel.contentMargin.top,
    w: size.x - margins.x,
    h: size.y - margins.y - rowHeight - separation,
  };
}

function dialogContentRect(dialog: SolveNode, size: Vector2, ctx: SolveContext): Rect2 {
  const panel = dialogPanelBox(dialog);
  return contentRectAbove(panel, size, buttonRowMinimum(dialog, ctx).y, buttonsSeparation(dialog));
}

/** The row's rect (`dialogs.cpp:238-242`): on the bottom edge inside the panel margins, at its minimum height. */
function buttonRowRect(panel: ResolvedStyleBox, size: Vector2, rowHeight: number): Rect2 {
  return {
    x: panel.contentMargin.left,
    y: size.y - panel.contentMargin.bottom - rowHeight,
    w: size.x - contentMarginSize(panel).x,
    h: rowHeight,
  };
}

/**
 * `_update_child_rects` (`dialogs.cpp:219-260`) for the dialog's internal Controls: the row from the
 * bottom edge, and every other one in the content rect above it.
 */
export const dialogInternalLayout: InternalLayoutFn = (dialog, internals, rect, ctx) => {
  const size = { x: rect.w, y: rect.h };
  const panel = dialogPanelBox(dialog);
  const rowHeight = buttonRowMinimum(dialog, ctx).y;
  const content = contentRectAbove(panel, size, rowHeight, buttonsSeparation(dialog));
  const row = buttonRowRect(panel, size, rowHeight);
  return new Map(
    internals.map((internal) => [internal.node.path, takesContentRect(internal) ? content : row])
  );
};

/**
 * The width the message label wraps at: the window's loaded width, widened to what its other
 * contents need, less the panel margins. The window only grows (`window.cpp:1183-1196`), so
 * a label that wraps at a loaded width keeps that width when it is the widest the window gets.
 */
function wrapWidth(dialog: SolveNode, otherMinimumWidth: number, marginsWidth: number): number {
  const props = dialog.node.properties as WindowProperties;
  const loaded = windowContentScale(props.size, props.content_scale).layoutSize.x;
  return Math.max(loaded, props.min_size.x, otherMinimumWidth + marginsWidth) - marginsWidth;
}

/** The message label's combined minimum, wrapped at `width` when `dialog_autowrap` is on. */
function messageMinimumSize(dialog: SolveNode, ctx: SolveContext, width: number): Vector2 {
  const label = cachedMessageLabelNode(dialog);
  return labelMinimumSize(label, {
    ...ctx,
    tentativeRect: (n) => (n === label ? { x: 0, y: 0, w: width, h: 0 } : undefined),
  });
}

/** The largest combined minimum among the Controls of the dialog's class body, at least `floor`. */
function largestBodyMinimum(dialog: SolveNode, ctx: SolveContext, floor: Vector2): Vector2 {
  return dialogBodyNodes(dialog, ctx.theme).reduce(
    (largest, body) => vector2Max(largest, ctx.combinedMinimumSize(body)),
    floor
  );
}

/** The largest combined minimum among the dialog's own Controls: the authored ones and its class's body. */
function largestChildMinimum(dialog: SolveNode, ctx: SolveContext): Vector2 {
  return largestBodyMinimum(dialog, ctx, largestLaidOutChildMinimum(dialog, ctx));
}

/**
 * `AcceptDialog::_get_contents_minimum_size` (`dialogs.cpp:281-316`) from the minimums of the content
 * and the button row: the content stacked above the row and its separation, inside the panel's margins.
 */
function stackedMinimumSize(dialog: SolveNode, content: Vector2, row: Vector2): Vector2 {
  const margins = contentMarginSize(dialogPanelBox(dialog));
  return {
    x: Math.max(row.x, content.x) + margins.x,
    y: content.y + row.y + buttonsSeparation(dialog) + margins.y,
  };
}

/** The message and the authored Controls stacked above the button row. */
export const dialogContentsMinimumSize: MinimumSizeFn = (dialog, ctx) => {
  const margins = contentMarginSize(dialogPanelBox(dialog));
  const row = buttonRowMinimum(dialog, ctx);
  const authored = largestChildMinimum(dialog, ctx);
  const widthWithoutMessage = Math.max(row.x, authored.x);
  const message = messageMinimumSize(dialog, ctx, wrapWidth(dialog, widthWithoutMessage, margins.x));
  return stackedMinimumSize(dialog, vector2Max(authored, message), row);
};

/**
 * The dialog as its message and buttons were when they first computed their minimums, under its own
 * path so a solve context keeps those minimums apart. It is an AcceptDialog: ConfirmationDialog
 * writes its size before it adds Cancel (`dialogs.cpp:528-533`), so its row holds only OK. Kept per
 * dialog node, so the internal Controls built from it are built once.
 */
const dialogAtLoad = perObject((dialog: SolveNode): SolveNode | null => {
  const props = dialog.node.properties as DialogProperties;
  if (!props.controls_at_load) return null;
  const properties = { ...props, ...props.controls_at_load, has_unwrapped_message_minimum: false };
  const node = { ...dialog.node, type: 'AcceptDialog', properties };
  return { ...dialog, path: `${dialog.path}@load`, node, children: [] };
});

/**
 * The contents minimum a size write reads at load. The class's body is built after the cached
 * Controls and reads fresh, and the authored Controls are not added yet. The message label has no
 * size before the dialog enters the tree, so an autowrapping one shapes at width 0, on one line
 * (`label.cpp:973-996`).
 */
export const dialogLoadedMinimumSize: LoadedMinimumSizeFn = (dialog, ctx) => {
  const loaded = dialogAtLoad(dialog);
  if (!loaded) return null;
  const body = largestBodyMinimum(dialog, ctx, VECTOR2_ZERO);
  const message = messageMinimumSize(loaded, ctx, 0);
  return stackedMinimumSize(loaded, vector2Max(body, message), buttonRowMinimum(loaded, ctx));
};

/** Every authored Control takes the content rect (`dialogs.cpp:248-259`). */
export const dialogLayout: ContainerLayoutFn = (dialog, children, rect, ctx) => {
  return everyChildFills(children, dialogContentRect(dialog, { x: rect.w, y: rect.h }, ctx));
};
