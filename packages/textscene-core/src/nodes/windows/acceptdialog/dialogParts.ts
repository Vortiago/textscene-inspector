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

import { scaledPx } from '../../../godot/scene/theme';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { TscnNode } from '../../../parser/types';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { internalChildThemeItems } from '../../../r3f/controls/native/themeItems';
import { perObject } from '../../../utils/perObject';
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

/** The button gap before the theme scale (`default_theme.cpp:694`). */
const BUTTONS_SEPARATION = 10;

/** `theme_cache.panel_style`: `panel`, or the default theme's flush, square box (`default_theme.cpp:693`). */
export function dialogPanelBox(n: SolveNode, theme: NativeTheme): ResolvedStyleBox {
  return n.styleBoxes.panel ?? theme.widgets.dialogPanel;
}

/** `buttons_separation` (`dialogs.cpp:422`): the gap between the content and the button row. The default theme sets it to 10. */
export function buttonsSeparation(n: SolveNode, theme: NativeTheme): number {
  return n.constants.buttons_separation ?? scaledPx(BUTTONS_SEPARATION, theme.scale);
}

/** Written only by `internalControl`. A dialog node is replaced when the scene changes it, so each internal Control is built once per dialog node. */
const internalNodes = perObject((_dialog: SolveNode) => new Map<string, SolveNode>());

/**
 * The Controls a dialog class's constructor builds above its message and buttons, as one tree whose root fills
 * the content rect. A class registers one, so the dialog solver and painter stay free of its types.
 */
export type DialogBody = (dialog: SolveNode, theme: NativeTheme) => SolveNode;

/** Written only by `registerDialogBody`, at module load. */
const dialogBodies = new Map<string, DialogBody>();

export function registerDialogBody(typeName: string, body: DialogBody): void {
  dialogBodies.set(typeName, body);
}

/** The body `dialog`'s class builds, or `null` for a class that builds none. */
export function dialogBodyOf(dialog: SolveNode, theme: NativeTheme): SolveNode | null {
  return dialogBodies.get(dialog.node.type)?.(dialog, theme) ?? null;
}

/** What a dialog's constructor `memnew`s: a Control the scene never serialises. */
export interface SyntheticControl {
  type: string;
  name: string;
  /** Where it sits in the dialog's tree: the path of its parent, which a container lays its children out by. The dialog's own by default. */
  parentPath?: string;
  /** The Control's parsed properties, defaults included. */
  properties: object;
  children?: readonly SolveNode[];
  /** The `theme_type_variation` its constructor sets. */
  variation?: string;
  /** Theme items the default theme gives the variation. Any item the dialog's theme chain sets wins over them. */
  variationDefaults?: Partial<Pick<SolveNode, 'styleBoxes' | 'colors' | 'constants'>>;
  /** Icons its dialog's theme gives it, by name. Any the dialog's theme chain gives its type override them. */
  icons?: SolveNode['icons'];
  textureSize?: SolveNode['textureSize'];
  /** What it draws that a scene line cannot carry. */
  syntheticDraw?: SolveNode['syntheticDraw'];
}

/**
 * A Control `memnew`d inside `dialog` as a `SolveNode` in the dialog's scope. It has no scene node, so
 * none of the dialog's own theme items (`panel`, `buttons_separation`) apply to it. Its own come through
 * the dialog's theme chain, under the default theme's items for its variation.
 */
export function syntheticControl(dialog: SolveNode, spec: SyntheticControl): SolveNode {
  const { type, name, variation } = spec;
  const node: TscnNode = {
    name,
    type,
    children: [],
    properties: spec.properties as ControlProperties,
    rawProperties: {},
  };
  const items = internalChildThemeItems(dialog, type, variation);
  const defaults = spec.variationDefaults ?? {};
  return {
    ...dialog,
    path: `${spec.parentPath ?? dialog.path}/@${name}`,
    node,
    children: spec.children ?? [],
    styleBoxes: { ...defaults.styleBoxes, ...items.styleBoxes },
    colors: { ...defaults.colors, ...items.colors },
    constants: { ...defaults.constants, ...items.constants },
    icons: { ...spec.icons, ...items.icons },
    fontOverrides: {},
    textureSize: spec.textureSize ?? null,
    syntheticDraw: spec.syntheticDraw,
    textureSlots: {},
    labelSettings: null,
    labelSettingsFont: null,
  };
}

/** The Control for `name`, built once per dialog node. */
function internalControl(
  dialog: SolveNode,
  type: string,
  name: string,
  makeProperties: () => object
): SolveNode {
  const byName = internalNodes(dialog);
  const built = byName.get(name);
  if (built) return built;
  const properties = { name, ...parseControlCanvasItem({}, name), ...makeProperties() };
  const control = syntheticControl(dialog, { type, name, properties });
  byName.set(name, control);
  return control;
}

/** `message_label` (`dialogs.cpp:474-479`): `dialog_autowrap` picks `AUTOWRAP_WORD` (`:196-198`). */
export function messageLabelNode(dialog: SolveNode): SolveNode {
  const props = dialog.node.properties as DialogProperties;
  return messageLabel(dialog, props.dialog_autowrap);
}

/**
 * The message label with the wrap its minimum size was cached with
 * (`DialogProperties.has_unwrapped_message_minimum`).
 */
export function cachedMessageLabelNode(dialog: SolveNode): SolveNode {
  const props = dialog.node.properties as DialogProperties;
  return messageLabel(dialog, props.dialog_autowrap && !props.has_unwrapped_message_minimum);
}

/** One cached Label per wrap setting: the name carries `wraps`, which is the only thing the two differ by. */
function messageLabel(dialog: SolveNode, wraps: boolean): SolveNode {
  const properties = (): Partial<LabelProperties> => ({
    text: (dialog.node.properties as DialogProperties).dialog_text,
    autowrapMode: wraps ? AutowrapMode.AUTOWRAP_WORD : AutowrapMode.AUTOWRAP_OFF,
  });
  return internalControl(dialog, 'Label', wraps ? 'WrappingMessageLabel' : 'MessageLabel', properties);
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
export function dialogButtonNode(dialog: SolveNode, role: DialogButtonRole): SolveNode {
  const buttonsMinWidth = dialog.constants.buttons_min_width ?? 0;
  const buttonsMinHeight = dialog.constants.buttons_min_height ?? 0;
  const properties = (): Partial<ButtonProperties> => ({
    text: dialogButtonText(dialog, role),
    customMinimumSize: { x: buttonsMinWidth, y: buttonsMinHeight },
    hasFocus: role === 'ok',
    disabled: role === 'ok' && (dialog.node.properties as DialogProperties).ok_button_disabled === true,
  });
  return internalControl(dialog, 'Button', role === 'ok' ? 'OkButton' : 'CancelButton', properties);
}
