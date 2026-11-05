/**
 * Framework-free BBCode tokenizer for RichTextLabel. It keeps Godot's tag
 * stack for every tag Godot recognises, and `nativeSolver.ts` styles only
 * `[b]`/`[i]`/`[u]`/`[color]`/`[img]`. An unrecognised tag is literal text.
 */

import { namedColor } from '../../../../godot/math/color.js';
import { stringToFloat, stringToInt } from '../../../../godot/string/string';
import type { Rgba } from '../../../../godot/math/math';

/** One currently-open BBCode tag. `value` is the `[name=value]` payload, if the tag carries one. */
export interface OpenBBCodeTag {
  /** Lowercased tag name, such as `'b'` or `'color'`. */
  name: string;
  /**
   * The `=value` portion, verbatim; absent for a bare `[name]` or the space-attribute form. A
   * `[ul bullet=...]` carries everything after its first `=`, as `_get_tag_value` reads it (`:5239-5241`).
   */
  value?: string;
  /**
   * `bbcode_options`, the `key=value` pieces after the name (`rich_text_label.cpp:5357-5382`).
   * Present, perhaps empty, when a space follows the name, which `[p ` reads apart from a bare `[p]` (`:5753`).
   */
  options?: ReadonlyMap<string, string>;
}

/** `String::chr(0xfffc)`: the OBJECT REPLACEMENT CHARACTER Godot appends to `txt` for every inline object (`rich_text_label.cpp:686`), one glyph as wide as the object. */
export const IMAGE_OBJECT_CHAR = '\ufffc';

/** A run of plain (tag-stripped) text plus every tag open at that point, outermost first. */
interface BBCodeRun {
  text: string;
  tags: readonly OpenBBCodeTag[];
  /**
   * Set only when a line starts at this run's first character and its first item leaves an indent or a
   * list of `tags` out: the tags open at that item (`Line::from`). A styling tag that opens the line before
   * a list is that item (`rich_text_label.cpp:4096-4103`). A line that starts later in the run has all of `tags`.
   */
  startTags?: readonly OpenBBCodeTag[];
  /**
   * Set only inside an indent or a list: the tags opened since the character before this run's first one,
   * the ones since closed included. They are the formatting items at that character's offset, which an
   * empty line's marker takes (`rich_text_label.cpp:312-321`).
   */
  openedAtStart?: readonly OpenBBCodeTag[];
  /** Set only on the single-U+FFFC run for an `[img]` (`rich_text_label.cpp:6145`'s `add_image`), never alongside real text. */
  image?: ParsedImgTag;
  /** Set only on the single-U+FFFC run for an `[hr]` (`add_hr`, `:4159`), whose tags end in the `hr` paragraph. */
  rule?: ParsedRuleTag;
  /**
   * Set only on the single `\n` run that ends a line with no text, object or list item, such as one
   * left by `[font_size][/font_size][p]`. Godot keeps that line, as an empty text buffer of no height.
   */
  zeroHeightBreak?: true;
}

/**
 * What the `hr` arm of `append_text` (`rich_text_label.cpp:5955-5983`) passes to `add_hr`, but the
 * colour: its fallback is the theme `default_color`, which only the solver knows.
 */
export interface ParsedRuleTag {
  /** `[hr width=…]`: 90 percent unless set. */
  width: number;
  widthInPercent: boolean;
  /** `[hr height=…]`: 2 px unless set. */
  height: number;
  heightInPercent: boolean;
  colorOption: string | undefined;
}

/** Which point of the image meets which point of the text: `core/math/math_defs.h`'s `InlineAlignment` bitfield as two named axes. */
export interface ParsedImageAlignment {
  imagePoint: 'top' | 'center' | 'bottom';
  textPoint: 'top' | 'center' | 'baseline' | 'bottom';
}

