/**
 * The script runs of a text, as Godot's `ScriptIterator` splits it (`script_iterator.cpp`, from ICU's
 * `scrptrun`). Godot shapes each script run apart (`text_server_adv.cpp:7346-7352`), so kerning and
 * the rounding remainder stop where the script changes.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

/** ICU's `USCRIPT_COMMON` and `USCRIPT_INHERITED`: a script at or below `INHERITED` joins any run. */
const COMMON = 0;
const INHERITED = 1;

/**
 * The ISO 15924 code of every script the ECMAScript `Script` property names, past Common
 * (`Zyyy`), Inherited (`Zinh`, `Qaai`) and the alias `Qaac` of Coptic. `Zzzz` is Unknown: an
 * unassigned code point has it, and ICU gives it a run of its own as any other script.
 */
const SCRIPT_CODES = (
  'Latn Hani Cyrl Arab Grek Hebr Deva Hang Hira Kana Thai Zzzz Adlm Aghb Ahom Armi Armn Avst Bali ' +
  'Bamu Bass Batk Beng Berf Bhks Bopo Brah Brai Bugi Buhd Cakm Cans Cari Cham Cher Chrs Copt Cpmn ' +
  'Cprt Diak Dogr Dsrt Dupl Egyp Elba Elym Ethi Gara Geor Glag Gong Gonm Goth Gran Gujr Gukh Guru ' +
  'Hano Hatr Hluw Hmng Hmnp Hung Ital Java Kali Kawi Khar Khmr Khoj Kits Knda Krai Kthi Lana Laoo ' +
  'Lepc Limb Lina Linb Lisu Lyci Lydi Mahj Maka Mand Mani Marc Medf Mend Merc Mero Miao Mlym Modi ' +
  'Mong Mroo Mtei Mult Mymr Nagm Nand Narb Nbat Newa Nkoo Nshu Ogam Olck Onao Orkh Orya Osge Osma ' +
  'Ougr Palm Pauc Perm Phag Phli Phlp Phnx Plrd Prti Rjng Rohg Runr Samr Sarb Saur Sgnw Shaw Shrd ' +
  'Sidd Sidt Sind Sinh Sogd Sogo Sora Soyo Sund Sunu Sylo Syrc Tagb Takr Tale Talu Taml Tang Tavt ' +
  'Tayo Telu Tfng Tglg Thaa Tibt Tirh Tnsa Todr Tols Toto Tutg Ugar Vaii Vith Wara Wcho Xpeo Xsux ' +
  'Yezi Yiii Zanb'
).split(' ');

/**
 * A matcher for each script the engine knows, in `SCRIPT_CODES` order. An engine older than a
 * script's Unicode version refuses its name, and no character of it then reaches a matcher.
 */
const SCRIPT_MATCHERS: readonly RegExp[] = SCRIPT_CODES.flatMap((code) => {
  try {
    return [new RegExp(`^\\p{sc=${code}}`, 'u')];
  } catch {
    return [];
  }
});

const COMMON_CHAR = /^\p{sc=Zyyy}/u;
const INHERITED_CHAR = /^\p{sc=Zinh}/u;

/** Written only by `scriptOf`, one entry per code point it has read. It never clears. */
const scriptCache = new Map<number, number>();

/**
 * `uscript_getScript`: `COMMON`, `INHERITED`, or 2 past the index of the character's matcher.
 * Every character has one: `Zzzz` matches each code point the engine's Unicode leaves unassigned.
 */
function scriptOf(ch: string): number {
  const cp = ch.codePointAt(0)!;
  const cached = scriptCache.get(cp);
  if (cached !== undefined) return cached;
  let script: number;
  if (COMMON_CHAR.test(ch)) script = COMMON;
  else if (INHERITED_CHAR.test(ch)) script = INHERITED;
  else script = 2 + SCRIPT_MATCHERS.findIndex((matcher) => matcher.test(ch));
  scriptCache.set(cp, script);
  return script;
}

const EMOJI = /^\p{Emoji}/u;
const EXTENDED_PICTOGRAPHIC = /^\p{Extended_Pictographic}/u;
const EMOJI_PRESENTATION = /^[\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}]/u;
const ZERO_WIDTH_JOINER = '\u200d';
const VARIATION_SELECTOR_15 = '\ufe0e';
const VARIATION_SELECTOR_16 = '\ufe0f';
const COMBINING_ENCLOSING_KEYCAP = '\u20e3';

/** The emoji properties of a code point, as bits. */
const IS_EMOJI = 1;
const IS_PICTOGRAPHIC = 2;
const IS_PRESENTATION = 4;

/** Written only by `emojiBitsOf`, one entry per code point it has read. It never clears. */
const emojiBitsCache = new Map<number, number>();

function emojiBitsOf(ch: string): number {
  const cp = ch.codePointAt(0)!;
  let bits = emojiBitsCache.get(cp);
  if (bits === undefined) {
    bits =
      (EMOJI.test(ch) ? IS_EMOJI : 0) |
      (EXTENDED_PICTOGRAPHIC.test(ch) ? IS_PICTOGRAPHIC : 0) |
      (EMOJI_PRESENTATION.test(ch) ? IS_PRESENTATION : 0);
    emojiBitsCache.set(cp, bits);
  }
  return bits;
}

