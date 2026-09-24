/**
 * Framework-free BBCode tokenizer for RichTextLabel. It keeps Godot's tag
 * stack for every tag Godot recognises, and `nativeSolver.ts` styles only
 * `[b]`/`[i]`/`[u]`/`[color]`/`[img]`. An unrecognised tag is literal text.
 */

import type { ControlColor } from '../control/types';
import { godotNamedColor } from '../../../../utils/godotNamedColor';
import { stringToFloat, stringToInt } from '../../../../godot/string';

/** One currently-open BBCode tag. `value` is the `[name=value]` payload, if the tag carries one. */
export interface OpenBBCodeTag {
  /** Lowercased tag name, such as `'b'` or `'color'`. */
  name: string;
  /** The `=value` portion, verbatim; absent for a bare `[name]` or the space-attribute form. */
  value?: string;
}

/** `String::chr(0xfffc)`: the OBJECT REPLACEMENT CHARACTER Godot appends to `txt` for every inline object (`rich_text_label.cpp:686`), one glyph as wide as the object. */
export const IMAGE_OBJECT_CHAR = '\ufffc';

/** A run of plain (tag-stripped) text plus every tag open at that point, outermost first. */
export interface BBCodeRun {
  text: string;
  tags: readonly OpenBBCodeTag[];
  /** Set only on the single-U+FFFC run for an `[img]` (`rich_text_label.cpp:6145`'s `add_image`), never alongside real text. */
  image?: ParsedImgTag;
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
  color: ControlColor;
  /** `region=` (`:6032-6039`), present only when it has area (`Rect2::has_area()`, both `w`/`h` > 0). */
  region?: ParsedImageRegion;
  /** `pad=true` (`:6087-6089`, `bbcode_options` form only). */
  pad: boolean;
  /** `tooltip=` (`:6084-6086`, `bbcode_options` form only): accessibility metadata, draws nothing. */
  tooltip: string;
  /** `alt=` (`:6040-6043`): accessibility metadata, draws nothing, read unconditionally like `color`/`region`. */
  altText: string;
  alignment: ParsedImageAlignment;
}

// A tag is `[name]`, `[name=value]`, `[name attr=...]`, or a `[/name]` close.
// Godot does not trim `value` either. Space attributes are matched and ignored.
const OPEN = /^\[([a-zA-Z_][a-zA-Z0-9_]*)(?:=([^\]]*)|\s[^\]]*)?\]$/;
const CLOSE = /^\[\/([a-zA-Z_][a-zA-Z0-9_]*)\]$/;

/**
 * Every tag identifier `RichTextLabel::append_text` answers to
 * (`rich_text_label.cpp:5416-6545`), built-in effects included. A tag here that
 * the painter does not style draws unstyled, so `[url=…]` shows the link's text.
 */