/** `[img]`'s `region=` option, in source-texture pixels (`rich_text_label.cpp:6032-6039`). */
export interface ParsedImageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything `RichTextLabel::append_text`'s `img` arm (`rich_text_label.cpp:5990-6146`) reads out of one `[img...]path[/img]` span. */
export interface ParsedImgTag {
  /** The resource path between the tag and the next `[` or the string's end (`rich_text_label.cpp:6026-6031`). */
  path: string;
  /** Requested width, px; `0` means unset. `:6062-6071`. */
  width: number;
  /** Requested height, px; `0` means unset. `:6062-6071`. */
  height: number;
  widthInPercent: boolean;
  heightInPercent: boolean;
  /** `Color::from_string(color_option->value, Color(1,1,1))` (`:6034-6038`): opaque white by default, not the paragraph's `default_color`. */
  color: Rgba;
  /** `region=` (`:6032-6039`), present only when it has area (`Rect2::has_area()`, both `w`/`h` > 0). */
  region?: ParsedImageRegion;
  /** `pad=true` (`:6087-6089`, `bbcode_options` form only). */
  pad: boolean;
  /** `tooltip=` (`:6084-6086`, `bbcode_options` form only): accessibility metadata, draws nothing. */
  tooltip: string;
  /** `alt=` (`:6040-6043`): accessibility metadata, draws nothing, read unconditionally like `color`/`region`. */
  altText: string;
  alignment: ParsedImageAlignment;
  /** Set only on an `[hr]`'s image: it draws the theme's solid white `horizontal_rule` icon, so `path` names no resource. */
  solid?: true;
}

// A tag is `[name]`, `[name=value]`, `[name attr=...]`, or a `[/name]` close. Only a space starts
// the options (`rich_text_label.cpp:5358`), and Godot does not trim `value` either.
const OPEN = /^\[([a-zA-Z_][a-zA-Z0-9_]*)(?:=([^\]]*)| [^\]]*)?\]$/;
const CLOSE = /^\[\/([a-zA-Z_][a-zA-Z0-9_]*)\]$/;

/** The tags that indent their lines (`push_indent`, `push_list`): the ones whose frames `listing.ts` reads. */
export const INDENT_TAGS: ReadonlySet<string> = new Set(['indent', 'ol', 'ul']);

/** The `[ol type=...]` forms Godot opens (`rich_text_label.cpp:5711-5742`): any other `ol` form is text. */
const ORDERED_LIST_FORMS: ReadonlySet<string> = new Set([
  'ol',
  'ol type=1',
  'ol type=a',
  'ol type=A',
  'ol type=i',
  'ol type=I',
]);

/** `tag == "ol" || tag.begins_with("ol ") || ...` (`rich_text_label.cpp:5436`): the tags that open a list item, valid or not. */
function isListTagText(inner: string): boolean {
  return /^(ol|ul)( |$)/.test(inner);
}

/** Whether `inner`, the text between the brackets, is a list or indent form Godot opens (`:5702-5748`). */
function isIndentFormText(inner: string): boolean {
  return (
    ORDERED_LIST_FORMS.has(inner) || inner === 'ul' || inner.startsWith('ul bullet=') || inner === 'indent'
  );
}

/**
 * Every tag identifier `RichTextLabel::append_text` answers to
 * (`rich_text_label.cpp:5416-6545`), built-in effects included. A tag here that
 * the painter does not style draws unstyled, so `[url=…]` shows the link's text.
 */
const RECOGNISED_TAGS: ReadonlySet<string> = new Set([
  'alm',
  'b',
  'bgcolor',
  'br',
  'cell',
  'center',
  'char',
  'code',
  'color',
  'dropcap',
  'fade',
  'fgcolor',
  'fill',
  'font',
  'font_size',
  'fsi',
  'hint',
  'hr',
  'i',
  'img',
  'indent',
  'lang',
  'lb',
  'left',
  'lre',
  'lri',
  'lrm',
  'lro',
  'ol',
  'opentype_features',
  'otf',
  'outline_color',
  'outline_size',
  'p',
  'pdf',
  'pdi',
  'pulse',
  'rainbow',
  'rb',
  'right',
  'rle',
  'rli',
  'rlm',
  'rlo',
  's',
  'shake',
  'shy',
  'table',
  'tornado',
  'u',
  'ul',
  'url',
  'wave',
  'wj',
  'zwj',
  'zwnj',
]);

/**
 * Tags whose arm adds text and never reaches `tag_stack.push_front(tag)`
 * (`rich_text_label.cpp:5623-5680,5743-5745,5955`), mapped to that text. A push
 * would make the next close tag miss the innermost-only match at `:5386`.
 */
