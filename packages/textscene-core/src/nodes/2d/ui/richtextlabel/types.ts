import type { ControlProperties } from '../control/types';
import type {
  StructuredTextOverrideProperties,
  TextDirectionProperties,
} from '../../../../godot/text/paragraphDirection';

/** The `text_direction`, `language` and override are the defaults a `[p]` tag overrides per paragraph. */
export interface RichTextLabelProperties
  extends ControlProperties, TextDirectionProperties, StructuredTextOverrideProperties {
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
  /** `TextServer::JustificationFlag` bit mask, stored as authored (`rich_text_label.cpp:7276-7289`). Default 163 (`rich_text_label.h:582`). */
  justificationFlags: number;
  /** While true, the control's own rect clips its drawing. RichTextLabel's constructor sets it (`rich_text_label.cpp:8225`), unlike Control. */
  clipContents: boolean;
  /** While true, text taller than the rect shows the vertical scrollbar and wraps beside it (`rich_text_label.h:565`). */
  scrollActive: boolean;
  /** While true, text taller than the rect shows its foot: the scroll value follows the text height (`rich_text_label.h:561`). */
  scrollFollowing: boolean;
  /** `visible_characters`, derived with `visible_ratio` in file order (`rich_text_label.cpp:7401-7430,7892-7948`). Godot's default is -1, every character (`rich_text_label.h:553`). Unset means the default. */
  visibleCharacters?: number;
  /** `visible_ratio`, derived with `visible_characters`. It budgets the glyph behaviours (`rich_text_label.cpp:947`). Default 1. */
  visibleRatio?: number;
  /** Set when `visible_ratio` was written last, so the render derives `visible_characters` from the characters it draws: an `[img]` counts only once its texture loads (`rich_text_label.cpp:4210`). */
  visibleRatioDrives?: true;
  /** `TextServer::VisibleCharactersBehavior`. Unset means VC_CHARS_BEFORE_SHAPING, Godot's default (`rich_text_label.h:554`). */
  visibleCharactersBehavior?: number;
  /** While true, `scroll_active` keeps the bar showing and the text scrolled to `_update_follow_vc`'s position (`rich_text_label.cpp:2659-2667,5209-5221`). */
  scrollFollowingVisibleCharacters: boolean;
}
