import type { ControlProperties } from '../control/types';

/** `TitlePosition` (`foldable_container.h:41-45`). */
export const TITLE_POSITION_TOP = 0;
export const TITLE_POSITION_BOTTOM = 1;

export interface FoldableContainerProperties extends ControlProperties {
  /** Hides the content and shrinks to the title bar alone when true. Default false. */
  folded?: boolean;
  /** The title bar's text. Default ''. */
  title?: string;
  /** HorizontalAlignment 0=left/1=center/2=right. Godot default 0 (LEFT). */
  titleAlignment?: number;
  /** `TitlePosition` 0=top/1=bottom. Godot default 0 (TOP). */
  titlePosition?: number;
  /**
   * `TextServer.OverrunBehavior`. `get_minimum_size` adds the title's own
   * text width only under `OVERRUN_NO_TRIMMING` (`foldable_container.cpp:455`);
   * any other value floors the title bar to the arrow alone, and the painter
   * trims the drawn text to that same space (`foldable_container.cpp:307-313`).
   */
  titleTextOverrunBehavior?: number;
}
