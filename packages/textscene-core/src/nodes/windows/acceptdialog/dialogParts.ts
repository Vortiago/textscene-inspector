/**
 * The Controls an AcceptDialog builds in its constructor and never serialises: the message `Label`
 * and the OK and Cancel `Button`s (`scene/gui/dialogs.cpp:472-497,533`). Each is a synthetic
 * `SolveNode` carrying the dialog's scope, so the Label and Button solvers and painters measure and
 * draw them as they draw any scene node.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { TscnNode } from '../../../parser/types';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { flatStyleBox } from '../../../r3f/controls/native/styleBoxFlat';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import { parseControlCanvasItem } from '../../2d/ui/control/parser';
import type { ControlProperties } from '../../2d/ui/control/types';
import type { ButtonProperties } from '../../2d/ui/button/types';
import type { LabelProperties } from '../../2d/ui/label/types';
import type { ConfirmationDialogProperties } from '../confirmationdialog/parser';
import type { DialogProperties } from './parser';

export type DialogButtonRole = 'ok' | 'cancel';

/** The dialog's buttons, left to right as the row lays them out. Only a ConfirmationDialog has Cancel. */
export function dialogButtonRoles(dialogType: string): readonly DialogButtonRole[] {
  return descendsFromClass(dialogType, 'ConfirmationDialog') ? ['cancel', 'ok'] : ['ok'];
}

/** The dialog's panel margin and button gap before the theme scale (`default_theme.cpp:693-694`). */
const PANEL_MARGIN = 8;
const BUTTONS_SEPARATION = 10;

/** `theme_cache.panel_style`: `panel`, or the default theme's flush, square box (`default_theme.cpp:693`). */
export function dialogPanelBox(n: SolveNode, theme: NativeTheme): ResolvedStyleBox {
  const style = n.styleBoxes.panel;
  if (style) return style;
  const margin = Math.round(PANEL_MARGIN * theme.scale);
  return flatStyleBox(theme.styleFill.popup, {
    contentMargin: { left: margin, top: margin, right: margin, bottom: margin },
  });
}

/** The three `AcceptDialog` theme constants (`dialogs.cpp:422-424`). The default theme sets only the separation. */
export function dialogConstants(n: SolveNode, theme: NativeTheme) {
  return {
    buttonsSeparation: n.constants.buttons_separation ?? Math.round(BUTTONS_SEPARATION * theme.scale),
    buttonsMinWidth: n.constants.buttons_min_width ?? 0,
    buttonsMinHeight: n.constants.buttons_min_height ?? 0,
  };
}

/**
 * An internal Control as a `SolveNode` in the dialog's scope. It has no scene node, so none of the
 * dialog's own theme items (`panel`, `buttons_separation`) apply to it.
 */
function internalControl(dialog: SolveNode, type: string, name: string, properties: object): SolveNode {
  const node: TscnNode = {
    name,
    type,
    children: [],
    properties: { name, ...parseControlCanvasItem({}, name), ...properties } as ControlProperties,
    rawProperties: {},
  };
  return {
    ...dialog,
    path: `${dialog.path}/@${name}`,
    node,
    children: [],
    styleBoxes: {},
    colors: {},
    constants: {},
    icons: {},
    fontOverrides: {},
    textureSize: null,
    textureSlots: {},
    labelSettings: null,
    labelSettingsFont: null,
  };
}

/**
 * `message_label` (`dialogs.cpp:474-479`): `dialog_autowrap` picks `AUTOWRAP_WORD` (`:196-198`).
 * `asCached` gives the label the wrap its minimum size was cached with (`DialogProperties.has_unwrapped_message_minimum`).
 */
export function messageLabelNode(dialog: SolveNode, { asCached = false } = {}): SolveNode {
  const props = dialog.node.properties as DialogProperties;
  const wraps = props.dialog_autowrap && !(asCached && props.has_unwrapped_message_minimum);
  const properties: Partial<LabelProperties> = {
    text: props.dialog_text,
    autowrapMode: wraps ? AutowrapMode.AUTOWRAP_WORD : AutowrapMode.AUTOWRAP_OFF,
  };
  return internalControl(dialog, 'Label', 'MessageLabel', properties);
}

/** The label of a button: the OK text, or the Cancel text only a ConfirmationDialog carries. */
export function dialogButtonText(dialog: SolveNode, role: DialogButtonRole): string {
  const props = dialog.node.properties as DialogProperties & Partial<ConfirmationDialogProperties>;
  return (role === 'ok' ? props.ok_button_text : props.cancel_button_text) ?? '';
}

/**
 * A dialog button, floored at the theme's `buttons_min_width` and `buttons_min_height`
 * (`dialogs.cpp:239-246`). The OK button holds the dialog's focus (`dialogs.cpp:60-68`).
 */
export function dialogButtonNode(dialog: SolveNode, role: DialogButtonRole, theme: NativeTheme): SolveNode {
  const { buttonsMinWidth, buttonsMinHeight } = dialogConstants(dialog, theme);
  const properties: Partial<ButtonProperties> = {
    text: dialogButtonText(dialog, role),
    customMinimumSize: { x: buttonsMinWidth, y: buttonsMinHeight },
    hasFocus: role === 'ok',
  };
  return internalControl(dialog, 'Button', role === 'ok' ? 'OkButton' : 'CancelButton', properties);
}
