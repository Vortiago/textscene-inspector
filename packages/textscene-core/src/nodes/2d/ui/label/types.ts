import type { ControlProperties } from '../control/types';

export interface LabelProperties extends ControlProperties {
  text?: string;
  /** Godot HorizontalAlignment: 0 left, 1 center, 2 right, 3 fill. */
  horizontalAlignment?: number;
  /** Godot VerticalAlignment: 0 top, 1 center, 2 bottom, 3 fill. */
  verticalAlignment?: number;
  /** Godot autowrap mode (0 = off). Non-zero wraps text. */
  autowrapMode?: number;
  /** When true, text renders in UPPERCASE (default false). */
  uppercase?: boolean;
  /** `TextServer::OverrunBehavior` (0-6). Godot default 0 (OVERRUN_NO_TRIMMING). */
  overrunBehavior?: number;
  /** `Label.clip_text`: drops the autowrap-off minimum width to 1px (label.cpp:993-995). */
  clipText?: boolean;
  /** `Label.ellipsis_char`'s first character; undefined falls back to the engine default (…). */
  ellipsisChar?: string;
  /** `TextServer::JustificationFlag` bitmask. Undefined means the Godot default (`label.h:46`, `LABEL_DEFAULT_JUSTIFICATION_FLAGS`). */
  justificationFlags?: number;
  /** `Label.tab_stops`, px. Undefined or empty applies no tab stops. */
  tabStopsPx?: number[];
  /** `TextServer::LineBreakFlag`'s BREAK_TRIM_* subset (masked to bits 32/64/128). Godot default (`label.h:45`) applies when undefined. */
  autowrapTrimFlags?: number;
  /** `Label.paragraph_separator`, unquoted but not `c_unescape`d. Undefined means the Godot default (`label.h:73`, `LABEL_PARAGRAPH_SEPARATOR`). */
  paragraphSeparator?: string;
  /** `Label.lines_skipped`. Godot default 0 (`label.h:77`). */
  linesSkipped?: number;
  /** `Label.max_lines_visible`. Godot default -1, "no limit" (`label.h:78`). */
  maxLinesVisible?: number;
  /** `Label.label_settings`: the raw resource reference, resolved at paint time in the node's own resource scope. */
  labelSettings?: string;
  /** `Label.visible_characters`, derived with `visible_ratio` in file order (label.cpp:1285-1327). Godot default -1, show all (`label.h:75`). */
  visibleCharacters?: number;
  /** `Label.visible_ratio`, derived with `visible_characters` in file order. Godot default 1.0 (`label.h:76`). */
  visibleRatio?: number;
  /** `TextServer::VisibleCharactersBehavior`. Godot default 0, VC_CHARS_BEFORE_SHAPING (`label.h:74`). */
  visibleCharactersBehavior?: number;
}