const RECOGNISED_TAGS: ReadonlySet<string> = new Set([
  'alm', 'b', 'bgcolor', 'br', 'cell', 'center', 'char', 'code', 'color', 'dropcap',
  'fade', 'fgcolor', 'fill', 'font', 'font_size', 'fsi', 'hint', 'hr', 'i', 'img',
  'indent', 'lang', 'lb', 'left', 'lre', 'lri', 'lrm', 'lro', 'ol',
  'opentype_features', 'otf', 'outline_color', 'outline_size', 'p', 'pdf', 'pdi',
  'pulse', 'rainbow', 'rb', 'right', 'rle', 'rli', 'rlm', 'rlo', 's', 'shake',
  'shy', 'table', 'tornado', 'u', 'ul', 'url', 'wave', 'wj', 'zwj', 'zwnj',
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

/** `[hr]`: consumed and drawn, contributing no text and no open tag. */
const SELF_CLOSING_SILENT: ReadonlySet<string> = new Set(['hr']);

/**
 * What a self-closing tag adds to the surrounding run, or `null` when `name`
 * is not one. `[char=hex]` is `String::chr(value.hex_to_int())` (`:5623-5626`),
 * and an unparseable or out-of-range value adds nothing.
 */
function selfClosingText(name: string, value: string | undefined): string | null {
  const fixed = SELF_CLOSING_TEXT.get(name);
  if (fixed !== undefined) return fixed;
  if (SELF_CLOSING_SILENT.has(name)) return '';
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
function unquoteMatchedPair(s: string): string {
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
function splitUnquoted(src: string, splitter: string): string[] {
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
      textPoint === TO_TEXT.top ? 'top' : textPoint === TO_TEXT.baseline ? 'baseline' : textPoint === TO_TEXT.bottom ? 'bottom' : 'center',
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
    if (image !== undefined) alignment = image | (image === IMAGE_TO.top ? TO_TEXT.top : image === IMAGE_TO.bottom ? TO_TEXT.bottom : TO_TEXT.center);
  }
  return decodeInlineAlignment(alignment);
}

/** `String::to_int()` plus a `%` suffix: the "N" or "N%" spelling of `width` and `height` (`:6062-6084`). */
function parseSizeValue(value: string): { amount: number; inPercent: boolean } {
  return { amount: stringToInt(value), inPercent: value.endsWith('%') };
}

/**
 * The `img` arm of `RichTextLabel::append_text` (`rich_text_label.cpp:5990-6146`)
 * for the tag content without its brackets, such as `"img=100x50 color=red"`.
 * The first unquoted piece's `=value` is `bbcode_value`, and later pieces are
 * `bbcode_options` (`:5357-5382`).
 */
export function parseImgTag(content: string, path: string): ParsedImgTag {
  const splitBlock = splitUnquoted(content, ' ');
  const first = splitBlock[0] ?? content;
  const options = new Map<string, string>();
  for (const expr of splitBlock.slice(1)) {
    const eq = expr.indexOf('=');
    if (eq > -1) options.set(expr.slice(0, eq), unquoteMatchedPair(expr.slice(eq + 1)));
  }
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
  const color = colorOption !== undefined ? resolveBBColor(colorOption, { r: 1, g: 1, b: 1, a: 1 }) : { r: 1, g: 1, b: 1, a: 1 };
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
    if (widthOption !== undefined) ({ amount: width, inPercent: widthInPercent } = parseSizeValue(widthOption));
    const heightOption = options.get('height');
    if (heightOption !== undefined) ({ amount: height, inPercent: heightInPercent } = parseSizeValue(heightOption));
    tooltip = options.get('tooltip') ?? '';
    pad = options.get('pad') === 'true';
  }

  return { path, width, height, widthInPercent, heightInPercent, color, region, pad, tooltip, altText, alignment };
}

function sameTags(a: readonly OpenBBCodeTag[], b: readonly OpenBBCodeTag[]): boolean {
  return a.length === b.length && a.every((t, i) => t.name === b[i]!.name && t.value === b[i]!.value);
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

  function flush(): void {
    if (!pending) return;
    // Text with an unchanged stack merges into the previous run, so a literal
    // bracket or `[hr]` never splits it into separate meshes. An image run
    // never merges: its `text` is the object placeholder a painter keys off.
    const previous = runs[runs.length - 1];
    if (previous && !previous.image && sameTags(previous.tags, stack)) previous.text += pending;
    else runs.push({ text: pending, tags: [...stack] });
    pending = '';
  }

  let pos = 0;
  while (pos < text.length) {
    const brkStart = text.indexOf('[', pos);
    if (brkStart < 0) {
      pending += text.slice(pos);
      break;
    }
    pending += text.slice(pos, brkStart);

    const brkEnd = text.indexOf(']', brkStart);
    if (brkEnd < 0) {
      // No closing bracket at all: the rest is text, brackets included.
      pending += text.slice(brkStart);
      break;
    }
    const token = text.slice(brkStart, brkEnd + 1);

    const close = CLOSE.exec(token);
    if (close && stack.length > 0 && stack[stack.length - 1]!.name === close[1]!.toLowerCase()) {
      flush();
      stack.pop();
      pos = brkEnd + 1;
      continue;
    }

    const open = close ? null : OPEN.exec(token);
    if (open && RECOGNISED_TAGS.has(open[1]!.toLowerCase())) {
      const name = open[1]!.toLowerCase();
      const emitted = selfClosingText(name, open[2]);
      if (emitted !== null) {
        // Part of the surrounding run, so no `flush()`: it carries the same
        // stack as the text either side of it.
        pending += emitted;
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
        if (path !== '') runs.push({ text: IMAGE_OBJECT_CHAR, tags: [...stack], image: parseImgTag(token.slice(1, -1), path) });
        stack.push({ name, value: open[2] });
        pos = imgEnd;
        continue;
      }
      flush();
      stack.push({ name, value: open[2] });
      pos = brkEnd + 1;
      continue;
    }

    pending += '[';
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
function parseHtmlHex(value: string): ControlColor | undefined {
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
 * `core/math/color_names.inc` (`utils/godotNamedColor.ts`), then `fallback`.
 * A `Color(r, g, b, a)` literal is not a colour here.
 */
export function resolveBBColor(value: string, fallback: ControlColor): ControlColor {
  return parseHtmlHex(value) ?? godotNamedColor(value) ?? fallback;
}
