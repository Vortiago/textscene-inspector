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
import { type Vector2, vector2Max } from '../../../godot/math/vector';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { InternalLayoutFn } from '../../../r3f/controls/native/internalControls';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { labelMinimumSize } from '../../2d/ui/label/nativeSolver';
import { everyChildFills, largestLaidOutChildMinimum } from '../window/contentFill';
import { windowContentScale } from '../window/contentScale';
import type { WindowProperties } from '../window/types';
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
function buttonRowRect(dialog: SolveNode, size: Vector2, ctx: SolveContext): Rect2 {
  const panel = dialogPanelBox(dialog);
  const height = buttonRowMinimum(dialog, ctx).y;
  return {
    x: panel.contentMargin.left,
    y: size.y - panel.contentMargin.bottom - height,
    w: size.x - contentMarginSize(panel).x,
    h: height,
  };
}

/**
 * `_update_child_rects` (`dialogs.cpp:219-260`) for the dialog's internal Controls: the row from the
 * bottom edge, and every other one in the content rect above it.
 */
export const dialogInternalLayout: InternalLayoutFn = (dialog, internals, rect, ctx) => {
  const size = { x: rect.w, y: rect.h };
  const content = dialogContentRect(dialog, size, ctx);
  const row = buttonRowRect(dialog, size, ctx);
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

/** The largest combined minimum among the dialog's own Controls: the authored ones and its class's body. */
function largestChildMinimum(dialog: SolveNode, ctx: SolveContext): Vector2 {
  return dialogBodyNodes(dialog, ctx.theme).reduce(
    (largest, body) => vector2Max(largest, ctx.combinedMinimumSize(body)),
    largestLaidOutChildMinimum(dialog, ctx)
  );
}

/**
 * `AcceptDialog::_get_contents_minimum_size` (`dialogs.cpp:281-316`): the message and the authored
 * Controls stacked above the button row and its separation, inside the panel's margins.
 */
export const dialogContentsMinimumSize: MinimumSizeFn = (dialog, ctx) => {
  const margins = contentMarginSize(dialogPanelBox(dialog));
  const separation = buttonsSeparation(dialog);
  const row = buttonRowMinimum(dialog, ctx);
  const authored = largestChildMinimum(dialog, ctx);
  const widthWithoutMessage = Math.max(row.x, authored.x);
  const message = messageMinimumSize(dialog, ctx, wrapWidth(dialog, widthWithoutMessage, margins.x));
  const content = vector2Max(authored, message);
  return {
    x: Math.max(row.x, content.x) + margins.x,
    y: content.y + row.y + separation + margins.y,
  };
};

/** Every authored Control takes the content rect (`dialogs.cpp:248-259`). */
export const dialogLayout: ContainerLayoutFn = (dialog, children, rect, ctx) => {
  return everyChildFills(children, dialogContentRect(dialog, { x: rect.w, y: rect.h }, ctx));
};
