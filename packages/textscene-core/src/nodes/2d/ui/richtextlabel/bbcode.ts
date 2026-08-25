/**
 * Framework-free BBCode tokenizer for RichTextLabel's supported subset
 * (best-effort [b]/[i]/[u]/[s]/[color]/[center]/[code], not full BBCode).
 * `parseBBCodeRuns` produces the tag-stack/nesting semantics; the native
 * painter (`nativeSolver.ts`'s `styledTextRuns`) turns a run's tags into
 * `{bold, italic, color}` (its own explicit non-goal: only `[b]`/`[i]`/
 * `[color]` affect native styling — every other tag Godot RECOGNISES still
 * tokenizes correctly, for stack/nesting fidelity, but contributes no native
 * effect).
 *
 * A tag Godot does not recognise is a different case entirely: it is not a tag
 * at all, and renders as literal text exactly as the engine renders it. See
 * `parseBBCodeRuns`.
 */

import type { ControlColor } from '../control/types';
import { godotNamedColor } from '../../../../utils/godotNamedColor';

/** One currently-open BBCode tag. `value` is the `[name=value]` payload, if the tag carries one. */
export interface OpenBBCodeTag {
  /** Lowercased tag name, e.g. `'b'`, `'color'`. */
  name: string;
  /** The `=value` portion, verbatim — absent for a bare `[name]` or the space-attribute form. */
  value?: string;
}

/** A run of plain (tag-stripped) text plus every tag open at that point, outermost first. */
export interface BBCodeRun {
  text: string;
  tags: readonly OpenBBCodeTag[];
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
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '';
  return String.fromCodePoint(codePoint);
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
export function parseBBCodeRuns(text: string): BBCodeRun[] {
  const stack: OpenBBCodeTag[] = [];
  const runs: BBCodeRun[] = [];
  let pending = '';

  function flush(): void {
    if (pending) {
      runs.push({ text: pending, tags: [...stack] });
      pending = '';
    }
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
