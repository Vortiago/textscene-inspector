/**
 * The lenient parse of an AcceptDialog, and the base of a ConfirmationDialog's: the Window parse plus
 * the dialog's own text properties (`scene/gui/dialogs.cpp:398-410,508-513`).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { unquoteString } from '../../../parser/utils';
import { boolOr } from '../../../parser/valueParsers';
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
   * a size line or `dialog_autowrap` came first.
   */
  has_unwrapped_message_minimum: boolean;
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

/** Whether `dialog_text` is the first line after `visible = true` that settles the label's cached minimum. */
function readsTextUnwrappedWhileVisible(properties: Record<string, string>): boolean {
  if (properties.visible === undefined || !boolOr(properties.visible, false)) return false;
  const keys = Object.keys(properties);
  const textAt = keys.indexOf('dialog_text');
  if (textAt < keys.indexOf('visible')) return false;
  return !keys.slice(0, textAt).some((key) => LINES_THAT_CACHE_THE_MINIMUM_EARLY.has(key));
}

/** A quoted text property, or `fallback` when the scene line is absent. An empty string stays empty. */
export function textOr(raw: string | undefined, fallback: string): string {
  return raw === undefined ? fallback : unquoteString(raw);
}

export function parseDialog(heading: ParsedHeading, properties: Record<string, string>): DialogProperties {
  const okText = textOr(properties.ok_button_text, '');
  const windowProperties = parseWindow(heading, properties);
  return {
    ...windowProperties,
    dialog_text: textOr(properties.dialog_text, ''),
    ok_button_text: okText === '' ? DEFAULT_OK_TEXT : okText,
    dialog_autowrap: boolOr(
      properties.dialog_autowrap,
      false,
      `${viewportParseContext(heading, windowProperties.name)}.dialog_autowrap`
    ),
    has_unwrapped_message_minimum: readsTextUnwrappedWhileVisible(properties),
  };
}
