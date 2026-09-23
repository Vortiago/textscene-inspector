import type { ControlProperties } from '../control/types';

export interface RichTextLabelProperties extends ControlProperties {
  /** Raw text, which may contain BBCode tags when bbcodeEnabled is true. */
  text?: string;
  /** When true, BBCode tags in `text` are interpreted rather than shown literally. */
  bbcodeEnabled?: boolean;
  /** When true, the label resizes to fit its content height. */
  fitContent?: boolean;
  /** `TextServer::AutowrapMode` (0=OFF/1=ARBITRARY/2=WORD/3=WORD_SMART). Godot's default is WORD_SMART (`rich_text_label.h:557`), unlike Label's OFF. */
  autowrapMode?: number;
  /**
   * `HorizontalAlignment` (0=Left/1=Center/2=Right/3=Fill): the
   * `default_alignment` every paragraph falls back to
   * (`rich_text_label.cpp:7241-7258`), which `[center]` or `[right]` overrides.
   * Default Left (`:580`).
   */
  horizontalAlignment?: number;
  /**
   * `VerticalAlignment` (0=Top/1=Center/2=Bottom/3=Fill): shifts the whole
   * block inside the control when the block is shorter than it
   * (`rich_text_label.cpp:1619-1652`). Default Top (`:581`).
   */
  verticalAlignment?: number;
  /** `RichTextLabel.tab_stops`, px. Undefined/empty falls back to `tabSize` (`_find_tab_stops`, `rich_text_label.cpp:479-482`). */
  tabStopsPx?: number[];
  /** `RichTextLabel.tab_size`. Godot default 4 (`rich_text_label.h:575`). Only consulted when `tabStopsPx` is empty. */
  tabSize?: number;
  /** `TextServer::LineBreakFlag`'s BREAK_TRIM_* subset. Undefined means Godot's default (`rich_text_label.h:558`, Label's pair), `shapeText`'s default. */
  autowrapTrimFlags?: number;
}
