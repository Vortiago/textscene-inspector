/**
 * The execution context of the TrueType interpreter (`TT_ExecContextRec`, `ttinterp.h`) for one
 * font size, with the size's own state that FreeType keeps beside it (`TT_SizeRec`): the scaled
 * control values, the storage area, the twilight zone and the graphics state that the font and
 * control value programs leave. The instructions (`tt*Instructions.ts`) read and move it, and
 * `ttRunInstructions.ts` runs them.
 *
 * FreeType's v40 interpreter runs at square pixels here, as Godot requests a size of equal width
 * and height (`text_server_adv.cpp:1500-1507`), so no control value or ppem is stretched.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulFix } from '../fontMetrics';
import { toUint16 } from '../../../../../godot/variant/intWidth';
import { dotFix14, F2DOT14_ONE, type UnitVector } from './ttArithmetic';
import { defaultGraphicsState, type GraphicsState } from './ttGraphicsState';
import { roundDistance, type SuperRound } from './ttRounding';
import { emptyZone, TAG_TOUCH_X, TAG_TOUCH_Y, type GlyphZone } from './ttZone';

/** The code ranges an instruction can run from (`TT_CodeRange_Tag`). */
export const CodeRange = { FONT: 1, CVT: 2, GLYPH: 3 } as const;
export type CodeRangeValue = (typeof CodeRange)[keyof typeof CodeRange];

/** `TT_DefRecord`: where an FDEF or IDEF body starts and ends. */
export interface Definition {
  range: CodeRangeValue;
  start: number;
  end: number;
  opcode: number;
  isActive: boolean;
}

/** `TT_CallRec`: where a CALL, LOOPCALL or an IDEF returns to, and the calls it has left. */
export interface CallRecord {
  callerRange: CodeRangeValue;
  callerIp: number;
  remainingCalls: number;
  definition: Definition;
}

/** `exc->callSize`: the depth of nested calls before the stack overflows. */
export const CALL_STACK_SIZE = 32;

/** The `maxp` limits and the bytecode a face's programs need, read once per font. */
export interface FaceBytecode {
  readonly fontProgram: Uint8Array;
  readonly controlValueProgram: Uint8Array;
  /** The `cvt ` table in font units. */
  readonly controlValues: Int16Array;
  readonly maxStackElements: number;
  readonly maxStorage: number;
  readonly maxFunctionDefs: number;
  readonly maxInstructionDefs: number;
  readonly maxTwilightPoints: number;
  readonly glyphCount: number;
  /** The variation axes of the font, whose coordinates GETVARIATION pushes. */
  readonly axisCount: number;
}

/** `FT_Long` values beyond the declared stack, half again or at least 128 (`tt_size_init_bytecode`). */
const EXTRA_STACK_MINIMUM = 128;

function stackSizeOf(maxStackElements: number): number {
  return maxStackElements + Math.max(Math.floor(maxStackElements / 2), EXTRA_STACK_MINIMUM);
}

/** `count` unused FDEF or IDEF records, as `FT_NEW_ARRAY` zeroes them. */
function definitions(count: number): Definition[] {
  return Array.from({ length: count }, () => ({
    range: CodeRange.FONT,
    start: 0,
    end: 0,
    opcode: 0,
    isActive: false,
  }));
}

/** `Project_x`, `Project_y` or `Project`: an axis vector reads its coordinate alone. */
function projectAlong(vector: UnitVector, dx: number, dy: number): number {
  if (vector.x === F2DOT14_ONE) return dx;
  if (vector.y === F2DOT14_ONE) return dy;
  return dotFix14(dx, dy, vector.x, vector.y);
}

export class ExecContext {
  readonly face: FaceBytecode;
  readonly stack: Float64Array;
  top = 0;
  /** The stack index of the first argument of the running instruction. */
  args = 0;
  newTop = 0;
  /** The error the running instruction raised, which stops the program. */
  error: string | null = null;

  /** The size's control values, which the control value program scales and writes. */
  readonly sizeControlValues: Float64Array;
  /** The size's control values, or a glyph program's copy of them once it writes one. */
  controlValues: Float64Array;
  readonly sizeStorage: Float64Array;
  storage: Float64Array;
  readonly sizeTwilight: GlyphZone;
  twilight: GlyphZone;
  pts: GlyphZone;
  zp0: GlyphZone;
  zp1: GlyphZone;
  zp2: GlyphZone;