const SELF_CLOSING_TEXT: ReadonlyMap<string, string> = new Map([
  ['lb', '['],
  ['rb', ']'],
  // A bare CR breaks the line: `is_linebreak()` (`char_utils.h:124`) covers 0x0A-0x0D.
  ['br', '\r'],
  ['lrm', '\u200e'],
  ['rlm', '\u200f'],
  ['lre', '\u202a'],
  ['rle', '\u202b'],
  ['lro', '\u202d'],
  ['rlo', '\u202e'],
  ['pdf', '\u202c'],
  ['alm', '\u061c'],
  ['lri', '\u2066'],
  // 0x2027 HYPHENATION POINT, not the 0x2067 RLI this tag names: Godot's
  // constant, ported as written.
  ['rli', '\u2027'],
  ['fsi', '\u2068'],
  ['pdi', '\u2069'],
  ['zwj', '\u200d'],
  ['zwnj', '\u200c'],
  ['wj', '\u2060'],
  ['shy', '\u00ad'],
]);

/**
 * Tags whose push adds its item with `p_ensure_newline` (`rich_text_label.cpp:4096-4103`):
 * `push_paragraph`, `push_indent` and `push_list` (`:4718,4732,4749`).
 */
const PARAGRAPH_TAGS: ReadonlySet<string> = new Set([
  'p',
  'left',
  'center',
  'right',
  'fill',
  'indent',
  'ol',
  'ul',
]);

/**
 * Tags whose item `_find_layout_subitem` skips (`:3712-3727`): a font, a colour, an underline or a
 * strikethrough. Any other open item makes the line count, though it has no height without text.
 */
const STYLING_TAGS: ReadonlySet<string> = new Set([
  'b',
  'i',
  'code',
  'font',
  'opentype_features',
  'otf',
  'color',
  'u',
  's',
]);

/**
 * Tags whose line has height with no text in it: a list item draws its bullet. Any other item with
 * nothing in it leaves a line of no height (measured in Godot 4.6.3), so it needs no break after it.
 */
const LIST_TAGS: ReadonlySet<string> = new Set(['ol', 'ul']);

/**
 * What a self-closing tag adds to the surrounding run, or `null` when `name`
 * is not one. `[char=hex]` is `String::chr(value.hex_to_int())` (`:5623-5626`),
 * and an unparseable or out-of-range value adds nothing.
 */
