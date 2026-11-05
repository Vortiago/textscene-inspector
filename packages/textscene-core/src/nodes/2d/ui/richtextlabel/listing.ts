/**
 * The indent and the marker of each RichTextLabel line inside an `[indent]`, `[ul]` or `[ol]`:
 * `_find_margin`, `_find_list`, `_get_prefix` and `_add_list_prefixes`
 * (`scene/gui/rich_text_label.cpp:196-373,3367-3460`). A row is one paragraph of the plain text, Godot's `Line`.
 * Pure math, no THREE or React.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { formatNumber } from '../../../../godot/text/numberFormat';
import type { Rgba } from '../../../../godot/math/math';
import { getFontTabWidthPx } from '../../../../r3f/controls/native/text/fontMetrics';
import {
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import {
  IMAGE_OBJECT_CHAR,
  INDENT_TAGS,
  hasOpenTag,
  lastTagValue,
  resolveBBColor,
  type OpenBBCodeTag,
} from './bbcode';
import { faceOfStyle, type RichTextFaces } from './styleFaces';
import type { StyledTextRun } from './nativeSolver';

/** `ItemList`'s default bullet (`rich_text_label.cpp:7593`). */
const DEFAULT_BULLET = '•';

/** An `[indent]`, `[ul]` or `[ol]` open at a run, and the font that encloses it (`_find_margin` reads its space advance). */
export interface IndentFrame {
  tag: OpenBBCodeTag;
  bold: boolean;
  italic: boolean;
  fontSizePx: number;
}

/** The font and colour of a list marker, as `formatting_items` give them in `_add_list_prefixes`. */
export interface MarkerStyle {
  bold: boolean;
  italic: boolean;
  fontSizePx: number;
  color: Rgba;
}

/** What a run inside an indent or a list tells the layout. Absent on every other run. */
export interface RunListing {
  /** The frames of the run's tags. */
  frames: readonly IndentFrame[];
  /** The frames of the tags a line that starts at this run's first character has, when they differ from `frames`. */
  startFrames?: readonly IndentFrame[];
  /** The marker's style on a line whose first character is text: the outermost colour, the run's font. */
  textRowMarker: MarkerStyle;
  /** The marker's style on an empty line that starts at this run's first character. */
  emptyRowMarkerAtStart: MarkerStyle;
  /** The marker's style on an empty line that starts later in the run. */
  emptyRowMarkerLater: MarkerStyle;
}

export interface RunListingInputs {
  tags: readonly OpenBBCodeTag[];
  startTags: readonly OpenBBCodeTag[] | undefined;
  /** `BBCodeRun.openedAtStart`. */
  openedAtStart: readonly OpenBBCodeTag[] | undefined;
  defaultColor: Rgba;
  /** The run font size of a `[b]` and `[i]` state (`resolveRunFontSizePx`). */
  fontSizePxOf: (bold: boolean, italic: boolean) => number;
}

function indentFramesOf(
  tags: readonly OpenBBCodeTag[],
  fontSizePxOf: RunListingInputs['fontSizePxOf']
): IndentFrame[] {
  const frames: IndentFrame[] = [];
  tags.forEach((tag, index) => {
    if (!INDENT_TAGS.has(tag.name)) return;
    const enclosing = tags.slice(0, index);
    const bold = hasOpenTag(enclosing, 'b');
    const italic = hasOpenTag(enclosing, 'i');
    frames.push({ tag, bold, italic, fontSizePx: fontSizePxOf(bold, italic) });
  });
  return frames;
}

function colorOf(value: string | undefined, fallback: Rgba): Rgba | undefined {
  return value === undefined ? undefined : resolveBBColor(value, fallback);
}

function styleOf(bold: boolean, italic: boolean, color: Rgba, inputs: RunListingInputs): MarkerStyle {
  return { bold, italic, fontSizePx: inputs.fontSizePxOf(bold, italic), color };
}

/**
 * The text item's parents all format the marker, and each colour overwrites the last, so the
 * outermost colour wins (`rich_text_label.cpp:342-349`).
 */
function textRowMarkerStyle(inputs: RunListingInputs): MarkerStyle {
  const { tags, defaultColor } = inputs;
  const color = colorOf(tags.find((tag) => tag.name === 'color')?.value, defaultColor) ?? defaultColor;
  return styleOf(hasOpenTag(tags, 'b'), hasOpenTag(tags, 'i'), color, inputs);
}

