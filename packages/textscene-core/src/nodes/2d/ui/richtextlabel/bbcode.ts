/**
 * Framework-free BBCode tokenizer for RichTextLabel's supported subset
 * (best-effort [b]/[i]/[u]/[s]/[color]/[center]/[code]/[img], not full
 * BBCode). `parseBBCodeRuns` produces the tag-stack/nesting semantics; the
 * native painter (`nativeSolver.ts`'s `styledTextRuns`) turns a run's tags
 * into `{bold, italic, color}` and an `[img]` run into a drawn quad (its own
 * explicit non-goal beyond that: only `[b]`/`[i]`/`[color]`/`[img]` affect
 * native rendering — every other tag Godot RECOGNISES still tokenizes
 * correctly, for stack/nesting fidelity, but contributes no native effect).
 *
 * A tag Godot does not recognise is a different case entirely: it is not a tag
 * at all, and renders as literal text exactly as the engine renders it. See
 * `parseBBCodeRuns`.
 */

import type { ControlColor } from '../control/types';
import { godotNamedColor } from '../../../../utils/godotNamedColor';
import { stringToFloat, stringToInt } from '../../../../godot/string';

/** One currently-open BBCode tag. `value` is the `[name=value]` payload, if the tag carries one. */
export interface OpenBBCodeTag {
  /** Lowercased tag name, e.g. `'b'`, `'color'`. */
  name: string;
  /** The `=value` portion, verbatim — absent for a bare `[name]` or the space-attribute form. */
  value?: string;
}

/** `String::chr(0xfffc)` — the OBJECT REPLACEMENT CHARACTER Godot itself appends to `txt` for every inline object (`rich_text_label.cpp:686`), one placeholder glyph occupying the object's own width. */
export const IMAGE_OBJECT_CHAR = '\ufffc';

/** A run of plain (tag-stripped) text plus every tag open at that point, outermost first. */
export interface BBCodeRun {
  text: string;
  tags: readonly OpenBBCodeTag[];
  /** Set only on the single-U+FFFC-character run standing in for an `[img]` (`rich_text_label.cpp:6145`'s `add_image`) — never alongside real text. */
  image?: ParsedImgTag;
}

/** Which point of the image, and which point of the surrounding text, `[img]`'s alignment glues together — `core/math/math_defs.h`'s `InlineAlignment` bitfield, split into two named axes instead of transcribing the bit values. */
export interface ParsedImageAlignment {
  imagePoint: 'top' | 'center' | 'bottom';
  textPoint: 'top' | 'center' | 'baseline' | 'bottom';
}

/** `[img]`'s `region=` option — pixel-space, in the SOURCE texture (`rich_text_label.cpp:6032-6039`). */
export interface ParsedImageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything `RichTextLabel::append_text`'s `img` arm (`rich_text_label.cpp:5990-6146`) reads out of one `[img...]path[/img]` span. */
export interface ParsedImgTag {
  /** The resource path/ref between the tag and its close (or the next `[`, or the string's end) — `rich_text_label.cpp:6026-6031`. */
  path: string;
  /** Requested width, px; `0` means unset. `:6062-6071`. */
  width: number;
  /** Requested height, px; `0` means unset. `:6062-6071`. */
  height: number;
  widthInPercent: boolean;
  heightInPercent: boolean;
  /** `Color::from_string(color_option->value, Color(1,1,1))` (`:6034-6038`) — opaque white default, NOT the paragraph's `default_color`. */
  color: ControlColor;
  /** `region=` (`:6032-6039`), present only when it has area (`Rect2::has_area()`, both `w`/`h` > 0). */
  region?: ParsedImageRegion;
  /** `pad=true` (`:6087-6089`, `bbcode_options` form only). */
  pad: boolean;
  /** `tooltip=` (`:6084-6086`, `bbcode_options` form only) — accessibility metadata, draws nothing. */
  tooltip: string;
  /** `alt=` (`:6040-6043`) — accessibility metadata, draws nothing; read unconditionally like `color`/`region`. */
  altText: string;
  alignment: ParsedImageAlignment;
}