/** `ScriptIterator::is_emoji`: whether `ch`, with `next` after it, starts or continues an emoji run. */
function isEmoji(ch: string, next: string | undefined): boolean {
  const bits = emojiBitsOf(ch);
  const isEmojiOrPictograph = (bits & (IS_EMOJI | IS_PICTOGRAPHIC)) !== 0;
  if (next === VARIATION_SELECTOR_15 && isEmojiOrPictograph) return false;
  if (next === VARIATION_SELECTOR_16 && isEmojiOrPictograph) return true;
  return (bits & IS_PRESENTATION) !== 0;
}

/** Whether `ch`, with `next` after it, keeps an emoji run open (`script_iterator.cpp:111`). */
function continuesEmoji(ch: string, next: string | undefined): boolean {
  return (
    ch === ZERO_WIDTH_JOINER ||
    ch === VARIATION_SELECTOR_16 ||
    ch === COMBINING_ENCLOSING_KEYCAP ||
    ((emojiBitsOf(ch) & IS_PICTOGRAPHIC) !== 0 && next !== VARIATION_SELECTOR_15)
  );
}

interface OpenBracket {
  /** The opening bracket. */
  readonly ch: string;
  /** The script of the run it opened in, or the run's script once known. */
  script: number;
}

/** `[start, end)` in UTF-16 units. */
type Range = [number, number];

/**
 * The run index of each UTF-16 unit of `text`: one run per script run, and one per emoji stretch
 * inside it. A Common or Inherited character joins the run around it, and a closing bracket takes
 * the script of its opening bracket.
 */
export function scriptRunIds(text: string): Int32Array {
  const ids = new Int32Array(text.length);
  const codePoints = codePointsOf(text);
  // The bracket stack outlives each run, and so does `startDepth` (`script_iterator.cpp:83-84`).
  const brackets: OpenBracket[] = [];
  let startDepth = -1;
  let runId = 0;
  let k = 0;
  while (k < codePoints.length) {
    const runStart = k;
    let runScript = COMMON;
    const emojiRanges: Range[] = [];
    let emojiStart = -1;
    for (; k < codePoints.length; k++) {
      const [ch, at] = codePoints[k]!;
      const next = codePoints[k + 1]?.[0];
      if (isEmoji(ch, next)) {
        if (emojiStart < 0) emojiStart = at;
      } else if (emojiStart >= 0 && !continuesEmoji(ch, next)) {
        emojiRanges.push([emojiStart, at]);
        emojiStart = -1;
      }
      let script = scriptOf(ch);
      const closes = bidi.closingToOpeningBracket(ch);
      if (bidi.openingToClosingBracket(ch)) {
        brackets.push({ ch, script: runScript });
      } else if (closes && brackets.length > 0) {
        while (brackets.length > 0 && brackets.at(-1)!.ch !== closes) brackets.pop();
        startDepth = Math.min(startDepth, brackets.length - 1);
        if (brackets.length > 0) script = brackets.at(-1)!.script;
      }
      if (!isSameScript(runScript, script)) break;
      if (runScript <= INHERITED && script > INHERITED) {
        runScript = script;
        // The brackets opened before the run knew its script take it now.
        while (startDepth < brackets.length - 1) brackets[++startDepth]!.script = runScript;
      }
      if (closes && brackets.length > 0) {
        brackets.pop();
        if (startDepth >= 0) startDepth--;
      }
    }
    const runEnd = k < codePoints.length ? codePoints[k]![1] : text.length;
    if (emojiStart >= 0) emojiRanges.push([emojiStart, runEnd]);
    runId = fillScriptRun(ids, [codePoints[runStart]![1], runEnd], emojiRanges, runId);
  }
  return ids;
}

/**
 * Numbers the UTF-16 units of one script run `[start, end)` from `firstId`: each emoji stretch,
 * and each stretch between two, takes the next number (`script_iterator.cpp:176-203`).
 * Answers the next free number.
 */
function fillScriptRun(
  ids: Int32Array,
  [start, end]: Range,
  emojiRanges: readonly Range[],
  firstId: number
): number {
  let runId = firstId;
  let from = start;
  for (const [emojiStart, emojiEnd] of emojiRanges) {
    if (emojiStart > from) ids.fill(runId++, from, emojiStart);
    ids.fill(runId++, emojiStart, emojiEnd);
    from = emojiEnd;
  }
  if (from < end) ids.fill(runId++, from, end);
  return runId;
}

/** `ScriptIterator::same_script`. */
function isSameScript(a: number, b: number): boolean {
  return a <= INHERITED || b <= INHERITED || a === b;
}

/** Each code point of `text` with the UTF-16 index it starts at. */
function codePointsOf(text: string): Array<[string, number]> {
  const codePoints: Array<[string, number]> = [];
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    codePoints.push([ch, i]);
    i += ch.length;
  }
  return codePoints;
}