  /** The size's graphics state, which each program starts from. */
  sizeGraphicsState = defaultGraphicsState();
  graphicsState: GraphicsState = defaultGraphicsState();

  readonly codeRanges: (Uint8Array | null)[] = [null, null, null];
  code: Uint8Array = new Uint8Array(0);
  ip = 0;
  curRange: CodeRangeValue = CodeRange.FONT;
  iniRange: CodeRangeValue = CodeRange.FONT;
  opcode = 0;
  /** The bytes of the running instruction, or 0 once it has moved the instruction pointer itself. */
  length = 0;

  readonly functionDefinitions: Definition[];
  functionCount = 0;
  maxFunction = 0;
  readonly instructionDefinitions: Definition[];
  instructionCount = 0;
  readonly callStack: CallRecord[] = [];
  callTop = 0;

  superRound: SuperRound = { period: 0, phase: 0, threshold: 0 };
  /** The free vector over its projection on the projection vector, 16.16 (`exc->moveVector`). */
  moveVector: UnitVector = { x: 0, y: 0 };
  /** The axis `Direct_Move_X` or `Direct_Move_Y` moves alone, or null for `Direct_Move`. */
  moveAxis: 'x' | 'y' | null = 'x';

  /** The 16.16 scale of font units to 26.6 pixels at this size. */
  scale = 0;
  ppem = 0;
  /** The point size in 26.6 that MPS returns: the ppem at 72 dpi. */
  pointSize = 0;
  /** The scale MD, MDRP and IP apply to unscaled distances: the size's, or one for a composite. */
  unscaledDistanceScale = 0;
  isComposite = false;
  /** `exc->backward_compatibility`: bit 2 turns it on, bits 0 and 1 record an IUP on y and x. */
  backwardCompatibility = 0;

  loopCallCount = 0;
  maxLoopCallCount = 0;
  negativeJumpCount = 0;
  maxNegativeJumpCount = 0;

  constructor(face: FaceBytecode) {
    this.face = face;
    this.stack = new Float64Array(stackSizeOf(face.maxStackElements));
    this.sizeControlValues = new Float64Array(face.controlValues.length);
    this.controlValues = this.sizeControlValues;
    this.sizeStorage = new Float64Array(face.maxStorage);
    this.storage = this.sizeStorage;
    this.functionDefinitions = definitions(face.maxFunctionDefs);
    this.instructionDefinitions = definitions(face.maxInstructionDefs);
    this.sizeTwilight = emptyZone(face.maxTwilightPoints + 4);
    this.twilight = { ...this.sizeTwilight };
    this.pts = emptyZone(0);
    this.zp0 = this.zp1 = this.zp2 = this.pts;
  }

  /** `TT_Load_Context`: the size's control values, storage and twilight zone, as the size holds them. */
  loadContext(): void {
    this.controlValues = this.sizeControlValues;
    this.storage = this.sizeStorage;
    this.twilight = { ...this.sizeTwilight };
  }

  /** `TT_Set_CodeRange`: `code` as the range `range`, which runs from its first byte. */
  setCodeRange(range: CodeRangeValue, code: Uint8Array): void {
    this.codeRanges[range - 1] = code;
    this.code = code;
    this.ip = 0;
    this.curRange = range;
    this.iniRange = range;
  }

  clearCodeRange(range: CodeRangeValue): void {
    this.codeRanges[range - 1] = null;
  }

  /** `Ins_Goto_CodeRange`: false, with the error set, for a range with no code or an address past it. */
  gotoCodeRange(range: number, ip: number): boolean {
    const code = range >= 1 && range <= 3 ? this.codeRanges[range - 1] : undefined;
    if (code === undefined) return this.fail('Bad_Argument');
    if (code === null) return this.fail('Invalid_CodeRange');
    // The last instruction may be a CALL, which returns to the byte after the range.
    if (ip > code.length) return this.fail('Code_Overflow');
    this.code = code;
    this.ip = ip;
    this.length = 0;
    this.curRange = range as CodeRangeValue;
    return true;
  }

  /**
   * The points a looping instruction (SHP, IP, ALIGNRP and the others) pops from below its
   * arguments, as `GS.loop` counts them; or -1, with the loop reset, when the stack holds fewer.
   */
  popLoop(): number {
    const { loop } = this.graphicsState;
    if (this.newTop < loop) {
      this.graphicsState.loop = 1;
      return -1;
    }
    this.newTop -= loop;
    return loop;
  }