/**
 * An empty line has no text item, so the marker takes the formatting items opened at its first
 * character (`:312-321`). Each overwrites the last, so the innermost colour wins, and the colour of
 * the line's own tags (`_find_color`) fills in. A `[b]` or `[i]` opened there makes a font item with the
 * other open style folded in.
 */
function emptyRowMarkerStyle(
  inputs: RunListingInputs,
  openedHere: readonly OpenBBCodeTag[],
  lineTags: readonly OpenBBCodeTag[]
): MarkerStyle {
  const { tags, defaultColor } = inputs;
  const opensFont = openedHere.some((tag) => tag.name === 'b' || tag.name === 'i');
  const color =
    colorOf(lastTagValue(openedHere, 'color'), defaultColor) ??
    colorOf(lastTagValue(lineTags, 'color'), defaultColor) ??
    defaultColor;
  return opensFont
    ? styleOf(hasOpenTag(tags, 'b'), hasOpenTag(tags, 'i'), color, inputs)
    : styleOf(false, false, color, inputs);
}

/** The listing of the run `inputs` describe, or `undefined` when no indent or list is open. */
export function runListing(inputs: RunListingInputs): RunListing | undefined {
  const { tags, startTags, openedAtStart = [], fontSizePxOf } = inputs;
  const frames = indentFramesOf(tags, fontSizePxOf);
  const startFrames = startTags && indentFramesOf(startTags, fontSizePxOf);
  if (frames.length === 0 && !startFrames?.length) return undefined;
  return {
    frames,
    startFrames,
    textRowMarker: textRowMarkerStyle(inputs),
    emptyRowMarkerAtStart: emptyRowMarkerStyle(inputs, openedAtStart, startTags ?? tags),
    emptyRowMarkerLater: emptyRowMarkerStyle(inputs, [], tags),
  };
}

// ── Markers ──

/** `RichTextLabel::ListType`, with the options a tag carries. */
type ListKind =
  | { type: 'dots'; bullet: string }
  | { type: 'numbers' }
  | { type: 'letters'; capitalise: boolean }
  | { type: 'roman'; capitalise: boolean };

/** `[ul bullet=...]`, else `[ol type=...]` (`rich_text_label.cpp:5702-5742`). The tokenizer admits only the forms Godot opens. */
function listKindOf(tag: OpenBBCodeTag): ListKind {
  if (tag.name === 'ul') return { type: 'dots', bullet: tag.value ?? DEFAULT_BULLET };
  switch (tag.options?.get('type')) {
    case 'a':
      return { type: 'letters', capitalise: false };
    case 'A':
      return { type: 'letters', capitalise: true };
    case 'i':
      return { type: 'roman', capitalise: false };
    case 'I':
      return { type: 'roman', capitalise: true };
    default:
      return { type: 'numbers' };
  }
}

const ROMAN_DIGITS = {
  thousands: ['', 'm', 'mm', 'mmm'],
  hundreds: ['', 'c', 'cc', 'ccc', 'cd', 'd', 'dc', 'dcc', 'dccc', 'cm'],
  tens: ['', 'x', 'xx', 'xxx', 'xl', 'l', 'lx', 'lxx', 'lxxx', 'xc'],
  ones: ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'],
};

/** `_roman` (`rich_text_label.cpp:195-217`): past 3999 it writes `ERR`. */
function romanNumeral(number: number, capitalise: boolean): string {
  if (number > 3999) return 'ERR';
  const { thousands, hundreds, tens, ones } = ROMAN_DIGITS;
  const numeral =
    thousands[Math.trunc(number / 1000)]! +
    hundreds[Math.trunc((number % 1000) / 100)]! +
    tens[Math.trunc((number % 100) / 10)]! +
    ones[number % 10]!;
  return capitalise ? numeral.toUpperCase() : numeral;
}

/**
 * `_letters` (`:219-241`): base-24 digits written as `a + digit - 1`, so a multiple of 24 writes the
 * character before `a`. Godot's own arithmetic, ported as written.
 */
function letterNumeral(number: number, capitalise: boolean): string {
  const base = capitalise ? 'A'.charCodeAt(0) : 'a'.charCodeAt(0);
  const digits: string[] = [];
  let rest = number;
  do {
    digits.unshift(String.fromCharCode(base + Math.abs(rest % 24) - 1));
    rest = Math.trunc(rest / 24);
  } while (rest !== 0);
  return digits.join('');
}