function selfClosingText(name: string, value: string | undefined): string | null {
  const fixed = SELF_CLOSING_TEXT.get(name);
  if (fixed !== undefined) return fixed;
  if (name !== 'char') return null;
  const codePoint = parseInt(value ?? '', 16);
  // The surrogate range has no scalar value, so `String.fromCodePoint` would
  // emit a lone surrogate.
  if (
    !Number.isFinite(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return '';
  }
  return String.fromCodePoint(codePoint);
}

/** `String::unquote()` (`ustring.cpp:5575-5581`): strips a matched leading and trailing `"` or `'` pair, and returns anything else as is. */
export function unquoteMatchedPair(s: string): string {
  if (s.length < 2) return s;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  if ((first === '"' || first === "'") && first === last) return s.slice(1, -1);
  return s;
}

/**
 * `RichTextLabel::_find_unquoted` and `_split_unquoted`
 * (`rich_text_label.cpp:5243-5301`): splits `src` on `splitter` outside quotes,
 * and drops empty pieces as the source's `end > from` guard does.
 */
export function splitUnquoted(src: string, splitter: string): string[] {
  const out: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i <= src.length; i++) {
    const atEnd = i === src.length;
    const ch = atEnd ? splitter : src[i]!;
    // The end-of-string split is unconditional, so an unterminated quote still
    // yields its tail piece (`rich_text_label.cpp:5290-5296`).
    if (!atEnd && !inSingle && ch === '"') inDouble = !inDouble;
    else if (!atEnd && !inDouble && ch === "'") inSingle = !inSingle;
    else if (atEnd || (!inSingle && !inDouble && ch === splitter)) {
      if (i > start) out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return out;
}

// `InlineAlignment` (`core/math/math_defs.h:94-113`) as bits, not named fields:
// Godot assigns the image point with `=` but ORs the text point onto the
// default's `0b01`, so `[img=xyz,baseline]` gives `0b01 | 0b10 == 0b11`,
// INLINE_ALIGNMENT_TO_BOTTOM rather than baseline.
const IMAGE_TO = { top: 0b0000, center: 0b0001, bottom: 0b0010 } as const;
const TO_TEXT = { top: 0b0000, center: 0b0100, baseline: 0b1000, bottom: 0b1100 } as const;
const IMAGE_MASK = 0b0011;
const TEXT_MASK = 0b1100;
const ALIGNMENT_CENTER = IMAGE_TO.center | TO_TEXT.center;

/** One `top`/`t`/`center`/`c`/`bottom`/`b` keyword to its `IMAGE_TO` value, or `undefined` for anything else (`:6001-6010`/`:6095-6104` have no `else`). */
function matchImagePoint(subtag: string): number | undefined {
  switch (subtag) {
    case 'top':
    case 't':
      return IMAGE_TO.top;
    case 'center':
    case 'c':
      return IMAGE_TO.center;
    case 'bottom':
    case 'b':
      return IMAGE_TO.bottom;
    default:
      return undefined;
  }
}

/** One `top`/`t`/`center`/`c`/`baseline`/`l`/`bottom`/`b` keyword to its `TO_TEXT` value, or `undefined` for anything else (`:6006-6011`/`:6111-6117`). */
function matchTextPoint(subtag: string): number | undefined {
  switch (subtag) {
    case 'top':
    case 't':
      return TO_TEXT.top;
    case 'center':
    case 'c':
      return TO_TEXT.center;
    case 'baseline':
    case 'l':
      return TO_TEXT.baseline;
    case 'bottom':
    case 'b':
      return TO_TEXT.bottom;
    default:
      return undefined;
  }
}

/** Decodes the `IMAGE_TO` and `TO_TEXT` bits into the named shape. */
function decodeInlineAlignment(bits: number): ParsedImageAlignment {
  const imagePoint = bits & IMAGE_MASK;
  const textPoint = bits & TEXT_MASK;
  return {
    imagePoint: imagePoint === IMAGE_TO.top ? 'top' : imagePoint === IMAGE_TO.bottom ? 'bottom' : 'center',
    textPoint:
      textPoint === TO_TEXT.top
        ? 'top'
        : textPoint === TO_TEXT.baseline
          ? 'baseline'
          : textPoint === TO_TEXT.bottom
            ? 'bottom'
            : 'center',
  };
}

/**
 * The subtag parse shared by the `[img=...]` value and the `align=` option
 * (`:5989-6011` / `:6095-6117`): one or two unquoted comma pieces, starting
 * from `INLINE_ALIGNMENT_CENTER`.
 */
function parseAlignmentSubtags(value: string): ParsedImageAlignment {
  const subtag = splitUnquoted(value, ',').map(unquoteMatchedPair);
  let alignment = ALIGNMENT_CENTER;
  if (subtag.length > 1) {
    const image = matchImagePoint(subtag[0]!);
    if (image !== undefined) alignment = image; // `=`, not `|=`: this zeroes the text bits.
    const text = matchTextPoint(subtag[1]!);
    if (text !== undefined) alignment |= text;
  } else if (subtag.length === 1) {
    const image = matchImagePoint(subtag[0]!);
    if (image !== undefined)
      alignment =
        image |
        (image === IMAGE_TO.top ? TO_TEXT.top : image === IMAGE_TO.bottom ? TO_TEXT.bottom : TO_TEXT.center);
  }
  return decodeInlineAlignment(alignment);
}

/** `String::to_int()` plus a `%` suffix: the "N" or "N%" spelling of `width` and `height` (`:6062-6084`). */
function parseSizeValue(value: string): { amount: number; inPercent: boolean } {
  return { amount: stringToInt(value), inPercent: value.endsWith('%') };
}

/**
 * `bbcode_options` (`rich_text_label.cpp:5357-5382`): each piece after the first that holds a `=`,
 * its value unquoted. A later piece with the same key wins.
 */
function bbcodeOptions(splitBlock: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (const expr of splitBlock.slice(1)) {
    const eq = expr.indexOf('=');
    if (eq > -1) options.set(expr.slice(0, eq), unquoteMatchedPair(expr.slice(eq + 1)));
  }
  return options;
}

/** The tag a `[name...]` token opens, with an options map when a space follows its name. */
function openTag(name: string, value: string | undefined, token: string): OpenBBCodeTag {
  // Options follow a space right after the name (`:5753`), so `[color=a b]` has none.
  if (token[name.length + 1] !== ' ') return { name, value };
  return { name, value, options: bbcodeOptions(splitUnquoted(token.slice(1, -1), ' ')) };
}

/**
 * The `img` arm of `RichTextLabel::append_text` (`rich_text_label.cpp:5990-6146`)
 * for the tag content without its brackets, such as `"img=100x50 color=red"`.
 * The first unquoted piece's `=value` is `bbcode_value`, and later pieces are
 * `bbcode_options` (`:5357-5382`).
 */
function parseImgTag(content: string, path: string): ParsedImgTag {
  const splitBlock = splitUnquoted(content, ' ');
  const first = splitBlock[0] ?? content;
  const options = bbcodeOptions(splitBlock);
  const mainEq = first.indexOf('=');
  const bbcodeValue = mainEq > -1 ? first.slice(mainEq + 1) : '';

  let alignment = decodeInlineAlignment(ALIGNMENT_CENTER);
  if (mainEq > -1) alignment = parseAlignmentSubtags(bbcodeValue);

  // `color`, `region` and `alt` are read unconditionally (`:6032-6043`).
  const regionOption = options.get('region');
  let region: ParsedImageRegion | undefined;
  if (regionOption !== undefined) {
    const parts = splitUnquoted(regionOption, ',');
    if (parts.length === 4) {
      const [x, y, w, h] = parts.map((p) => stringToFloat(p));
      region = { x: x!, y: y!, w: w!, h: h! };
    }
  }

  const colorOption = options.get('color');
  const color =
    colorOption !== undefined
      ? resolveBBColor(colorOption, { r: 1, g: 1, b: 1, a: 1 })
      : { r: 1, g: 1, b: 1, a: 1 };
  const altText = options.get('alt') ?? '';

  let width = 0;
  let height = 0;
  let widthInPercent = false;
  let heightInPercent = false;
  let pad = false;
  let tooltip = '';

  // A non-empty `bbcode_value` excludes the five option keys (`:6062-6141`), so
  // `[img=top]` has width 0 (`"top".to_int()`) whatever options follow.
  if (bbcodeValue !== '') {
    const sep = bbcodeValue.indexOf('x');
    if (sep === -1) {
      ({ amount: width, inPercent: widthInPercent } = parseSizeValue(bbcodeValue));
    } else {
      ({ amount: width, inPercent: widthInPercent } = parseSizeValue(bbcodeValue.slice(0, sep)));
      ({ amount: height, inPercent: heightInPercent } = parseSizeValue(bbcodeValue.slice(sep + 1)));
    }
  } else {
    const alignOption = options.get('align');
    if (alignOption !== undefined) alignment = parseAlignmentSubtags(alignOption);
    const widthOption = options.get('width');
    if (widthOption !== undefined)
      ({ amount: width, inPercent: widthInPercent } = parseSizeValue(widthOption));
    const heightOption = options.get('height');
    if (heightOption !== undefined)
      ({ amount: height, inPercent: heightInPercent } = parseSizeValue(heightOption));
    tooltip = options.get('tooltip') ?? '';
    pad = options.get('pad') === 'true';
  }

  return {
    path,
    width,
    height,
    widthInPercent,
    heightInPercent,
    color,
    region,
    pad,
    tooltip,
    altText,
    alignment,
  };
}

/** The `hr` arm matches by prefix, `tag.begins_with("hr")` (`rich_text_label.cpp:5955`), so `[hrx]` draws a rule. */
const RULE_TAG_PREFIX = 'hr';

/**
 * The `hr` arm's options (`:5955-5983`), or `undefined` for a negative size, which `add_hr`
 * refuses (`:4167-4168`) before it adds an item. `align` is the raw option, which
 * `paragraphAlignment` reads.
 */
function parseRuleTag(
  options: ReadonlyMap<string, string> | undefined
): { rule: ParsedRuleTag; align: string | undefined } | undefined {
  const widthOption = options?.get('width');
  const heightOption = options?.get('height');
  const rule: ParsedRuleTag = {
    width: widthOption === undefined ? 90 : stringToInt(widthOption),
    widthInPercent: widthOption === undefined || widthOption.endsWith('%'),
    height: heightOption === undefined ? 2 : stringToInt(heightOption),
    heightInPercent: heightOption !== undefined && heightOption.endsWith('%'),
    colorOption: options?.get('color'),
  };
  if (rule.width < 0 || rule.height < 0) return undefined;
  return { rule, align: options?.get('align') };
}

/**
 * Whether two stacks draw alike. An indent or a list is one frame, so two of them never merge even
 * where their tags read the same: `listing.ts` counts items by frame.
 */
function sameTags(a: readonly OpenBBCodeTag[], b: readonly OpenBBCodeTag[]): boolean {
  return (
    a.length === b.length &&
    a.every((t, i) =>
      INDENT_TAGS.has(t.name)
        ? t === b[i]
        : t.name === b[i]!.name && t.value === b[i]!.value && t.options === b[i]!.options
    )
  );
}

/** The next `[` at or after `from`, or the end of the string (`:6026-6029`). */
function nextBracket(text: string, from: number): number {
  const at = text.indexOf('[', from);
  return at < 0 ? text.length : at;
}

/**
 * Tokenizes `text` into runs, each with the full stack of open tags, outermost
 * first. An unrecognised tag emits a literal `[` and resumes at the next
 * character (`:6543-6544`), and a close tag counts only when it matches the
 * innermost open tag (`:5386`), so this scans rather than splits.
 */
export function parseBBCodeRuns(text: string): BBCodeRun[] {
  const stack: OpenBBCodeTag[] = [];
  const runs: BBCodeRun[] = [];
  let pending = '';
  // The tags open at the first item of the current line, or null while the line holds no item.
  let lineFirstItemTags: OpenBBCodeTag[] | null = null;
  // Whether the current line holds a character yet, and the tags a line starting at `pending` has.
  let lineHasCharacter = false;
  let pendingStartTags: OpenBBCodeTag[] | undefined;
  // The tags pushed since the last character, and the ones the pending run's first character follows.
  let openedSinceCharacter: OpenBBCodeTag[] = [];
  let pendingOpenedAtStart: OpenBBCodeTag[] | undefined;
  // Whether the current line has height, from text, an object or a list item.
  let lineHasHeight = false;
  // Whether the current line holds an item `_find_layout_subitem` counts, with or without height.
  let lineHasLayout = false;
  // `after_list_open_tag` and `after_list_close_tag` (`:5317-5318`).
  let afterListOpen = false;
  let afterListClose = false;

  function noteCharacters(added: string): void {
    if (added !== '') {
      if (
        pending === '' &&
        openedSinceCharacter.length > 0 &&
        stack.some((tag) => INDENT_TAGS.has(tag.name))
      ) {
        pendingOpenedAtStart = openedSinceCharacter;
      }
      openedSinceCharacter = [];
    }
    for (let start = 0; start <= added.length;) {
      const newline = added.indexOf('\n', start);
      const hasItem = (newline < 0 ? added.length : newline) > start || newline >= 0;
      if (hasItem && lineFirstItemTags === null) lineFirstItemTags = [...stack];
      if (hasItem && !lineHasCharacter) {
        const firstItemTags = lineFirstItemTags!;
        const leavesOutFrame = stack.some((tag) => INDENT_TAGS.has(tag.name) && !firstItemTags.includes(tag));
        if (pending === '' && leavesOutFrame) pendingStartTags = firstItemTags;
        lineHasCharacter = true;
      }
      if (newline < 0) return;
      lineFirstItemTags = null;
      lineHasCharacter = false;
      start = newline + 1;
    }
  }

  function append(added: string): void {
    if (added === '') return;
    noteCharacters(added);
    pending += added;
    const lastBreak = added.lastIndexOf('\n');
    lineHasHeight = lastBreak < 0 || lastBreak < added.length - 1;
    lineHasLayout = lineHasHeight;
  }

  /** `_add_item`'s `p_ensure_newline` (`:4097-4104`): a line that counts ends, with or without height. */
  function endLineForParagraph(): void {
    if (lineHasHeight) {
      append('\n');
      return;
    }
    if (!lineHasLayout) return;
    flush();
    runs.push({ text: '\n', tags: [...stack], zeroHeightBreak: true });
    lineHasLayout = false;
    lineFirstItemTags = null;
    lineHasCharacter = false;
  }

  function push(tag: OpenBBCodeTag): void {
    if (PARAGRAPH_TAGS.has(tag.name)) endLineForParagraph();
    flush();
    stack.push(tag);
    openedSinceCharacter.push(tag);
    lineFirstItemTags ??= [...stack];
    // `[img]` opens a tag but no item (`:6145`): its loaded image sets the flags where it is added.
    if (!STYLING_TAGS.has(tag.name) && tag.name !== 'img') lineHasLayout = true;
    if (LIST_TAGS.has(tag.name)) lineHasHeight = true;
  }

  /** `add_hr`: a paragraph item, so the line of the text before ends, then the rule on the new line. */
  function addRule(rule: ParsedRuleTag, align: string | undefined): void {
    endLineForParagraph();
    flush();
    noteCharacters(IMAGE_OBJECT_CHAR);
    runs.push({ text: IMAGE_OBJECT_CHAR, tags: [...stack, { name: 'hr', value: align }], rule });
    lineHasHeight = true;
    lineHasLayout = true;
  }

  function flush(): void {
    if (!pending) return;
    // Text with an unchanged stack merges into the previous run, so a literal
    // bracket never splits it into separate meshes. An image or rule run never
    // merges: its `text` is the object placeholder a painter keys off.
    const previous = runs[runs.length - 1];
    const startsAtMarkedPoint = pendingStartTags || pendingOpenedAtStart;
    if (
      previous &&
      !previous.image &&
      !previous.rule &&
      !previous.zeroHeightBreak &&
      !startsAtMarkedPoint &&
      sameTags(previous.tags, stack)
    ) {
      previous.text += pending;
    } else {
      runs.push({
        text: pending,
        tags: [...stack],
        ...(pendingStartTags && { startTags: pendingStartTags }),
        ...(pendingOpenedAtStart && { openedAtStart: pendingOpenedAtStart }),
      });
    }
    pending = '';
    pendingStartTags = undefined;
    pendingOpenedAtStart = undefined;
  }

  let pos = 0;
  while (pos <= text.length) {
    const brkStart = text.indexOf('[', pos);
    let before = text.slice(pos, brkStart < 0 ? text.length : brkStart);
    // The first newline after a list tag is dropped: a list adds the one it needs (`:5331-5334`).
    if ((afterListClose || afterListOpen) && before.startsWith('\n')) before = before.slice(1);

    if (brkStart < 0) {
      append(before === '' && afterListOpen ? '\n' : before);
      break;
    }

    const brkEnd = text.indexOf(']', brkStart);
    if (brkEnd < 0) {
      // No closing bracket at all: the rest is text, brackets included.
      append(before + text.slice(brkStart));
      break;
    }
    const token = text.slice(brkStart, brkEnd + 1);

    const close = CLOSE.exec(token);
    if (close && stack.length > 0 && stack[stack.length - 1]!.name === close[1]) {
      if (before === '' && afterListOpen) before = '\n';
      afterListOpen = false;
      if (close[1] === 'ol' || close[1] === 'ul') {
        // The last item of a list ends with a newline, and an empty list holds one empty item (`:5415-5424`).
        if (before !== '') before = before.endsWith('\n') ? before : `${before}\n`;
        else if (!afterListClose) before = '\n';
        afterListClose = true;
      } else {
        afterListClose = false;
      }
      append(before);
      flush();
      stack.pop();
      pos = brkEnd + 1;
      continue;
    }

    const inner = token.slice(1, -1);
    if (isListTagText(inner)) {
      if (before === '' && afterListOpen) before = '\n';
      afterListOpen = true;
    } else {
      afterListOpen = false;
    }
    append(before);
    afterListClose = false;

    const open = close ? null : OPEN.exec(token);
    // Tag names compare exactly (`:5452`), so `[B]` is text.
    if (
      open &&
      (RECOGNISED_TAGS.has(open[1]!) || open[1]!.startsWith(RULE_TAG_PREFIX)) &&
      (!INDENT_TAGS.has(open[1]!) || isIndentFormText(inner))
    ) {
      const name = open[1]!;
      const emitted = selfClosingText(name, open[2]);
      if (emitted !== null) {
        // Part of the surrounding run, so no `flush()`: it carries the same
        // stack as the text either side of it.
        append(emitted);
        pos = brkEnd + 1;
        continue;
      }
      if (name.startsWith(RULE_TAG_PREFIX)) {
        const parsed = parseRuleTag(openTag(name, open[2], token).options);
        if (parsed) addRule(parsed.rule, parsed.align);
        pos = brkEnd + 1;
        continue;
      }
      if (name === 'img') {
        // The payload is the image's path up to the next `[` or the end, and
        // the scan resumes there (`rich_text_label.cpp:6026-6031,6145`).
        const imgEnd = nextBracket(text, brkEnd + 1);
        const path = text.slice(brkEnd + 1, imgEnd);
        flush();
        // A failed `ResourceLoader::load(image, "Texture2D")` (`:6034`) adds no
        // image and no glyph, but the tag still opens (`:6145`).
        if (path !== '') {
          noteCharacters(IMAGE_OBJECT_CHAR);
          runs.push({
            text: IMAGE_OBJECT_CHAR,
            tags: [...stack],
            image: parseImgTag(token.slice(1, -1), path),
          });
          lineHasHeight = true;
          lineHasLayout = true;
        }
        push(openTag(name, open[2], token));
        pos = imgEnd;
        continue;
      }
      const tag = openTag(name, open[2], token);
      if (name === 'ul' && inner.startsWith('ul bullet=')) tag.value = inner.slice(inner.indexOf('=') + 1);
      push(tag);
      pos = brkEnd + 1;
      continue;
    }

    append('[');
    pos = brkStart + 1;
  }

  flush();
  return runs;
}

/** Whether a tag named `name` is anywhere on the open stack. */
export function hasOpenTag(tags: readonly OpenBBCodeTag[], name: string): boolean {
  return tags.some((t) => t.name === name);
}

/** The innermost (last-opened) open tag named `name`'s value, or `undefined` if none is open or it carries no value. */
export function lastTagValue(tags: readonly OpenBBCodeTag[], name: string): string | undefined {
  for (let i = tags.length - 1; i >= 0; i--) {
    if (tags[i]!.name === name) return tags[i]!.value;
  }
  return undefined;
}

/** `Color::html`'s single hex digit (0-9, a-f/A-F), scaled to 0-15. */
function hexDigit(ch: string): number {
  return parseInt(ch, 16);
}

/** `Color::html`'s hex byte (2 digits), 0-255. */
function hexByte(hex: string, i: number): number {
  return hexDigit(hex[i]!) * 16 + hexDigit(hex[i + 1]!);
}

/**
 * `Color::html` (`core/math/color.cpp:331-368`) gated by `Color::html_is_valid`
 * (`:372-390`): an optional `#`, then 3 or 4 digits over 15, or 6 or 8 over
 * 255. Alpha defaults to 1. `undefined` means "not hex", so the caller falls through.
 */
function parseHtmlHex(value: string): Rgba | undefined {
  const body = value.startsWith('#') ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]+$/.test(body)) return undefined;

  switch (body.length) {
    case 3:
      return { r: hexDigit(body[0]!) / 15, g: hexDigit(body[1]!) / 15, b: hexDigit(body[2]!) / 15, a: 1 };
    case 4:
      return {
        r: hexDigit(body[0]!) / 15,
        g: hexDigit(body[1]!) / 15,
        b: hexDigit(body[2]!) / 15,
        a: hexDigit(body[3]!) / 15,
      };
    case 6:
      return { r: hexByte(body, 0) / 255, g: hexByte(body, 2) / 255, b: hexByte(body, 4) / 255, a: 1 };
    case 8:
      return {
        r: hexByte(body, 0) / 255,
        g: hexByte(body, 2) / 255,
        b: hexByte(body, 4) / 255,
        a: hexByte(body, 6) / 255,
      };
    default:
      return undefined;
  }
}

/**
 * Resolves a `[color=value]` payload as `Color::from_string` (`rich_text_
 * label.cpp:6149`, `color.cpp:450-456`): hex, then the named colours of
 * `core/math/color_names.inc` (`godot/math/color.ts`), then `fallback`.
 * A `Color(r, g, b, a)` literal is not a colour here.
 */
export function resolveBBColor(value: string, fallback: Rgba): Rgba {
  return parseHtmlHex(value) ?? namedColor(value) ?? fallback;
}
