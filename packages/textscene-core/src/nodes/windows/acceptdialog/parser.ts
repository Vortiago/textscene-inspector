/**
 * The lenient parse of an AcceptDialog, and the base of a ConfirmationDialog's: the Window parse plus
 * the dialog's own text properties (`scene/gui/dialogs.cpp:398-410,508-513`).
 */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { unquoteString } from '../../../parser/utils';
import { boolOr } from '../../../parser/valueParsers';
import type { Vector2 } from '../../../godot/math/vector';
import { boolSlotValue } from '../../../godot/variant/variantBool';
import { constructorWritesSize, windowClassDefaults } from '../../../godot/scene/window';
import { viewportParseContext } from '../../viewport/shared/parser';
import { parseWindow } from '../window/parser';
import type { WindowProperties } from '../window/types';

/** `default_ok_text` (`dialogs.cpp:491`): what an empty `ok_button_text` shows. */
const DEFAULT_OK_TEXT = 'OK';

export interface DialogProperties extends WindowProperties {
  /** The message `message_label` shows. */
  dialog_text: string;
  /** The OK button's label: `ok_button_text`, or "OK" when empty. */
  ok_button_text: string;
  /** `AUTOWRAP_WORD` on the message when true, `AUTOWRAP_OFF` otherwise (`dialogs.cpp:196-198`). */
  dialog_autowrap: boolean;
  /**
   * Whether the label's cached minimum size is the unwrapped one when the window wraps its Controls.
   * Outside the tree a Control never invalidates that cache (`Control::update_minimum_size`), and
   * `dialog_text` read after `visible = true` caches it while `dialog_autowrap` is still off, unless
   * a size line that changes a size, `dialog_autowrap` or the class's constructor came first.
   */
  has_unwrapped_message_minimum: boolean;
  /**
   * The texts the internal Controls held when they first computed their minimums, which a size
   * write while `wrap_controls` is on reads at load. Null when no size write clamped the dialog.
   */
  controls_at_load: DialogControlsAtLoad | null;
  /**
   * The OK button is disabled. Not a scene property: only a dialog that decides it from a state a scene
   * lacks sets it, as FileDialog does (`_is_open_should_be_disabled`, `file_dialog.cpp:549-566`).
   */
  ok_button_disabled?: boolean;
}

/**
 * The texts of the internal Controls. Outside the tree a Control keeps the first minimum it
 * computes (`Control::update_minimum_size`), so a later text line does not change it.
 */
export interface DialogControlsAtLoad {
  dialog_text: string;
  ok_button_text: string;
  dialog_autowrap: boolean;
}

/**
 * The lines that compute the label's minimum before `dialog_text` caches it: `dialog_autowrap`, and
 * each size line, which asks the window for its contents minimum (`window.cpp:477-515,1764`).
 */
const LINES_THAT_CACHE_THE_MINIMUM_EARLY: ReadonlySet<string> = new Set([
  'dialog_autowrap',
  'size',
  'min_size',
  'max_size',
]);

function isZero({ x, y }: Vector2): boolean {
  return x === 0 && y === 0;
}

/**
 * Whether the line `key` computes the minimum. A `min_size` or `max_size` line that leaves the
 * value at its default of zero asks for nothing: each setter returns first (`window.cpp:486-488,509-511`).
 */
function cachesTheMinimumEarly(
  key: string,
  limits: Pick<WindowProperties, 'min_size' | 'max_size'>
): boolean {
  if (key === 'min_size') return !isZero(limits.min_size);
  if (key === 'max_size') return !isZero(limits.max_size);
  return LINES_THAT_CACHE_THE_MINIMUM_EARLY.has(key);
}

/** Whether `dialog_text` is the first line after `visible = true` that settles the label's cached minimum. */
function readsTextUnwrappedWhileVisible(
  type: string,
  properties: Record<string, string>,
  limits: Pick<WindowProperties, 'min_size' | 'max_size'>
): boolean {
  if (constructorWritesSize(type)) return false;
  if (properties.visible === undefined || !boolOr(properties.visible, false)) return false;
  const keys = Object.keys(properties);
  const textAt = keys.indexOf('dialog_text');
  if (textAt < keys.indexOf('visible')) return false;
  return !keys.slice(0, textAt).some((key) => cachesTheMinimumEarly(key, limits));
}

/** A quoted text property, or `fallback` when the scene line is absent. An empty string stays empty. */
export function textOr(raw: string | undefined, fallback: string): string {
  return raw === undefined ? fallback : unquoteString(raw);
}

/** `_update_ok_text` (`dialogs.cpp:262-275`): an empty OK text shows the default. */
function okTextOr(raw: string | undefined, fallback: string): string {
  const text = textOr(raw, fallback);
  return text === '' ? DEFAULT_OK_TEXT : text;
}

/**
 * The number of lines up to the first `dialog_text` line that changes the text of a visible dialog.
 * That line lays the Controls out with its text, so it computes their minimums (`dialogs.cpp:168-179`).
 * Infinity for none.
 */
function linesThroughVisibleText(type: string, lines: Record<string, string>): number {
  let visible = windowClassDefaults(type).visible;
  let text = '';
  for (const [line, [key, raw]] of Object.entries(lines).entries()) {
    if (key === 'visible') visible = boolSlotValue(raw) ?? visible;
    if (key !== 'dialog_text') continue;
    const next = textOr(raw, text);
    if (next !== text && visible) return line + 1;
    text = next;
  }
  return Number.POSITIVE_INFINITY;
}

const CONSTRUCTED_CONTROLS: DialogControlsAtLoad = {
  dialog_text: '',
  ok_button_text: DEFAULT_OK_TEXT,
  dialog_autowrap: false,
};

/**
 * What the internal Controls held when they first computed their minimums: the lines before the first
 * clamping size write, or before an earlier visible text line, over what the Controls held. An
 * instanced base's cache stands, since its Controls keep it. Null when no size write clamped the dialog.
 */
function controlsAtLoad(
  type: string,
  properties: Record<string, string>,
  { lines_before_load_clamp }: WindowProperties,
  override: OverrideLayer<DialogProperties> | undefined
): DialogControlsAtLoad | null {
  if (override?.held.controls_at_load) return override.held.controls_at_load;
  if (lines_before_load_clamp === null) return null;
  const lines = override?.written ?? properties;
  const held = override?.held ?? CONSTRUCTED_CONTROLS;
  const count = Math.min(lines_before_load_clamp, linesThroughVisibleText(type, lines));
  const before = Object.fromEntries(Object.entries(lines).slice(0, count));
  return {
    dialog_text: textOr(before.dialog_text, held.dialog_text),
    ok_button_text: okTextOr(before.ok_button_text, held.ok_button_text),
    dialog_autowrap: boolOr(before.dialog_autowrap, held.dialog_autowrap),
  };
}

export function parseDialog(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<DialogProperties>
): DialogProperties {
  const type = heading.attributes.type ?? '';
  const windowProperties = parseWindow(heading, properties, override);
  return {
    ...windowProperties,
    dialog_text: textOr(properties.dialog_text, ''),
    ok_button_text: okTextOr(properties.ok_button_text, ''),
    dialog_autowrap: boolOr(
      properties.dialog_autowrap,
      false,
      `${viewportParseContext(heading, windowProperties.name)}.dialog_autowrap`
    ),
    has_unwrapped_message_minimum: readsTextUnwrappedWhileVisible(type, properties, windowProperties),
    controls_at_load: controlsAtLoad(type, properties, windowProperties, override),
  };
}
