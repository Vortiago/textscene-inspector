/**
 * An AcceptDialog's layout (`scene/gui/dialogs.cpp:219-316`): the background panel fills the window,
 * the button row sits on the bottom edge at its minimum height, and the message label and every
 * authored Control fill what is left. The dialog grows to hold its content and its buttons. Pure
 * functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { SizeFlags, DEFAULT_SIZE_FLAGS } from '../../../godot/scene/control';
import { internalChildThemeItems } from '../../../r3f/controls/native/themeItems';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { boxContainerMinimumSize, resortBoxContainer } from '../../2d/ui/shared/boxContainerSolver';
import type { BoxChildInput } from '../../2d/ui/shared/boxContainerSolver';
import { labelMinimumSize } from '../../2d/ui/label/nativeSolver';
import { everyChildFills, largestLaidOutChildMinimum } from '../window/contentFill';
import { windowContentScale } from '../window/contentScale';
import type { WindowProperties } from '../window/types';
import {
  dialogButtonNode,
  dialogButtonText,
  dialogButtonRoles,
  buttonsSeparation,
  dialogPanelBox,
  cachedMessageLabelNode,
  type DialogButtonRole,
} from './dialogParts';

interface DialogButton {
  role: DialogButtonRole;
  text: string;
  /** In the dialog's own space. */
  rect: Rect2;
}

interface DialogGeometry {
  /** The message label's rect, which every authored Control shares (`content`). */
  content: Rect2;
  buttons: readonly DialogButton[];
}

/** `HBoxContainer::add_spacer`: it takes the width the buttons leave (`box_container.cpp`). */
const SPACER: BoxChildInput = {
  minSize: { x: 0, y: 0 },
  hSizeFlags: SizeFlags.EXPAND | SizeFlags.FILL,
  vSizeFlags: DEFAULT_SIZE_FLAGS,
  stretchRatio: 1,
};

/** A spacer leads the row and follows each button, so button `i` is child `1 + 2 * i`. */
const BUTTON_FIRST_SLOT = 1;
const BUTTON_SLOT_STRIDE = 2;

interface ButtonRow {
  /** The row's children, spacers included. */
  inputs: BoxChildInput[];
  /** The gap between the row's children. */
  separation: number;
  minimum: Vector2;
}

/** The `separation` theme item of the row's HBoxContainer, resolved through the dialog's theme chain (`dialogs.cpp:486`). */
function rowSeparation(dialog: SolveNode, ctx: SolveContext): number {
  return internalChildThemeItems(dialog, 'HBoxContainer').constants.separation ?? ctx.theme.separation;
}

/**
 * The row `buttons_hbox` holds: a spacer on each side of every button (`dialogs.cpp:340-348,486-495`).
 * A ConfirmationDialog's Cancel comes first, since `add_cancel_button` moves it to the front.
 */
function buttonRow(dialog: SolveNode, ctx: SolveContext): ButtonRow {
  const inputs: BoxChildInput[] = [SPACER];
  for (const role of dialogButtonRoles(dialog.node.type)) {
    const minSize = ctx.combinedMinimumSize(dialogButtonNode(dialog, role));
    inputs.push({
      minSize,
      hSizeFlags: DEFAULT_SIZE_FLAGS,
      vSizeFlags: DEFAULT_SIZE_FLAGS,
      stretchRatio: 1,
    });
    inputs.push(SPACER);
  }
  // The row's own `separation` theme item, not the dialog's `buttons_separation` (the gap above the row).
  const separation = rowSeparation(dialog, ctx);
  return {
    inputs,
    separation,
    minimum: boxContainerMinimumSize(
      false,
      separation,
      inputs.map((input) => input.minSize)
    ),
  };
}

/** The rect every authored Control takes (`dialogs.cpp:249-259`): the panel less the button row and its separation. */
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
  const panel = dialogPanelBox(dialog, ctx.theme);
  return contentRectAbove(
    panel,
    size,
    buttonRow(dialog, ctx).minimum.y,
    buttonsSeparation(dialog, ctx.theme)
  );
}

/**
 * `_update_child_rects` (`dialogs.cpp:219-260`) for a dialog of `size`: the row from the bottom edge
 * at its minimum height, the content above it less the separation.
 */
export function dialogGeometry(dialog: SolveNode, size: Vector2, ctx: SolveContext): DialogGeometry {
  const panel = dialogPanelBox(dialog, ctx.theme);
  const margins = contentMarginSize(panel);
  const row = buttonRow(dialog, ctx);

  const rowRect: Rect2 = {
    x: panel.contentMargin.left,
    y: size.y - panel.contentMargin.bottom - row.minimum.y,
    w: size.x - margins.x,
    h: row.minimum.y,
  };
  const content = contentRectAbove(panel, size, row.minimum.y, buttonsSeparation(dialog, ctx.theme));

  const rects = resortBoxContainer(
    false,
    { width: rowRect.w, height: rowRect.h },
    row.separation,
    0,
    dialog.rtl,
    row.inputs
  );
  const roles = dialogButtonRoles(dialog.node.type);
  const buttons = roles.map((role, i): DialogButton => {
    const rect = rects[BUTTON_FIRST_SLOT + BUTTON_SLOT_STRIDE * i]!;
    return {
      role,
      text: dialogButtonText(dialog, role),
      rect: { x: rowRect.x + rect.x, y: rowRect.y + rect.y, w: rect.w, h: rect.h },
    };
  });
  return { content, buttons };
}

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

/**
 * `AcceptDialog::_get_contents_minimum_size` (`dialogs.cpp:281-316`): the message and the authored
 * Controls stacked above the button row and its separation, inside the panel's margins.
 */
export const dialogContentsMinimumSize: MinimumSizeFn = (dialog, ctx) => {
  const margins = contentMarginSize(dialogPanelBox(dialog, ctx.theme));
  const separation = buttonsSeparation(dialog, ctx.theme);
  const row = buttonRow(dialog, ctx).minimum;
  const authored = largestLaidOutChildMinimum(dialog, ctx);
  const widthWithoutMessage = Math.max(row.x, authored.x);
  const message = messageMinimumSize(dialog, ctx, wrapWidth(dialog, widthWithoutMessage, margins.x));
  const content = { x: Math.max(authored.x, message.x), y: Math.max(authored.y, message.y) };
  return {
    x: Math.max(row.x, content.x) + margins.x,
    y: content.y + row.y + separation + margins.y,
  };
};

/** Every authored Control takes the content rect (`dialogs.cpp:249-259`). */
export const dialogLayout: ContainerLayoutFn = (dialog, children, rect, ctx) => {
  return everyChildFills(children, dialogContentRect(dialog, { x: rect.w, y: rect.h }, ctx));
};
