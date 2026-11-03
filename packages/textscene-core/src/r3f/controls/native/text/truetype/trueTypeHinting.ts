/**
 * The TrueType hinting of a font, as FreeType's v40 interpreter runs it for each size Godot loads
 * a glyph at (`ttobjs.c`, `tt_size_init_bytecode`, `tt_size_run_fpgm` and `tt_size_run_prep`, and
 * `ttgload.c`, `tt_loader_init` and `TT_Hint_Glyph`). The font program runs once for a size and
 * the control value program once after it. A failure of either loads no glyph at that size.
 *
 * TextMesh imports this module on demand (`sfntOutlines.ts`), so the interpreter stays out of the
 * first paint.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulFix } from '../fontMetrics';
import type { GlyphHinting, GlyphLoadHinter } from '../glyphHinting';
import { tableFits, type SfntFile } from '../sfntTables';
import { pixRound } from './ttArithmetic';
import { CodeRange, ExecContext, type FaceBytecode } from './ttExecContext';
import { defaultGraphicsState, saveProgramState } from './ttGraphicsState';
import { runContext } from './ttRunInstructions';
import { emptyZone, PHANTOM_POINT_COUNT, type GlyphZone } from './ttZone';

/** `maxp` 1.0: maxTwilightPoints(2) at 16, then maxStorage, maxFunctionDefs, maxInstructionDefs, maxStackElements. */
const MAXP_VERSION_1 = 0x10000;
const MAXP_GLYPH_COUNT_OFFSET = 4;
const MAXP_TWILIGHT_OFFSET = 16;
const MAXP_STORAGE_OFFSET = 18;
const MAXP_FUNCTION_DEFS_OFFSET = 20;
const MAXP_INSTRUCTION_DEFS_OFFSET = 22;
const MAXP_STACK_OFFSET = 24;
const MAXP_VERSION_1_LENGTH = 32;
/** FreeType allows 64 functions at least, for broken fonts that declare fewer (`tt_face_load_maxp`). */
const MIN_FUNCTION_DEFS = 64;
/** The twilight points FreeType allows, four phantom points short of 16 bits. */
const MAX_TWILIGHT_POINTS = 0xffff - PHANTOM_POINT_COUNT;
/** `fvar`: axisCount(2) at 8. */
const FVAR_AXIS_COUNT_OFFSET = 8;
const FVAR_HEADER_LENGTH = 16;

/** One in 16.16: the scale of a composite's points, which are already in pixels. */
const UNIT_SCALE = 0x10000;

/** The bytes of a table, or none for a font without it. */
function tableBytes({ dv, tables }: SfntFile, tag: string): Uint8Array {
  const table = tables.get(tag);
  if (!table || table.offset + table.length > dv.byteLength) return new Uint8Array(0);
  return new Uint8Array(dv.buffer, dv.byteOffset + table.offset, table.length);
}

/** `tt_face_load_cvt`: the control values in font units. */
function controlValuesOf(sfnt: SfntFile): Int16Array {
  const bytes = tableBytes(sfnt, 'cvt ');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Int16Array.from({ length: bytes.length >> 1 }, (_, index) => view.getInt16(index * 2, false));
}

/** The variation axes of a variable font, which FreeType gives a blend. */
function axisCountOf({ dv, tables }: SfntFile): number {
  const fvar = tables.get('fvar');
  return fvar && tableFits(dv, fvar, FVAR_HEADER_LENGTH)
    ? dv.getUint16(fvar.offset + FVAR_AXIS_COUNT_OFFSET, false)
    : 0;
}

/** The `maxp` limits and the programs of a font, or null for a font with no `maxp` that fits. */
function faceBytecodeOf(sfnt: SfntFile): FaceBytecode | null {
  const { dv, tables } = sfnt;
  const maxp = tables.get('maxp');
  if (!maxp || !tableFits(dv, maxp, MAXP_GLYPH_COUNT_OFFSET + 2)) return null;
  const isVersion1 =
    dv.getUint32(maxp.offset, false) >= MAXP_VERSION_1 && tableFits(dv, maxp, MAXP_VERSION_1_LENGTH);
  const field = (offset: number) => (isVersion1 ? dv.getUint16(maxp.offset + offset, false) : 0);
  return {
    fontProgram: tableBytes(sfnt, 'fpgm'),
    controlValueProgram: tableBytes(sfnt, 'prep'),
    controlValues: controlValuesOf(sfnt),
    maxStackElements: field(MAXP_STACK_OFFSET),
    maxStorage: field(MAXP_STORAGE_OFFSET),
    maxFunctionDefs: isVersion1 ? Math.max(field(MAXP_FUNCTION_DEFS_OFFSET), MIN_FUNCTION_DEFS) : 0,
    maxInstructionDefs: field(MAXP_INSTRUCTION_DEFS_OFFSET),
    maxTwilightPoints: Math.min(field(MAXP_TWILIGHT_OFFSET), MAX_TWILIGHT_POINTS),
    glyphCount: dv.getUint16(maxp.offset + MAXP_GLYPH_COUNT_OFFSET, false),
    axisCount: axisCountOf(sfnt),
  };
}

