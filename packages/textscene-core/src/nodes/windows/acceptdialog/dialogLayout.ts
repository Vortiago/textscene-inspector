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
import { isLaidOutChild, type SolveNode } from '../../../r3f/controls/native/solveTree';
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { boxContainerMinimumSize, resortBoxContainer } from '../../2d/ui/shared/boxContainerSolver';
import type { BoxChildInput } from '../../2d/ui/shared/boxContainerSolver';
import { labelMinimumSize } from '../../2d/ui/label/nativeSolver';
import { windowContentScale } from '../window/contentScale';
import type { WindowProperties } from '../window/types';
import {
  dialogButtonNode,
  dialogButtonText,
  dialogButtonRoles,
  dialogConstants,
  dialogPanelBox,
  messageLabelNode,
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

interface ButtonRow {
  /** The row's children, spacers included. */
  inputs: BoxChildInput[];
  /** The index in `inputs` of each button, in `roles` order. */
  buttonSlots: number[];
  minimum: Vector2;
}

/**
 * The row `buttons_hbox` holds: a spacer on each side of every button (`dialogs.cpp:340-348,486-495`).
 * A ConfirmationDialog's Cancel comes first, since `add_cancel_button` moves it to the front.
 */
function buttonRow(dialog: SolveNode, ctx: SolveContext): ButtonRow {
  const inputs: BoxChildInput[] = [SPACER];
  const buttonSlots: number[] = [];
  for (const role of dialogButtonRoles(dialog.node.type)) {
    const minSize = ctx.combinedMinimumSize(dialogButtonNode(dialog, role, ctx.theme));
    buttonSlots.push(inputs.length);
    inputs.push({
      minSize,
      hSizeFlags: DEFAULT_SIZE_FLAGS,
      vSizeFlags: DEFAULT_SIZE_FLAGS,
      stretchRatio: 1,
    });
    inputs.push(SPACER);
  }
  return {
    inputs,
    buttonSlots,
    // The row's own `separation` theme item, not the dialog's `buttons_separation` (the gap above the row).
    minimum: boxContainerMinimumSize(
      false,
      ctx.theme.separation,
      inputs.map((input) => input.minSize)
    ),
  };
}

/**
 * `_update_child_rects` (`dialogs.cpp:219-260`) for a dialog of `size`: the row from the bottom edge
 * at its minimum height, the content above it less the separation.
 */
export function dialogGeometry(dialog: SolveNode, size: Vector2, ctx: SolveContext): DialogGeometry {
  const panel = dialogPanelBox(dialog, ctx.theme);
  const margins = contentMarginSize(panel);
  const { buttonsSeparation } = dialogConstants(dialog, ctx.theme);
  const row = buttonRow(dialog, ctx);

  const rowRect: Rect2 = {
    x: panel.contentMargin.left,
    y: size.y - panel.contentMargin.bottom - row.minimum.y,
    w: size.x - margins.x,
    h: row.minimum.y,
  };
  const content: Rect2 = {
    x: panel.contentMargin.left,
    y: panel.contentMargin.top,
    w: size.x - margins.x,
    h: size.y - margins.y - row.minimum.y - buttonsSeparation,
  };

  const rects = resortBoxContainer(
    false,
    { width: rowRect.w, height: rowRect.h },
    ctx.theme.separation,
    0,
    dialog.rtl,
    row.inputs
  );
  const roles = dialogButtonRoles(dialog.node.type);
  const buttons = roles.map((role, i): DialogButton => {
    const rect = rects[row.buttonSlots[i]!]!;
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
  const label = messageLabelNode(dialog, { asCached: true });
  return labelMinimumSize(label, {
    ...ctx,
    tentativeRect: (n) => (n === label ? { x: 0, y: 0, w: width, h: 0 } : undefined),
  });
}

/** The largest combined minimum of the authored Controls the dialog places (`dialogs.cpp:281-300`). */
function authoredMinimumSize(dialog: SolveNode, ctx: SolveContext): Vector2 {
  let x = 0;
  let y = 0;
  for (const child of dialog.children) {
    if (!isLaidOutChild(dialog, child)) continue;
    const childMin = ctx.combinedMinimumSize(child);
    x = Math.max(x, childMin.x);
    y = Math.max(y, childMin.y);
  }
  return { x, y };
}

/**
 * `AcceptDialog::_get_contents_minimum_size` (`dialogs.cpp:281-316`): the message and the authored
 * Controls stacked above the button row and its separation, inside the panel's margins.
 */
export const dialogContentsMinimumSize: MinimumSizeFn = (dialog, ctx) => {
  const margins = contentMarginSize(dialogPanelBox(dialog, ctx.theme));
  const { buttonsSeparation } = dialogConstants(dialog, ctx.theme);
  const row = buttonRow(dialog, ctx).minimum;
  const authored = authoredMinimumSize(dialog, ctx);
  const widthWithoutMessage = Math.max(row.x, authored.x);
  const message = messageMinimumSize(dialog, ctx, wrapWidth(dialog, widthWithoutMessage, margins.x));
  const content = { x: Math.max(authored.x, message.x), y: Math.max(authored.y, message.y) };
  return {
    x: Math.max(row.x, content.x) + margins.x,
    y: content.y + row.y + buttonsSeparation + margins.y,
  };
};

/** Every authored Control takes the content rect (`dialogs.cpp:249-259`). */
export const dialogLayout: ContainerLayoutFn = (dialog, children, rect, ctx) => {
  const { content } = dialogGeometry(dialog, { x: rect.w, y: rect.h }, ctx);
  return new Map(children.map(({ node }) => [node.path, content]));
};
