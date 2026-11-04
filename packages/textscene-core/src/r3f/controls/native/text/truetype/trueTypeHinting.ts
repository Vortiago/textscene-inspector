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

import { FIXED_26_6_ONE } from '../fontMetrics';
import type { FontInstance } from '../variation/fontInstance';
import {
  PHANTOM_POINT_COUNT,
  newGlyphZone,
  type GlyphHinting,
  type GlyphLoadHinter,
  type GlyphZone,
} from '../glyphHinting';
import {
  readFvarAxisCount,
  readGlyphCount,
  readMaxpVersion1Field,
  tableBytes,
  type SfntFile,
} from '../sfntTables';
import { isTrickyFont } from '../trickyFont';
import { CodeRange, ExecContext, type FaceBytecode } from './ttExecContext';
import { INSTRUCT_CONTROL_NO_HINTING, saveProgramState } from './ttGraphicsState';
import { runContext } from './ttRunInstructions';

/** `maxp` 1.0: maxTwilightPoints(2) at 16, then maxStorage, maxFunctionDefs, maxInstructionDefs, maxStackElements. */
const MAXP_TWILIGHT_OFFSET = 16;
const MAXP_STORAGE_OFFSET = 18;
const MAXP_FUNCTION_DEFS_OFFSET = 20;
const MAXP_INSTRUCTION_DEFS_OFFSET = 22;
const MAXP_STACK_OFFSET = 24;
/** FreeType allows 64 functions at least, for broken fonts that declare fewer (`tt_face_load_maxp`). */
const MIN_FUNCTION_DEFS = 64;
/** The twilight points FreeType allows, four phantom points short of 16 bits. */
const MAX_TWILIGHT_POINTS = 0xffff - PHANTOM_POINT_COUNT;

/** `tt_face_load_cvt`: the control values in 26.6 font units. */
export function controlValuesOf(sfnt: SfntFile): Int32Array {
  const bytes = tableBytes(sfnt, 'cvt ');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Int32Array.from(
    { length: bytes.length >> 1 },
    (_, index) => view.getInt16(index * 2, false) * FIXED_26_6_ONE
  );
}

/** The `maxp` limits and the programs of a font, or null for a font with no `maxp` that fits. */
function faceBytecodeOf(sfnt: SfntFile): FaceBytecode | null {
  const glyphCount = readGlyphCount(sfnt);
  if (glyphCount === null) return null;
  const field = (offset: number) => readMaxpVersion1Field(sfnt, offset) ?? 0;
  const functionDefs = readMaxpVersion1Field(sfnt, MAXP_FUNCTION_DEFS_OFFSET);
  const axisCount = readFvarAxisCount(sfnt);
  return {
    fontProgram: tableBytes(sfnt, 'fpgm'),
    controlValueProgram: tableBytes(sfnt, 'prep'),
    controlValues: controlValuesOf(sfnt),
    maxStackElements: field(MAXP_STACK_OFFSET),
    maxStorage: field(MAXP_STORAGE_OFFSET),
    maxFunctionDefs: functionDefs === null ? 0 : Math.max(functionDefs, MIN_FUNCTION_DEFS),
    maxInstructionDefs: field(MAXP_INSTRUCTION_DEFS_OFFSET),
    maxTwilightPoints: Math.min(field(MAXP_TWILIGHT_OFFSET), MAX_TWILIGHT_POINTS),
    glyphCount,
    axisCount,
    normalizedCoordinates: new Int32Array(axisCount),
    isTricky: isTrickyFont(sfnt),
  };
}

/** The face as the instance leaves it: its varied control values, and the coordinates GETVARIATION pushes. */
function faceBytecodeAt(face: FaceBytecode, instance: FontInstance | null): FaceBytecode {
  if (!instance) return face;
  return {
    ...face,
    controlValues: instance.controlValues ?? face.controlValues,
    normalizedCoordinates: instance.normalized,
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
  exc.pts = newGlyphZone(0, [], 0);
  return runContext(exc);
}

/** `tt_size_run_fpgm`: the font program, whose functions every later program calls. */
function runFontProgram(exc: ExecContext): string | null {
  exc.loadContext();
  exc.clearCodeRange(CodeRange.CVT);
  exc.clearCodeRange(CodeRange.GLYPH);
  // The size keeps the font program's state only through a font without a control value program.
  return runProgram(exc, CodeRange.FONT, exc.face.fontProgram);
}

/** `tt_size_run_prep`: the control value program, from a reset size state and scaled control values. */
function runControlValueProgram(exc: ExecContext): string | null {
  exc.resetSizeState();
  exc.loadContext();
  exc.scaleControlValues();
  exc.clearCodeRange(CodeRange.GLYPH);
  const error = runProgram(exc, CodeRange.CVT, exc.face.controlValueProgram);
  if (!error) saveProgramState(exc.sizeGraphicsState, exc.graphicsState);
  return error;
}

/** `TT_Hint_Glyph`'s run of a glyph's instructions on its zone, phantom points rounded first. */
function hintZone(exc: ExecContext, zone: GlyphZone, instructions: Uint8Array, isComposite: boolean): void {
  exc.prepareGlyph(zone, instructions, isComposite);
  if (instructions.length === 0) return;
  // FreeType's non-pedantic mode keeps the points an instruction error leaves.
  runContext(exc);
}

/** The hinter of every load at a size, which reads backward compatibility as a glyph program changes it. */
function loadHinterOf(exc: ExecContext): GlyphLoadHinter {
  return {
    get isBackwardCompatible() {
      return exc.backwardCompatibility !== 0;
    },
    hint: (zone, instructions, isComposite) => hintZone(exc, zone, instructions, isComposite),
  };
}

/** One size's interpreter, the hinter of its glyph loads, and the outcome of its programs (`TT_SizeRec`). */
interface SizeHinting {
  exc: ExecContext;
  hinter: GlyphLoadHinter;
  /** The error of the font program or the control value program, which fails every load. */
  error: string | null;
}

/** `tt_size_init_bytecode` and the first `tt_size_run_prep` of a size at `ppem` and `scale`. */
function startSize(face: FaceBytecode, ppem: number, scale: number): SizeHinting {
  const exc = new ExecContext(face);
  exc.ppem = ppem;
  exc.scale = scale;
  exc.pointSize = ppem * FIXED_26_6_ONE;
  return { exc, hinter: loadHinterOf(exc), error: runFontProgram(exc) ?? runControlValueProgram(exc) };
}

/** `tt_loader_init`: the size's hinter for a load, or null when the control value program turns hinting off. */
function beginLoad({ exc, hinter }: SizeHinting): GlyphLoadHinter | null {
  const { instructControl } = exc.sizeGraphicsState;
  exc.startGlyphLoad();
  return instructControl & INSTRUCT_CONTROL_NO_HINTING ? null : hinter;
}

/** The hinting of a font's glyph loads, or null for a font with no `maxp` that fits. */
export function trueTypeHinting(sfnt: SfntFile): GlyphHinting | null {
  const face = faceBytecodeOf(sfnt);
  if (!face) return null;
  // FreeType's size is one request: a ppem and a scale, which two requests of one ppem may not share.
  // A face holds one instance, so an instance is part of the key.
  const sizes = new Map<string, SizeHinting>();
  return {
    beginLoad(ppem, scale, instance = null) {
      const key = `${instance?.key ?? ''} ${ppem} ${scale}`;
      let size = sizes.get(key);
      if (!size) sizes.set(key, (size = startSize(faceBytecodeAt(face, instance), ppem, scale)));
      return size.error ? 'failed' : beginLoad(size);
    },
  };
}