  /** `(FT_UShort)*(--args)` for the `k`th looped value below the arguments at `a`. */
  loopPoint(a: number, k: number): number {
    return toUint16(this.stack[a - 1 - k]!);
  }

  /** Sets `error` and answers false, so a check can return it. */
  fail(error: string): false {
    this.error = error;
    return false;
  }

  /** `exc->func_project`: the 26.6 distance of `(dx, dy)` along the projection vector. */
  project(dx: number, dy: number): number {
    return projectAlong(this.graphicsState.projVector, dx, dy);
  }

  /** `exc->func_dualproj`: the 26.6 distance of `(dx, dy)` along the dual projection vector. */
  dualProject(dx: number, dy: number): number {
    return projectAlong(this.graphicsState.dualVector, dx, dy);
  }

  /**
   * `exc->func_move`: moves the current point along the free vector so that its projection grows
   * by `distance`, and touches it on each axis the move has. Backward compatibility blocks every
   * x move, and every y move once IUP has run on both axes.
   */
  move(zone: GlyphZone, point: number, distance: number): void {
    const { x, y } = this.moveVector;
    if (this.moveAxis !== 'y' && x !== 0) {
      const dx = this.moveAxis === 'x' ? distance : ftMulFix(distance, x);
      if (!this.backwardCompatibility) zone.curX[point] = zone.curX[point]! + dx;
      zone.tags[point] = zone.tags[point]! | TAG_TOUCH_X;
    }
    if (this.moveAxis !== 'x' && y !== 0) {
      const dy = this.moveAxis === 'y' ? distance : ftMulFix(distance, y);
      if (this.backwardCompatibility !== 0x7) zone.curY[point] = zone.curY[point]! + dy;
      zone.tags[point] = zone.tags[point]! | TAG_TOUCH_Y;
    }
  }

  /** `exc->func_move_orig`: as `move`, on the original point, with no touch and no block. */
  moveOriginal(zone: GlyphZone, point: number, distance: number): void {
    const { x, y } = this.moveVector;
    if (this.moveAxis !== 'y' && x !== 0)
      zone.orgX[point] = zone.orgX[point]! + (this.moveAxis === 'x' ? distance : ftMulFix(distance, x));
    if (this.moveAxis !== 'x' && y !== 0)
      zone.orgY[point] = zone.orgY[point]! + (this.moveAxis === 'y' ? distance : ftMulFix(distance, y));
  }

  /**
   * `Compute_Funcs`: the move vector of the free and projection vectors. Nearly orthogonal
   * vectors move nothing, as their quotient would be too large to trust. A free vector along an
   * axis and the projection vector moves that axis alone, by the distance itself.
   */
  computeMoveVector(): void {
    const { freeVector, projVector } = this.graphicsState;
    const freeDotProj = (projVector.x * freeVector.x + projVector.y * freeVector.y + 0x2000) >> 14;
    if (freeDotProj >= 0x3ffe) this.moveVector = { x: freeVector.x * 4, y: freeVector.y * 4 };
    else if (-0x400 < freeDotProj && freeDotProj < 0x400) this.moveVector = { x: 0, y: 0 };
    else
      this.moveVector = {
        x: Math.trunc((freeVector.x * 0x10000) / freeDotProj),
        y: Math.trunc((freeVector.y * 0x10000) / freeDotProj),
      };
    if (freeDotProj >= 0x3ffe && freeVector.x === F2DOT14_ONE) this.moveAxis = 'x';
    else if (freeDotProj >= 0x3ffe && freeVector.y === F2DOT14_ONE) this.moveAxis = 'y';
    else this.moveAxis = null;
  }

  /** `exc->func_round`: `distance` rounded in the current round state. */
  round(distance: number): number {
    return roundDistance(distance, this.graphicsState.roundState, this.superRound);
  }

  /**
   * `Modify_CVT_Check` and its storage twin in `Ins_WS`: a glyph program writes to its own copy,
   * so the next glyph starts from the size's values again.
   */
  private writableInGlyph(values: Float64Array, sizeValues: Float64Array): Float64Array {
    return this.iniRange === CodeRange.GLYPH && values === sizeValues ? values.slice() : values;
  }

  writeControlValue(index: number, value: number): void {
    this.controlValues = this.writableInGlyph(this.controlValues, this.sizeControlValues);
    this.controlValues[index] = value;
  }

  writeStorage(index: number, value: number): void {
    this.storage = this.writableInGlyph(this.storage, this.sizeStorage);
    this.storage[index] = value;
  }
}
