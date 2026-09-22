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
  /** `Label.clip_text` — collapses the OFF-autowrap minimum width to 1px (label.cpp:993-995). */
  clipText?: boolean;
  /** `Label.ellipsis_char`'s first character; undefined falls back to the engine default (…). */
  ellipsisChar?: string;
  /** `TextServer::JustificationFlag` bitmask. Godot default (`label.h:46`) applies when undefined — see `LABEL_DEFAULT_JUSTIFICATION_FLAGS`. */
  justificationFlags?: number;
  /** `Label.tab_stops`, px. Undefined/empty is a no-op (no tab-stop concept applied). */
  tabStopsPx?: number[];
  /** `TextServer::LineBreakFlag`'s BREAK_TRIM_* subset (masked to bits 32/64/128). Godot default (`label.h:45`) applies when undefined. */
  autowrapTrimFlags?: number;
  /** `Label.paragraph_separator`, unescaped. Godot default (`label.h:73`) applies when undefined — see `LABEL_PARAGRAPH_SEPARATOR`. */
  paragraphSeparator?: string;
  /** `Label.lines_skipped`. Godot default 0 (`label.h:77`). */
  linesSkipped?: number;
  /** `Label.max_lines_visible`. Godot default -1, "no limit" (`label.h:78`). */
  maxLinesVisible?: number;
  /** `Label.label_settings` — the raw resource-reference text, resolved at paint time in the node's own resource scope. */
  labelSettings?: string;
  /** `Label.visible_characters`, cross-derived with `visible_ratio` in FILE ORDER (label.cpp:1285-1327). Godot default -1, "show all" (`label.h:75`). */
  visibleCharacters?: number;
  /** `Label.visible_ratio`, cross-derived with `visible_characters` — see `visibleCharacters`'s own doc. Godot default 1.0 (`label.h:76`). */
  visibleRatio?: number;
  /** `TextServer::VisibleCharactersBehavior`. Godot default 0, VC_CHARS_BEFORE_SHAPING (`label.h:74`). */
  visibleCharactersBehavior?: number;
}
