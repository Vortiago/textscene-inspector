/**
 * The Controls an AcceptDialog builds in its constructor and never serialises
 * (`scene/gui/dialogs.cpp:468-497`): the message `Label`, the class's body, and the button row
 * `buttons_hbox` with its spacers and Buttons. They are internal Controls (`internalControls.ts`),
 * so the Label, HBoxContainer and Button solvers and painters lay them out and draw them.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { SizeFlags } from '../../../godot/scene/control';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { TextureSlotsFn } from '../../../r3f/controls/native/solverRegistry';
import {
  builtButtonIconRequests,
  internalControlNode,
  internalControlsOf,
  type InternalControl,
  type InternalControlEntry,
  type InternalControlSpec,
  type InternalControlsFn,
} from '../../../r3f/controls/native/internalControls';
import { requiredThemeItem } from '../../../r3f/controls/native/themeItems';
import { perObject } from '../../../utils/perObject';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import { parseControlCanvasItem } from '../../2d/ui/control/parser';
import type { ButtonProperties } from '../../2d/ui/button/types';
import type { LabelProperties } from '../../2d/ui/label/types';
import type { ConfirmationDialogProperties } from '../confirmationdialog/parser';
import type { DialogProperties } from './parser';

export type DialogButtonRole = 'ok' | 'cancel';

/** The dialog's buttons, left to right as the row lays them out. Only a ConfirmationDialog has Cancel. */
export function dialogButtonRoles(dialogType: string): readonly DialogButtonRole[] {
  return descendsFromClass(dialogType, 'ConfirmationDialog') ? ['cancel', 'ok'] : ['ok'];
}

/** `theme_cache.panel_style` (`dialogs.cpp:442`). */
export function dialogPanelBox(n: SolveNode): ResolvedStyleBox {
  return requiredThemeItem(n.styleBoxes, 'panel');
}

/** `buttons_separation`: the gap between the content and the button row (`dialogs.cpp:246,307`). */
export function buttonsSeparation(n: SolveNode): number {
  return requiredThemeItem(n.constants, 'buttons_separation');
}

/**
 * The Controls a dialog class's constructor builds above its message and buttons, as one tree whose
 * root fills the content rect. A class registers one, so the dialog solver and painter stay free of its types.
 */
export type DialogBody = (dialog: SolveNode, theme: NativeTheme) => InternalControlSpec;

/** Written only by `registerDialogBody`, at module load. */
const dialogBodies = new Map<string, DialogBody>();

export function registerDialogBody(typeName: string, body: DialogBody): void {
  dialogBodies.set(typeName, body);
}

/** The slots a dialog needs for its own OK and Cancel buttons: both are plain Buttons (`dialogs.cpp:339-340,489`). */
export const dialogTextureSlots: TextureSlotsFn = (_node, _themedIcons, builtIcons) =>
  builtButtonIconRequests(['Button'], builtIcons);

/** The name of `buttons_hbox`. */
const BUTTON_ROW = 'ButtonsHBox';

/** The two message labels differ only in their wrap, so each carries it in its name, and so in its path. */
const MESSAGE_LABELS = { wrapping: 'WrappingMessageLabel', unwrapped: 'MessageLabel' } as const;

function isMessageLabel(n: SolveNode): boolean {
  return n.node.name === MESSAGE_LABELS.wrapping || n.node.name === MESSAGE_LABELS.unwrapped;
}

/** The properties a Control named `name` parses to with no scene line, then `own`. */
function builtProperties(name: string, own: object): object {
  return { name, ...parseControlCanvasItem({}, name), ...own };
}

/** `message_label` (`dialogs.cpp:480-484`). `dialog_autowrap` picks `AUTOWRAP_WORD` (`:196-198`). */
function messageLabelSpec(dialog: SolveNode, wraps: boolean): InternalControlSpec {
  const name = wraps ? MESSAGE_LABELS.wrapping : MESSAGE_LABELS.unwrapped;
  const properties: Partial<LabelProperties> = {
    text: (dialog.node.properties as DialogProperties).dialog_text,
    autowrapMode: wraps ? AutowrapMode.AUTOWRAP_WORD : AutowrapMode.AUTOWRAP_OFF,
  };
  return { type: 'Label', name, properties: builtProperties(name, properties) };
}

/** Written only by `cachedMessageLabelNode`. A dialog node is replaced when the scene changes it. */
const cachedMessageLabels = perObject((dialog: SolveNode) => {
  const props = dialog.node.properties as DialogProperties;
  const wraps = props.dialog_autowrap && !props.has_unwrapped_message_minimum;
  return internalControlNode(dialog, messageLabelSpec(dialog, wraps));
});