/**
 * `_get_prefix` (`:242-270`). `kinds` and `indexes` run innermost list first. A bullet ends the walk,
 * and stands alone when no number came before it. `writeNumber` writes a plain number (`:255-258`).
 */
function markerText(
  kinds: readonly ListKind[],
  indexes: readonly number[],
  writeNumber: (number: number) => string
): string {
  let marker = '';
  let segments = 0;
  for (const [position, kind] of kinds.entries()) {
    if (kind.type === 'dots') {
      if (segments === 0) marker = kind.bullet;
      break;
    }
    const index = indexes[position]!;
    const segment =
      kind.type === 'numbers'
        ? writeNumber(index)
        : kind.type === 'letters'
          ? letterNumeral(index, kind.capitalise)
          : romanNumeral(index, kind.capitalise);
    marker = `${segment}.${marker}`;
    segments++;
  }
  return `${marker} `;
}

// ── Paragraphs ──

/** What the layout takes from a paragraph in an indent or a list. */
export interface ParagraphListing {
  /** The paragraph's left inset, px: its margin plus the widest marker of its list (`l.indent`, `:472`). */
  indentPx: number;
  /** The marker, on the paragraphs of a list whose first line carries it. */
  marker?: ListMarker;
}

/** A shaped list marker. It draws at the line's top, in its own font (`_draw_line`, `:1017-1039`). */
export interface ListMarker {
  layout: TextLayoutResult;
  fontSizePx: number;
  /** The size `TextParagraph::get_size()` reports: the ceiled width. */
  widthPx: number;
  color: Rgba;
}

type ListingRun = Pick<StyledTextRun, 'text' | 'listing' | 'bidi'>;

/** One line of the plain text, and the run its first character is in. */
interface Row {
  paragraphStart: number;
  run: ListingRun;
  /** Whether the line starts at the run's first character. */
  startsRun: boolean;
  firstCharacter: string;
  frames: readonly IndentFrame[];
}

interface RowTable {
  rows: Row[];
  /** The line each frame's tag first covers a character on (`Item::line` of the list item). */
  firstRowOf: Map<OpenBBCodeTag, number>;
}

/** The marker's style: a line that opens on text takes the text's, an empty one (`\n` or an image) the formatting opened at its start. */
function rowMarkerStyle(row: Row): MarkerStyle {
  const listing = row.run.listing!;
  if (row.firstCharacter !== '\n' && row.firstCharacter !== IMAGE_OBJECT_CHAR) return listing.textRowMarker;
  return row.startsRun ? listing.emptyRowMarkerAtStart : listing.emptyRowMarkerLater;
}

/** Every line of the runs' text, in order: the paragraphs `shapeText` splits at `\n`. */
function rowTableOf(runs: readonly ListingRun[]): RowTable {
  const rows: Row[] = [];
  const firstRowOf = new Map<OpenBBCodeTag, number>();
  let offset = 0;
  let startsRow = true;
  for (const run of runs) {
    const runFirstRow = startsRow ? rows.length : rows.length - 1;
    if (run.listing) {
      for (const frame of run.listing.frames) {
        if (!firstRowOf.has(frame.tag)) firstRowOf.set(frame.tag, runFirstRow);
      }
      for (const frame of run.listing.startFrames ?? []) {
        if (!firstRowOf.has(frame.tag)) firstRowOf.set(frame.tag, runFirstRow);
      }
    }
    for (let i = 0; i < run.text.length; i++) {
      if (startsRow) {
        const startsRun = i === 0;
        const { listing } = run;
        rows.push({
          paragraphStart: offset + i,
          run,
          startsRun,
          firstCharacter: run.text[i]!,
          frames: (startsRun && listing?.startFrames) || listing?.frames || [],
        });
        startsRow = false;
      }
      if (run.text[i] === '\n') startsRow = true;
    }
    offset += run.text.length;
  }
  return { rows, firstRowOf };
}

/** The lists of a line, innermost first, as `_find_list` collects them. */
function listsOf(row: Row): OpenBBCodeTag[] {
  return row.frames
    .filter((frame) => frame.tag.name !== 'indent')
    .map((frame) => frame.tag)
    .reverse();
}

