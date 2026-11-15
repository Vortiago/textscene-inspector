import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { shapeText, type ShapeTextOptions, type TextLayoutResult } from './textLayout';

type TextLineOptions = Pick<
  ShapeTextOptions,
  'fontSizePx' | 'fontMetrics' | 'direction' | 'language' | 'bidiOverride'
>;

/** @canonical Shape a `TextLine`: one line, where a line break takes no room */
export function shapeTextLine(text: string, options: TextLineOptions): TextLayoutResult {
  return shapeText(text, {
    ...options,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    breakMandatory: false,
    hasEndGlyph: false,
  });
}
