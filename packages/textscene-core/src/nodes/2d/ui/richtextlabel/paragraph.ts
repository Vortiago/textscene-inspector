/**
 * What a RichTextLabel line reads from the paragraph tags open on it: `_find_alignment`,
 * `_find_direction`, `_find_stt` and `_find_language` (`scene/gui/rich_text_label.cpp:3492-3558`).
 * Each paragraph tag is a `push_paragraph` item (`:4703-4718`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { unquoteMatchedPair, type OpenBBCodeTag } from './bbcode';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { StructuredTextParser, TextDirection } from '../../../../godot/text/textServerEnums';
import type {
  StructuredTextOverrideProperties,
  TextDirectionProperties,
} from '../../../../godot/text/paragraphDirection';
import {
  controlBidiOptions,
  type ControlTextEnv,
  type TextBidiOptions,
} from '../../../../r3f/controls/native/text/textBidiOptions';

type ParagraphProperties = TextDirectionProperties & StructuredTextOverrideProperties;

/** The bidi half of what `push_paragraph` stores. */
interface ParagraphBidi {
  /** A `Control::TextDirection`. INHERITED takes the next paragraph out. */
  direction: number;
  /** Empty takes the locale. */
  language: string;
  structuredTextParser: number;
}

/** The alignment tags, each a paragraph in the node's direction, language and override (`:5681-5696`). */
const ALIGNMENT_TAGS: ReadonlyMap<string, number> = new Map([
  ['left', HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT],
  ['center', HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER],
  ['right', HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT],
  ['fill', HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL],
]);

/** `[p align=…]` (`:5790-5801`). */
const ALIGNMENT_OPTIONS: ReadonlyMap<string, number> = new Map([
  ['l', HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT],
  ['left', HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT],
  ['c', HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER],
  ['center', HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER],
  ['r', HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT],
  ['right', HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT],
  ['f', HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL],
  ['fill', HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL],
]);

/** `[p dir=…]` or `[p direction=…]` (`:5802-5813`). */
const DIRECTION_OPTIONS: ReadonlyMap<string, number> = new Map([
  ['a', TextDirection.TEXT_DIRECTION_AUTO],
  ['auto', TextDirection.TEXT_DIRECTION_AUTO],
  ['l', TextDirection.TEXT_DIRECTION_LTR],
  ['ltr', TextDirection.TEXT_DIRECTION_LTR],
  ['r', TextDirection.TEXT_DIRECTION_RTL],
  ['rtl', TextDirection.TEXT_DIRECTION_RTL],
]);

/** `[p st=…]` or `[p bidi_override=…]` (`:5822-5843`). */
const STRUCTURED_TEXT_OPTIONS: ReadonlyMap<string, number> = new Map([
  ['d', StructuredTextParser.STRUCTURED_TEXT_DEFAULT],
  ['default', StructuredTextParser.STRUCTURED_TEXT_DEFAULT],
  ['u', StructuredTextParser.STRUCTURED_TEXT_URI],
  ['uri', StructuredTextParser.STRUCTURED_TEXT_URI],
  ['f', StructuredTextParser.STRUCTURED_TEXT_FILE],
  ['file', StructuredTextParser.STRUCTURED_TEXT_FILE],
  ['e', StructuredTextParser.STRUCTURED_TEXT_EMAIL],
  ['email', StructuredTextParser.STRUCTURED_TEXT_EMAIL],
  ['l', StructuredTextParser.STRUCTURED_TEXT_LIST],
  ['list', StructuredTextParser.STRUCTURED_TEXT_LIST],
  ['n', StructuredTextParser.STRUCTURED_TEXT_GDSCRIPT],
  ['gdscript', StructuredTextParser.STRUCTURED_TEXT_GDSCRIPT],
  ['c', StructuredTextParser.STRUCTURED_TEXT_CUSTOM],
  ['custom', StructuredTextParser.STRUCTURED_TEXT_CUSTOM],
]);

