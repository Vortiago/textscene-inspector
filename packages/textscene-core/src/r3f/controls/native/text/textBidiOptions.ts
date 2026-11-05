/**
 * The `shapeText` options a text node's direction, language and structured override give: what each
 * type hands the text server before it shapes (`label.cpp:139,178-195`, `button.cpp:564-569`,
 * `label_3d.cpp:479-494`). The solver's shapes and the painter's read this, so they shape the same lines.
 */
import type { ShapeTextOptions } from './textLayout';
import { StructuredTextParser, TextDirection } from '../../../../godot/text/textServerEnums';
import { parseStructuredText } from '../../../../godot/text/structuredText';
import type {
  StructuredTextOverrideProperties,
  TextDirectionProperties,
} from '../../../../godot/text/paragraphDirection';

export type TextBidiOptions = Pick<ShapeTextOptions, 'direction' | 'language' | 'bidiOverride'>;

/** A type without the structured override shapes with none, as Button and MenuBar do. */
export type BidiProperties = TextDirectionProperties & Partial<StructuredTextOverrideProperties>;

/** The layout direction and the locale a Control resolves (`SolveNode.rtl`, `SolveNode.locale`). */
export interface ControlTextEnv {
  rtl: boolean;
  locale: string;
}

/**
 * For a node with no layout direction, Label3D and TextMesh: the direction goes through as it is, so
 * the text server reads INHERITED as AUTO (`text_server_adv.cpp:7240-7241`). An empty `language`
 * takes `locale`.
 */
export function textBidiOptions(props: BidiProperties, locale: string): TextBidiOptions {
  const {
    textDirection,
    language,
    structuredTextBidiOverride,
    structuredTextBidiOverrideOptions = [],
  } = props;
  return {
    direction: textDirection,
    language: language || locale,
    // DEFAULT's one INHERITED range over the whole paragraph is what no override shapes.
    bidiOverride:
      structuredTextBidiOverride === undefined ||
      structuredTextBidiOverride === StructuredTextParser.STRUCTURED_TEXT_DEFAULT
        ? undefined
        : (paragraph) =>
            parseStructuredText(structuredTextBidiOverride, structuredTextBidiOverrideOptions, paragraph),
  };
}

/** For a Control: INHERITED takes the layout direction (`label.cpp:178-181`, `button.cpp:564-568`). */
export function controlBidiOptions(props: BidiProperties, env: ControlTextEnv): TextBidiOptions {
  const isInherited = props.textDirection === TextDirection.TEXT_DIRECTION_INHERITED;
  const layoutDirection = env.rtl ? TextDirection.TEXT_DIRECTION_RTL : TextDirection.TEXT_DIRECTION_LTR;
  return textBidiOptions(
    { ...props, textDirection: isInherited ? layoutDirection : props.textDirection },
    env.locale
  );
}

/**
 * Whether `shaped_text_draw` draws a `TextParagraph` control's line right to left: it reads the set
 * direction (`shaped_text_get_direction`), so an AUTO line that infers RTL draws as LTR.
 */
export function isDrawnRtl(options: TextBidiOptions): boolean {
  return options.direction === TextDirection.TEXT_DIRECTION_RTL;
}
