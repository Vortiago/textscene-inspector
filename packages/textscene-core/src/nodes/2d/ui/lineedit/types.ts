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
}