/** The innermost list of a line, the one `_find_list_item` returns. */
function nearestListOf(row: Row): OpenBBCodeTag | undefined {
  for (let i = row.frames.length - 1; i >= 0; i--) {
    if (row.frames[i]!.tag.name !== 'indent') return row.frames[i]!.tag;
  }
  return undefined;
}

export interface ListingContext {
  faces: RichTextFaces;
  tabSize: number;
  /** `Control.localize_numeral_system`. */
  localizeNumeralSystem: boolean;
}

/**
 * `_find_margin` (`:3407-3460`): each indent and list adds `max(1, tab_size * space advance)` in the
 * font around it. The function returns an `int`, so the sum truncates.
 */
function marginPx(frames: readonly IndentFrame[], context: ListingContext): number {
  let margin = 0;
  for (const frame of frames) {
    const face = faceOfStyle(context.faces, frame);
    margin += getFontTabWidthPx(face, context.tabSize, frame.fontSizePx);
  }
  return Math.trunc(margin);
}

function shapeMarker(text: string, row: Row, faces: RichTextFaces): ListMarker {
  const style = rowMarkerStyle(row);
  const direction = row.run.bidi.direction;
  const layout = shapeText(text, {
    fontSizePx: style.fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics: faceOfStyle(faces, style),
    direction,
    paragraphSeparator: '\n',
    terminateLastParagraph: false,
  });
  return {
    layout,
    fontSizePx: style.fontSizePx,
    widthPx: shapedTextSizeWidthPx(layout.widthPx),
    color: style.color,
  };
}

/**
 * The listing of every paragraph that sits in an indent or a list, keyed by the plain-text index its
 * first character has. A paragraph outside both has no entry.
 */
export function paragraphListings(
  runs: readonly ListingRun[],
  context: ListingContext
): ReadonlyMap<number, ParagraphListing> {
  const listings = new Map<number, ParagraphListing>();
  if (!runs.some((run) => run.listing)) return listings;

  const { rows, firstRowOf } = rowTableOf(runs);
  // The lines below a list's own first line that have it as their innermost list.
  const rowsOfList = new Map<OpenBBCodeTag, number[]>();
  rows.forEach((row, rowIndex) => {
    const list = nearestListOf(row);
    if (list === undefined || rowIndex <= firstRowOf.get(list)!) return;
    const listRows = rowsOfList.get(list) ?? [];
    listRows.push(rowIndex);
    rowsOfList.set(list, listRows);
  });

  /** `_find_list`'s index of `list` for a line at or below `row`: the lines of the list up to it, plus one. */
  const indexOf = (list: OpenBBCodeTag, row: number): number =>
    1 + (rowsOfList.get(list) ?? []).filter((rowIndex) => rowIndex <= row).length;

  // `_add_list_prefixes` shapes a list's markers on its first line, so a list whose first line sits
  // outside it (a styling tag opens that line) has none and a zero marker width.
  const markers = new Map<number, ListMarker>();
  const markerWidthOfList = new Map<OpenBBCodeTag, number>();
  for (const [list, firstRow] of firstRowOf) {
    if (list.name === 'indent' || nearestListOf(rows[firstRow]!) !== list) continue;
    const lists = listsOf(rows[firstRow]!);
    const kinds = lists.map(listKindOf);
    const outerIndexes = lists.slice(1).map((outer, i) => indexOf(outer, firstRowOf.get(lists[i]!)!));
    let widestMarkerPx = 0;
    [firstRow, ...(rowsOfList.get(list) ?? [])].forEach((rowIndex, position) => {
      const row = rows[rowIndex]!;
      const { language } = row.run.bidi;
      const writeNumber = (number: number) =>
        context.localizeNumeralSystem ? formatNumber(String(number), language ?? '') : String(number);
      const text = markerText(kinds, [position + 1, ...outerIndexes], writeNumber);
      const marker = shapeMarker(text, row, context.faces);
      markers.set(rowIndex, marker);
      widestMarkerPx = Math.max(widestMarkerPx, marker.widthPx);
    });
    markerWidthOfList.set(list, widestMarkerPx);
  }

  rows.forEach((row, rowIndex) => {
    if (row.frames.length === 0) return;
    const list = nearestListOf(row);
    listings.set(row.paragraphStart, {
      indentPx: marginPx(row.frames, context) + (list ? (markerWidthOfList.get(list) ?? 0) : 0),
      marker: markers.get(rowIndex),
    });
  });
  return listings;
}