/** `TT_Run_Context` on `program` in `range`, with no glyph points; the error, or null. */
function runProgram(
  exc: ExecContext,
  range: typeof CodeRange.FONT | typeof CodeRange.CVT,
  program: Uint8Array
): string | null {
  if (program.length === 0) return null;
  exc.setCodeRange(range, program);
  exc.pts = emptyZone(0);
  return runContext(exc);
}

/** `tt_size_run_fpgm`: the font program, whose functions every later program calls. */
function runFontProgram(exc: ExecContext): string | null {
  exc.loadContext();
  exc.clearCodeRange(CodeRange.CVT);
  exc.clearCodeRange(CodeRange.GLYPH);
  const error = runProgram(exc, CodeRange.FONT, exc.face.fontProgram);
  if (!error) saveProgramState(exc.sizeGraphicsState, exc.graphicsState);
  return error;
}

/**
 * `tt_size_run_prep`: the control value program, from the default graphics state, zeroed twilight
 * points and storage, and the control values scaled to the size.
 */
function runControlValueProgram(exc: ExecContext): string | null {
  exc.sizeGraphicsState = defaultGraphicsState();
  exc.sizeTwilight.orgX.fill(0);
  exc.sizeTwilight.orgY.fill(0);
  exc.sizeTwilight.curX.fill(0);
  exc.sizeTwilight.curY.fill(0);
  exc.loadContext();
  exc.sizeStorage.fill(0);
  exc.face.controlValues.forEach((value, index) => {
    exc.sizeControlValues[index] = ftMulFix(value, exc.scale);
  });
  exc.clearCodeRange(CodeRange.GLYPH);
  const error = runProgram(exc, CodeRange.CVT, exc.face.controlValueProgram);
  if (!error) saveProgramState(exc.sizeGraphicsState, exc.graphicsState);
  return error;
}

/** `TT_Hint_Glyph`'s run of a glyph's instructions on its zone, phantom points rounded first. */
function hintZone(exc: ExecContext, zone: GlyphZone, instructions: Uint8Array, isComposite: boolean): void {
  const hasInstructions = instructions.length > 0;
  if (hasInstructions) {
    zone.orgX.set(zone.curX);
    zone.orgY.set(zone.curY);
  }
  if (isComposite) {
    exc.unscaledDistanceScale = UNIT_SCALE;
    zone.orusX.set(zone.curX);
    zone.orusY.set(zone.curY);
  } else exc.unscaledDistanceScale = exc.scale;
  const last = zone.pointCount - 1;
  zone.curX[last - 3] = pixRound(zone.curX[last - 3]!);
  zone.curX[last - 2] = pixRound(zone.curX[last - 2]!);
  zone.curY[last - 1] = pixRound(zone.curY[last - 1]!);
  zone.curY[last] = pixRound(zone.curY[last]!);
  if (!hasInstructions) return;
  exc.setCodeRange(CodeRange.GLYPH, instructions);
  exc.isComposite = isComposite;
  exc.pts = zone;
  // FreeType's non-pedantic mode keeps the points an instruction error leaves.
  runContext(exc);
}

/** One size's interpreter and the outcome of its programs (`TT_SizeRec`). */
interface SizeHinting {
  exc: ExecContext;
  /** The error of the font program or the control value program, which fails every load. */
  error: string | null;
}

/** `tt_size_init_bytecode` and the first `tt_size_run_prep` of a size at `ppem` and `scale`. */
function startSize(face: FaceBytecode, ppem: number, scale: number): SizeHinting {
  const exc = new ExecContext(face);
  exc.ppem = ppem;
  exc.scale = scale;
  exc.pointSize = ppem * 64;
  return { exc, error: runFontProgram(exc) ?? runControlValueProgram(exc) };
}

/** `tt_loader_init`: the size's context loaded for a glyph, with the control value program's flags applied. */
function beginLoad({ exc }: SizeHinting): GlyphLoadHinter | null {
  exc.backwardCompatibility = 0;
  exc.loadContext();
  const { instructControl } = exc.sizeGraphicsState;
  // With bit 2, FreeType resets the size's own state, so a later load at the size sees no flag.
  if (instructControl & 2) exc.sizeGraphicsState = defaultGraphicsState();
  exc.backwardCompatibility = (exc.sizeGraphicsState.instructControl & 4) ^ 4;
  if (instructControl & 1) return null;
  return {
    get isBackwardCompatible() {
      return exc.backwardCompatibility !== 0;
    },
    hint: (zone, instructions, isComposite) => hintZone(exc, zone, instructions, isComposite),
  };
}

/** The hinting of a font's glyph loads, or null for a font with no `maxp` that fits. */
export function trueTypeHinting(sfnt: SfntFile): GlyphHinting | null {
  const face = faceBytecodeOf(sfnt);
  if (!face) return null;
  const sizes = new Map<number, SizeHinting>();
  return {
    beginLoad(ppem, scale) {
      let size = sizes.get(ppem);
      if (!size) sizes.set(ppem, (size = startSize(face, ppem, scale)));
      return size.error ? 'failed' : beginLoad(size);
    },
  };
}