/** A bare `[p]`: `push_paragraph(HORIZONTAL_ALIGNMENT_LEFT)` with the header defaults (`rich_text_label.h:849`). */
const BARE_PARAGRAPH: ParagraphBidi = {
  direction: TextDirection.TEXT_DIRECTION_INHERITED,
  language: '',
  structuredTextParser: StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
};

function isParagraphTag(tag: OpenBBCodeTag): boolean {
  return tag.name === 'p' || ALIGNMENT_TAGS.has(tag.name);
}

/** The last-opened tag that `matches`, as each `_find_*` walks outward from the item. */
function innermost(
  tags: readonly OpenBBCodeTag[],
  matches: (tag: OpenBBCodeTag) => boolean
): OpenBBCodeTag | undefined {
  for (let i = tags.length - 1; i >= 0; i--) if (matches(tags[i]!)) return tags[i];
  return undefined;
}

/** An option under its long name, else its short one, as each `[p]` arm looks both up. */
function optionOf(options: ReadonlyMap<string, string>, long: string, short: string): string {
  return options.get(long) ?? options.get(short) ?? '';
}

/** A `[p …]` with options: INHERITED, the node language and DEFAULT unless an option sets one (`:5750-5844`). */
function paragraphBidiOf(tag: OpenBBCodeTag, props: ParagraphProperties): ParagraphBidi {
  if (tag.name !== 'p') {
    return {
      direction: props.textDirection,
      language: props.language,
      structuredTextParser: props.structuredTextBidiOverride,
    };
  }
  if (!tag.options) return BARE_PARAGRAPH;
  return {
    direction:
      DIRECTION_OPTIONS.get(optionOf(tag.options, 'direction', 'dir')) ??
      TextDirection.TEXT_DIRECTION_INHERITED,
    language: tag.options.get('language') ?? tag.options.get('lang') ?? props.language,
    structuredTextParser:
      STRUCTURED_TEXT_OPTIONS.get(optionOf(tag.options, 'bidi_override', 'st')) ??
      StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
  };
}

/** `_find_alignment`: the innermost paragraph's alignment, else `horizontal_alignment`. */
export function paragraphAlignment(
  tags: readonly OpenBBCodeTag[],
  defaultAlignment: number | undefined
): number {
  const tag = innermost(tags, isParagraphTag);
  if (!tag) return defaultAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT;
  return (
    ALIGNMENT_TAGS.get(tag.name) ??
    ALIGNMENT_OPTIONS.get(tag.options?.get('align') ?? '') ??
    HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT
  );
}

/** `_find_language`: the innermost `[lang]` or paragraph, else `language`. Empty takes the locale. */
function paragraphLanguage(tags: readonly OpenBBCodeTag[], props: ParagraphProperties): string {
  const tag = innermost(tags, (t) => (t.name === 'lang' && t.value !== undefined) || isParagraphTag(t));
  if (!tag) return props.language;
  return tag.name === 'lang' ? unquoteMatchedPair(tag.value!) : paragraphBidiOf(tag, props).language;
}

/**
 * The direction, language and override of the line the tags open on. `_find_direction` takes the
 * innermost paragraph that is not INHERITED, else `text_direction`. `_find_stt` takes the innermost
 * paragraph's parser, and every paragraph shares the node's parser options (`:756-757`).
 */
export function paragraphBidiOptions(
  tags: readonly OpenBBCodeTag[],
  props: ParagraphProperties,
  env: ControlTextEnv
): TextBidiOptions {
  const paragraphs = tags
    .filter(isParagraphTag)
    .reverse()
    .map((tag) => paragraphBidiOf(tag, props));
  return controlBidiOptions(
    {
      textDirection:
        paragraphs.find((p) => p.direction !== TextDirection.TEXT_DIRECTION_INHERITED)?.direction ??
        props.textDirection,
      language: paragraphLanguage(tags, props),
      structuredTextBidiOverride: paragraphs[0]?.structuredTextParser ?? props.structuredTextBidiOverride,
      structuredTextBidiOverrideOptions: props.structuredTextBidiOverrideOptions,
    },
    env
  );
}
