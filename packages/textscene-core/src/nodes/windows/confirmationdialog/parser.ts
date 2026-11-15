/** The lenient parse of a ConfirmationDialog: the AcceptDialog parse plus its Cancel button's text. */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { parseDialog, textOr, type DialogProperties } from '../acceptdialog/parser';

/** `add_cancel_button`'s default (`dialogs.cpp:368-370`). Unlike the OK text, an empty one stays empty. */
const DEFAULT_CANCEL_TEXT = 'Cancel';

export interface ConfirmationDialogProperties extends DialogProperties {
  /** The Cancel button's label. */
  cancel_button_text: string;
}

export function parseConfirmationDialog(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<ConfirmationDialogProperties>
): ConfirmationDialogProperties {
  return {
    ...parseDialog(heading, properties, override),
    cancel_button_text: textOr(properties.cancel_button_text, DEFAULT_CANCEL_TEXT),
  };
}