// A tag is `[name]`, `[name=value]`, `[name attr=...]`, or a `[/name]` close.
// `value` (the `=...` form) is taken verbatim, spaces and all — Godot does not
// trim it either, and each tag decides for itself what its payload means. The
// space-attribute form is matched but its attributes are ignored.
const OPEN = /^\[([a-zA-Z_][a-zA-Z0-9_]*)(?:=([^\]]*)|\s[^\]]*)?\]$/;
const CLOSE = /^\[\/([a-zA-Z_][a-zA-Z0-9_]*)\]$/;

/**
 * Every tag identifier `RichTextLabel::append_text`'s dispatch chain answers to
 * (`rich_text_label.cpp:5416-6545`) — its `tag == "…"` / `bbcode_name == "…"` /
 * `tag.begins_with("…=")` arms, including the built-in effects (`wave`,
 * `shake`, `tornado`, `fade`, `pulse`, `rainbow`).
 *
 * This is deliberately much wider than the set this painter STYLES. Three
 * outcomes, not two: a tag we style, a tag Godot consumes that we draw
 * unstyled, and a tag Godot never recognised — and only the third renders as
 * literal text. Collapsing the middle case into the third would start painting
 * `[url=…]` where Godot paints the link's text, which is a worse divergence
 * than the silent strip it replaced.
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
 * The identifiers whose `append_text` arm `add_text(...)`s and sets
 * `pos = brk_end + 1` WITHOUT ever reaching `tag_stack.push_front(tag)`
 * (`rich_text_label.cpp:5623-5680,5743-5745,5955`): they are complete in
 * themselves, so they take no close tag — and pushing one would make the NEXT
 * close tag miss the innermost-only match at `:5386` and turn literal.
 *
 * The value is what the arm adds to the text, verbatim. `[br]` really is a bare
 * CR: `is_linebreak()` (`char_utils.h:124`) covers 0x0A-0x0D, so TextServer
 * breaks the line on it. `[hr]` draws a rule instead of adding text, and
 * `[char=hex]` computes its own, so both sit outside this table.
 */