/**
 * The message label with the wrap its minimum size was cached with
 * (`DialogProperties.has_unwrapped_message_minimum`).
 */
export function cachedMessageLabelNode(dialog: SolveNode): SolveNode {
  return cachedMessageLabels(dialog);
}

/** The name a button of `role` carries in the row, and so in its path. */
export function dialogButtonName(role: DialogButtonRole): string {
  return role === 'ok' ? 'OkButton' : 'CancelButton';
}

/** The label of a button: the OK text, or the Cancel text only a ConfirmationDialog carries. */
function dialogButtonText(dialog: SolveNode, role: DialogButtonRole): string {
  const props = dialog.node.properties as DialogProperties & Partial<ConfirmationDialogProperties>;
  return (role === 'ok' ? props.ok_button_text : props.cancel_button_text) ?? '';
}

/**
 * A dialog button, floored at the theme's `buttons_min_width` and `buttons_min_height`
 * (`dialogs.cpp:228-235`). The OK button holds the dialog's focus (`dialogs.cpp:60-68`).
 */
function dialogButtonSpec(dialog: SolveNode, role: DialogButtonRole): InternalControlSpec {
  const name = dialogButtonName(role);
  const properties: Partial<ButtonProperties> = {
    text: dialogButtonText(dialog, role),
    customMinimumSize: {
      x: dialog.constants.buttons_min_width ?? 0,
      y: dialog.constants.buttons_min_height ?? 0,
    },
    hasFocus: role === 'ok',
    disabled: role === 'ok' && (dialog.node.properties as DialogProperties).ok_button_disabled === true,
  };
  return { type: 'Button', name, properties: builtProperties(name, properties) };
}

/** `BoxContainer::add_spacer` (`box_container.cpp:322-336`): a plain Control that takes the width the buttons leave. */
function spacerSpec(index: number): InternalControlSpec {
  const name = `Spacer${index}`;
  const properties = { sizeFlagsHorizontal: SizeFlags.EXPAND | SizeFlags.FILL };
  return { type: 'Control', name, properties: builtProperties(name, properties) };
}

/**
 * `buttons_hbox` (`dialogs.cpp:478,486-493`): a spacer on each side of every button. A
 * ConfirmationDialog's Cancel comes first, since `add_button` with `right` false moves it to the
 * front with a spacer before it (`:337-352`).
 */
function buttonRowSpec(dialog: SolveNode): InternalControlSpec {
  const children = [spacerSpec(0)];
  dialogButtonRoles(dialog.node.type).forEach((role, index) => {
    children.push(dialogButtonSpec(dialog, role), spacerSpec(index + 1));
  });
  return { type: 'HBoxContainer', name: BUTTON_ROW, properties: builtProperties(BUTTON_ROW, {}), children };
}

/**
 * What `AcceptDialog::AcceptDialog` adds, in order (`dialogs.cpp:475-493`): the message label and
 * the class's body under every authored Control, then the button row over them. `bg_panel` is the
 * dialog painter's own box.
 */
export const dialogInternalControls: InternalControlsFn = (dialog, theme) => {
  const props = dialog.node.properties as DialogProperties;
  const body = dialogBodies.get(dialog.node.type)?.(dialog, theme);
  const entries: InternalControlEntry[] = [
    { mode: 'front', spec: messageLabelSpec(dialog, props.dialog_autowrap) },
  ];
  if (body) entries.push({ mode: 'front', spec: body });
  entries.push({ mode: 'back', spec: buttonRowSpec(dialog) });
  return entries;
};

/** The button row, the one internal Control a dialog builds in back mode. */
export function buttonRowNode(dialog: SolveNode, theme: NativeTheme): SolveNode {
  return internalControlsOf(dialog, theme).find(({ mode }) => mode === 'back')!.node;
}

/** Whether an internal Control takes the content rect (`dialogs.cpp:248-259`): all but the button row, built in back mode, do. */
export function takesContentRect({ mode }: InternalControl): boolean {
  return mode === 'front';
}

/** The internal Controls whose minimum the contents minimum reads as it reads an authored one's: all but the row and the message. */
export function dialogBodyNodes(dialog: SolveNode, theme: NativeTheme): readonly SolveNode[] {
  return internalControlsOf(dialog, theme)
    .filter((internal) => takesContentRect(internal) && !isMessageLabel(internal.node))
    .map(({ node }) => node);
}
