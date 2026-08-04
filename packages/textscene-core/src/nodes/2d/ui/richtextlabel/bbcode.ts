/**
 * Framework-free BBCode tokenizer for RichTextLabel's supported subset
 * (best-effort [b]/[i]/[u]/[s]/[color]/[center]/[code], not full BBCode).
 * `parseBBCodeRuns` produces the tag-stack/nesting semantics; the native
 * painter (`nativeSolver.ts`'s `styledTextRuns`) turns a run's tags into
 * `{bold, italic, color}` (its own explicit non-goal: only `[b]`/`[i]`/
 * `[color]` affect native styling — every other recognised tag still
 * tokenizes correctly, for stack/nesting fidelity, but contributes no native
 * effect, same as an unrecognised tag).
 */

import type { ControlColor } from '../control/types';

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
const TOKEN = /(\[\/?[a-zA-Z][^\]]*\])/g;
const OPEN = /^\[([a-zA-Z]+)(?:=([^\]]*)|\s[^\]]*)?\]$/;
const CLOSE = /^\[\/([a-zA-Z]+)\]$/;

/**
 * Tokenizes `text` into runs, each carrying the FULL stack of tags open at
 * that point (outermost first, innermost/most-recently-opened last) — the
 * same merge-by-stack behaviour `bbcode.tsx` used to do inline, just stopping
 * short of turning it into CSS or a native style flag.
 */
export function parseBBCodeRuns(text: string): BBCodeRun[] {
  const stack: OpenBBCodeTag[] = [];
  const runs: BBCodeRun[] = [];

  for (const part of text.split(TOKEN)) {
    if (!part) continue;

    const open = OPEN.exec(part);
    if (open) {
      stack.push({ name: open[1]!.toLowerCase(), value: open[2] });
      continue;
    }

    const close = CLOSE.exec(part);
    if (close) {
      const name = close[1]!.toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.name === name) {
          stack.splice(i, 1);
          break;
        }
      }
      continue;
    }

    runs.push({ text: part, tags: [...stack] });
  }

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
 * (hex, with or without `#`) and otherwise looks up `value` in Godot's ~150-
 * entry X11/CSS named-color table, falling back to `p_default` — NOT white —
 * when nothing matches. There is no branch for a GDScript `Color(r, g, b, a)`
 * constructor literal: passing that string to real Godot bbcode resolves to
 * the fallback, exactly like any other unrecognised name.
 *
 * The full named-color table is NOT reproduced here (out of this packet's
 * bbcode scope, `[b]`/`[i]`/`[color]`); an unmatched name — including a CSS
 * keyword real Godot WOULD resolve, e.g. `red` — falls back to `fallback`,
 * which is exactly `Color::from_string`'s own contract for a name it does not
 * recognise, just with a smaller recognised set.
 */
export function resolveBBColor(value: string, fallback: ControlColor): ControlColor {
  return parseHtmlHex(value) ?? fallback;
}