const SELF_CLOSING_TEXT: ReadonlyMap<string, string> = new Map([
  ['lb', '['],
  ['rb', ']'],
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
  // 0x2027 HYPHENATION POINT, not the 0x2067 RLI this tag names — Godot's own
  // constant, ported as written rather than as intended.
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
 * What a self-closing tag contributes to the surrounding run, or `null` when
 * `name` is not one. `[char=hex]` is `String::chr(value.hex_to_int())`
 * (`:5623-5626`); an unparseable or out-of-range value contributes nothing
 * rather than a lone surrogate the layout would then have to survive.
 */
function selfClosingText(name: string, value: string | undefined): string | null {
  const fixed = SELF_CLOSING_TEXT.get(name);
  if (fixed !== undefined) return fixed;
  if (SELF_CLOSING_SILENT.has(name)) return '';
  if (name !== 'char') return null;
  const codePoint = parseInt(value ?? '', 16);
  // The surrogate range is inside 0..0x10FFFF but has no scalar value, so
  // `String.fromCodePoint` would emit the lone surrogate this guard exists to suppress.
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

/** `String::unquote()` (`ustring.cpp:5575-5581`): strips a MATCHED leading/trailing `"` or `'` pair; anything else (including a lone quote) is returned as-is. */
function unquoteMatchedPair(s: string): string {
  if (s.length < 2) return s;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  if ((first === '"' || first === "'") && first === last) return s.slice(1, -1);
  return s;
}

/**
 * `RichTextLabel::_find_unquoted` + `_split_unquoted`
 * (`rich_text_label.cpp:5243-5301`): splits `src` on `splitter`, skipping one
 * inside a single- or double-quoted run, and drops empty pieces (two adjacent
 * splitters, or one at either edge) exactly like the source's `end > from` guard.
 */
function splitUnquoted(src: string, splitter: string): string[] {
  const out: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i <= src.length; i++) {
    const atEnd = i === src.length;
    const ch = atEnd ? splitter : src[i]!;
    // The end-of-string split is unconditional — an unterminated quote still yields its
    // tail piece (`_split_unquoted`, `rich_text_label.cpp:5290-5296`: no quote check there).
    if (!atEnd && !inSingle && ch === '"') inDouble = !inDouble;
    else if (!atEnd && !inDouble && ch === "'") inSingle = !inSingle;
    else if (atEnd || (!inSingle && !inDouble && ch === splitter)) {
      if (i > start) out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return out;
}

// `InlineAlignment` (`core/math/math_defs.h:94-113`), transcribed verbatim —
// two 2-bit fields combined with plain `|`, not two independent flags. Ported
// at this level (rather than as two clean optional string fields) because
// Godot's own bbcode parser assigns the image-point field with `=` but
// accumulates the text-point field with `|=` ONTO WHATEVER IT ALREADY WAS:
// when subtag[0] does not match, the DEFAULT's text bits (`CENTER`'s own
// `0b01`) survive into the `|=`, and `0b01 | INLINE_ALIGNMENT_TO_BASELINE
// (0b10) == 0b11 == INLINE_ALIGNMENT_TO_BOTTOM` — `[img=xyz,baseline]`
// (an unrecognised first subtag) resolves to text-point BOTTOM, not baseline.
// A clean string-enum re-implementation cannot reproduce that without
// separately special-casing it, so the bits are carried through instead.
const IMAGE_TO = { top: 0b0000, center: 0b0001, bottom: 0b0010 } as const;
const TO_TEXT = { top: 0b0000, center: 0b0100, baseline: 0b1000, bottom: 0b1100 } as const;
const IMAGE_MASK = 0b0011;
const TEXT_MASK = 0b1100;
const ALIGNMENT_CENTER = IMAGE_TO.center | TO_TEXT.center;

/** One `top`/`t`/`center`/`c`/`bottom`/`b` keyword to its `IMAGE_TO` field value, or `undefined` for anything else (`:6001-6010`/`:6095-6104`'s `if`-chain has no `else`). */
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

/** One `top`/`t`/`center`/`c`/`baseline`/`l`/`bottom`/`b` keyword to its `TO_TEXT` field value, or `undefined` for anything else (`:6006-6011`/`:6111-6117`). */
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

/** `IMAGE_TO`/`TO_TEXT` field values back to this module's named shape — the bitfield never needs to leave `parseImgTag`'s own computation otherwise. */
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
 * The shared subtag-list parse both the `[img=...]` value form and the
 * `align=` option form run (`:5989-6011` / `:6095-6117`) — comma-split,
 * unquoted, one or two pieces; the SAME `int alignment` accumulation both
 * call sites perform, starting from `INLINE_ALIGNMENT_CENTER` every time.
 */
function parseAlignmentSubtags(value: string): ParsedImageAlignment {
  const subtag = splitUnquoted(value, ',').map(unquoteMatchedPair);
  let alignment = ALIGNMENT_CENTER;
  if (subtag.length > 1) {
    const image = matchImagePoint(subtag[0]!);
    if (image !== undefined) alignment = image; // `=`, not `|=` — see this section's own doc for why that zeroes the text bits.
    const text = matchTextPoint(subtag[1]!);
    if (text !== undefined) alignment |= text;
  } else if (subtag.length === 1) {
    const image = matchImagePoint(subtag[0]!);
    if (image !== undefined) alignment = image | (image === IMAGE_TO.top ? TO_TEXT.top : image === IMAGE_TO.bottom ? TO_TEXT.bottom : TO_TEXT.center);
  }
  return decodeInlineAlignment(alignment);
}

/** `String::to_int()`-then-`%`-suffix pair — `width`/`height`'s shared "N" or "N%" spelling (`:6062-6084`). */
function parseSizeValue(value: string): { amount: number; inPercent: boolean } {
  return { amount: stringToInt(value), inPercent: value.endsWith('%') };
}

/**
 * `RichTextLabel::append_text`'s `img` arm (`rich_text_label.cpp:5990-6146`),
 * given the tag's raw content (without the outer `[`/`]`, e.g.
 * `"img=100x50 color=red"`) and the already-extracted path.
 *
 * `bbcode_name`/`bbcode_value`/`bbcode_options` (`:5357-5382`): split on
 * unquoted spaces; the first piece's own `=value` (if any) is `bbcode_value`;
 * every later `key=value` piece lands in `bbcode_options`.
 *
 * `color`/`region`/`alt` are read from `bbcode_options` UNCONDITIONALLY
 * (`:6032-6043`). `width`/`height`/`align`/`tooltip`/`pad` are mutually
 * exclusive between the two forms (`:6062-6141`): a non-empty `bbcode_value`
 * (the `img=...` form) is parsed as `W` or `WxH` and `bbcode_options` for
 * those five keys is never consulted at all — so `[img=top]` leaves `width`
 * at 0 (`"top".to_int()` is 0) rather than falling through to any
 * `width=`/`align=` option written alongside it.
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

/**
 * Tokenizes `text` into runs, each carrying the FULL stack of tags open at
 * that point (outermost first, innermost/most-recently-opened last).
 *
 * A scan rather than a split, because Godot's own scan
 * (`RichTextLabel::append_text`) does two things a split cannot express. An
 * identifier it does not recognise emits a literal `[` and resumes from the
 * NEXT CHARACTER (`:6543-6544`'s `pos = brk_pos + 1`), so a real tag written
 * inside a bogus one still opens; and a close tag is only honoured when it
 * matches `tag_stack.front()` (`:5386`) — the INNERMOST open tag — otherwise
 * it too becomes literal text and leaves the stack untouched.
 *
 * Adjacent text carrying the same stack merges into one run, so a literal
 * bracket never fragments the text around it into separate runs (and separate
 * meshes) for a difference no painter can see.
 */
function sameTags(a: readonly OpenBBCodeTag[], b: readonly OpenBBCodeTag[]): boolean {
  return a.length === b.length && a.every((t, i) => t.name === b[i]!.name && t.value === b[i]!.value);
}

/** The next `[` at or after `from`, or the end of the string — `:6026-6029`. */
function nextBracket(text: string, from: number): number {
  const at = text.indexOf('[', from);
  return at < 0 ? text.length : at;
}

export function parseBBCodeRuns(text: string): BBCodeRun[] {
  const stack: OpenBBCodeTag[] = [];
  const runs: BBCodeRun[] = [];
  let pending = '';

  function flush(): void {
    if (!pending) return;
    // Merged rather than appended when the stack is unchanged: a tag that
    // opens and closes around no text of its own — `[hr]`'s silent consumption,
    // say — would otherwise split the text either side of it into separate
    // runs, and separate meshes, for a difference no painter can see. Never
    // merged into an IMAGE run though its stack matches too: that run's own
    // `text` is the one-character object placeholder, not real text, and
    // appending to it would corrupt the placeholder a painter keys off.
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
        // `[img]`'s payload is the image's resource path, not text: Godot reads
        // it as far as the next `[` (the whole remainder when none follows) and
        // resumes there (`rich_text_label.cpp:6026-6031,6145`).
        const imgEnd = nextBracket(text, brkEnd + 1);
        const path = text.slice(brkEnd + 1, imgEnd);
        flush();
        // `ResourceLoader::load(image, "Texture2D")` failing (`:6034`, an empty
        // or unloadable path) adds no `ItemImage` and no object glyph at all —
        // the tag still opens (`:6145`'s unconditional `tag_stack.push_front`)
        // but this run never appears, same as any other Godot texture-load miss.
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
 * (`:372-390`): an optional leading `#`, then exactly 3/4/6/8 hex digits —
 * `#rgb`/`#rgba` (each digit repeated, i.e. divided by 15) or `#rrggbb`/
 * `#rrggbbaa` (divided by 255). Alpha defaults to 1 for the 3/6-digit forms.
 * Returns `undefined` (not a fallback) so `resolveBBColor` can tell "not hex"
 * from "hex but somehow invalid" apart from every other rejection path.
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
 * Resolves a `[color=value]` payload to a linear-ready `ControlColor`.
 *
 * Real Godot's `[color=...]` goes through `Color::from_string` (`rich_text_
 * label.cpp:6149`, `color.cpp:450-456`), which tries `Color::html` first
 * (hex, with or without `#`) and otherwise looks up `value` in Godot's
 * 146-entry X11 named-color table, falling back to `p_default` — NOT white —
 * when nothing matches. There is no branch for a GDScript `Color(r, g, b, a)`
 * constructor literal: passing that string to real Godot bbcode resolves to
 * the fallback, exactly like any other unrecognised name.
 *
 * The table itself is `utils/godotNamedColor.ts`, transcribed from
 * `core/math/color_names.inc`; a name it does not carry falls back to
 * `fallback`, which is `Color::from_string`'s own contract for an
 * unrecognised name.
 */
export function resolveBBColor(value: string, fallback: ControlColor): ControlColor {
  return parseHtmlHex(value) ?? godotNamedColor(value) ?? fallback;
}
