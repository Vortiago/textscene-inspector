/**
 * What a RichTextLabel line reads from the paragraph tags open on it: `_find_jst_flags`,
 * `_find_tab_stops`, `_find_alignment`, `_find_direction`, `_find_stt` and `_find_language`
 * (`scene/gui/rich_text_label.cpp:3462-3558`).
 * Each paragraph tag is a `push_paragraph` item (`:4703-4718`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { splitUnquoted, unquoteMatchedPair, type OpenBBCodeTag } from './bbcode';
import { stringToFloat } from '../../../../godot/string/string';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import {
  DEFAULT_JUSTIFICATION_FLAGS,
  JustificationFlag,
  StructuredTextParser,
  TextDirection,
} from '../../../../godot/text/textServerEnums';
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

/** The bidi half of what `push_paragraph` stores. An INHERITED direction takes the next paragraph out. */
type ParagraphBidi = TextDirectionProperties &
  Pick<StructuredTextOverrideProperties, 'structuredTextBidiOverride'>;

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

/** `[p jst=…]` or `[p justification_flags=…]` tokens (`:5758-5782`), long name before short. */
const JUSTIFICATION_TOKENS: ReadonlyMap<string, number> = new Map([
  ['kashida', JustificationFlag.KASHIDA],
  ['k', JustificationFlag.KASHIDA],
  ['word', JustificationFlag.WORD_BOUND],
  ['w', JustificationFlag.WORD_BOUND],
  ['trim', JustificationFlag.TRIM_EDGE_SPACES],
  ['tr', JustificationFlag.TRIM_EDGE_SPACES],
  ['after_last_tab', JustificationFlag.AFTER_LAST_TAB],
  ['lt', JustificationFlag.AFTER_LAST_TAB],
  ['skip_last', JustificationFlag.SKIP_LAST_LINE],
  ['sl', JustificationFlag.SKIP_LAST_LINE],
  ['skip_last_with_chars', JustificationFlag.SKIP_LAST_LINE_WITH_VISIBLE_CHARS],
  ['sv', JustificationFlag.SKIP_LAST_LINE_WITH_VISIBLE_CHARS],
  ['do_not_skip_single', JustificationFlag.DO_NOT_SKIP_SINGLE_LINE],
  ['ns', JustificationFlag.DO_NOT_SKIP_SINGLE_LINE],
]);

/** `add_hr`'s `ItemParagraph`, which keeps the struct defaults (`rich_text_label.h:369-377`): AUTO direction, no language. */
const RULE_PARAGRAPH: ParagraphBidi = {
  textDirection: TextDirection.TEXT_DIRECTION_AUTO,
  language: '',
  structuredTextBidiOverride: StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
};

/** A bare `[p]`: `push_paragraph(HORIZONTAL_ALIGNMENT_LEFT)` with the header defaults (`rich_text_label.h:849`). */
const BARE_PARAGRAPH: ParagraphBidi = {
  textDirection: TextDirection.TEXT_DIRECTION_INHERITED,
  language: '',
  structuredTextBidiOverride: StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
};

/** The paragraph an `[hr]` run opens is named `hr`, and its value is the raw `align` option (`parseRuleTag`). */
function isParagraphTag(tag: OpenBBCodeTag): boolean {
  return tag.name === 'p' || tag.name === 'hr' || ALIGNMENT_TAGS.has(tag.name);
}

/**
 * `String::split_floats_mk` with `,` and `;` and empty pieces allowed (`ustring.cpp:1224-1257`):
 * an empty string gives no stops, and an empty piece between two splitters reads as 0.
 */
function splitTabStops(value: string): number[] {
  if (value === '') return [];
  return value.split(/[,;]/).map(stringToFloat);
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
  if (tag.name === 'hr') return RULE_PARAGRAPH;
  if (tag.name !== 'p') return props;
  if (!tag.options) return BARE_PARAGRAPH;
  return {
    textDirection:
      DIRECTION_OPTIONS.get(optionOf(tag.options, 'direction', 'dir')) ??
      TextDirection.TEXT_DIRECTION_INHERITED,
    language: tag.options.get('language') ?? tag.options.get('lang') ?? props.language,
    structuredTextBidiOverride:
      STRUCTURED_TEXT_OPTIONS.get(optionOf(tag.options, 'bidi_override', 'st')) ??
      StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
  };
}

/** `add_hr`'s `align=` (`:5957-5966`): left, centre or right, and CENTER for anything else, `fill` included. */
function ruleAlignment(align: string | undefined): number {
  const alignment = ALIGNMENT_OPTIONS.get(align ?? '');
  return alignment === undefined || alignment === HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL
    ? HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
    : alignment;
}

/** `_find_alignment`: the innermost paragraph's alignment, else `horizontal_alignment`. */
export function paragraphAlignment(
  tags: readonly OpenBBCodeTag[],
  defaultAlignment: number | undefined
): number {
  const tag = innermost(tags, isParagraphTag);
  if (!tag) return defaultAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT;
  if (tag.name === 'hr') return ruleAlignment(tag.value);
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
        paragraphs.find((p) => p.textDirection !== TextDirection.TEXT_DIRECTION_INHERITED)?.textDirection ??
        props.textDirection,
      language: paragraphLanguage(tags, props),
      structuredTextBidiOverride:
        paragraphs[0]?.structuredTextBidiOverride ?? props.structuredTextBidiOverride,
      structuredTextBidiOverrideOptions: props.structuredTextBidiOverrideOptions,
    },
    env
  );
}

/**
 * `_find_jst_flags`: the innermost paragraph's flags, else `justification_flags`. A bare `[p]`
 * keeps the header default (`rich_text_label.h:849`). A `[p …]` takes the node's unless `jst` sets
 * them, and `jst` starts from no flags (`:5758-5782`).
 */
export function paragraphJustificationFlags(tags: readonly OpenBBCodeTag[], nodeFlags: number): number {
  const tag = innermost(tags, isParagraphTag);
  if (tag?.name === 'hr') return DEFAULT_JUSTIFICATION_FLAGS;
  if (!tag || tag.name !== 'p') return nodeFlags;
  if (!tag.options) return DEFAULT_JUSTIFICATION_FLAGS;
  const option = tag.options.get('justification_flags') ?? tag.options.get('jst');
  if (option === undefined) return nodeFlags;
  return splitUnquoted(option, ',').reduce(
    (flags, token) => flags | (JUSTIFICATION_TOKENS.get(token) ?? 0),
    0
  );
}

/**
 * `_find_tab_stops`: the innermost paragraph's stops, else `tab_stops`. A bare `[p]` has none, so
 * its tabs fall to `tab_size`. A `[p …]` takes the node's unless `tab_stops` sets them (`:5783-5789`).
 */
export function paragraphTabStopsPx(
  tags: readonly OpenBBCodeTag[],
  nodeStopsPx: readonly number[]
): readonly number[] {
  const tag = innermost(tags, isParagraphTag);
  if (tag?.name === 'hr') return [];
  if (!tag || tag.name !== 'p') return nodeStopsPx;
  if (!tag.options) return [];
  const option = tag.options.get('tab_stops');
  return option === undefined ? nodeStopsPx : splitTabStops(option);
}
