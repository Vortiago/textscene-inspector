import type { ControlProperties } from '../control/types';

export interface RichTextLabelProperties extends ControlProperties {
  /** Raw text, which may contain BBCode tags when bbcodeEnabled is true. */
  text?: string;
  /** When true, BBCode tags in `text` are interpreted rather than shown literally. */
  bbcodeEnabled?: boolean;
  /** When true, the label resizes to fit its content height. */
  fitContent?: boolean;
}
