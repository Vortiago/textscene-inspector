/** LineEdit property definitions. */

import type { ControlProperties } from '../control/types';

export interface LineEditProperties extends ControlProperties {
  /** The edited string. Godot default "". */
  text?: string;
  /** Shown, dimmed, whenever `text` is empty. Godot default "". */
  placeholderText?: string;
  /**
   * `HorizontalAlignment`: 0=LEFT, 1=CENTER, 2=RIGHT, 3=FILL. Godot default 0;
   * FILL shares LEFT's branch in the draw switch, so it reads as left too.
   */
  alignment?: number;
  /** Godot default true. A read-only LineEdit wears the `read_only` stylebox. */
  editable?: boolean;
  /** Replace every character with `secretCharacter`. Godot default false. */
  secret?: boolean;
  /** The character `secret` echoes. Godot default "•"; only its first char is used. */
  secretCharacter?: string;
  /** Suppress the background stylebox entirely. Godot default false. */
  flat?: boolean;
  /** Truncates `text` to this many code points; 0 (Godot default) is unlimited. */
  maxLength?: number;
  /** Grows the control's own minimum width to fit `text`. Godot default false. */
  expandToTextLength?: boolean;
  /** Shows an inline button clearing the field, drawn only while it has text. Godot default false. */
  clearButtonEnabled?: boolean;
  /** Raw `right_icon` ref (e.g. `ExtResource("id")`), or `undefined`/`"null"` for none. */
  rightIcon?: string;
  /** `LineEdit.ExpandMode`: 0 original size, 1 fit to text, 2 fit to LineEdit. Godot default 0. */
  iconExpandMode?: number;
  /** Scales `right_icon`'s FIT_TO_LINE_EDIT size. Godot default 1.0. */
  rightIconScale?: number;
  /** Draws the caret even when unfocused/not editing. Godot default false. */
  caretForceDisplayed?: boolean;
}
