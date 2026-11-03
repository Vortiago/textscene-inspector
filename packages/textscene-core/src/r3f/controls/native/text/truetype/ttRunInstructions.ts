/**
 * The main loop of FreeType's TrueType interpreter (`ttinterp.c`, `TT_RunIns` and
 * `TT_Run_Context`): one function for each opcode, and the run of a program to its end or its
 * first error. FreeType's pedantic mode is off, so a bad argument does what the non-pedantic
 * branch of each instruction does.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { IUP_X_DONE, IUP_Y_DONE, type ExecContext } from './ttExecContext';
import {
  callFunction,
  defineFunction,
  defineInstruction,
  endFunction,
  ifTrue,
  jumpRelative,
  jumpRelativeOnFalse,
  jumpRelativeOnTrue,
  loopCallFunction,
  otherwise,
  unknownOpcode,
} from './ttFlowInstructions';
import { interpolateUntouchedPoints } from './ttInterpolateUntouched';
import {
  alignPoints,
  alignToReferencePoint,
  getCoordinate,
  intersect,
  measureDistance,
  moveDirectAbsolutePoint,
  moveDirectRelativePoint,
  moveIndirectAbsolutePoint,
  moveIndirectRelativePoint,
  moveStackIndirectRelativePoint,
  setCoordinateFromStack,
} from './ttMoveInstructions';
import { OPCODE_POPS, OPCODE_PUSHES } from './ttOpcodes';
import { RoundState } from './ttRounding';
import {
  deltaPoint,
  flipPoints,
  flipRange,
  interpolatePoints,
  shiftContour,
  shiftPoints,
  shiftPointsByPixels,
  shiftZone,
  untouchPoint,
} from './ttShiftInstructions';
import * as stackOps from './ttStackInstructions';
import * as state from './ttStateInstructions';
import {
  deltaControlValue,
  readControlValue,
  readStorage,
  writeControlValueInFontUnits,
  writeControlValueInPixels,
  writeStorage,
} from './ttStorageInstructions';
import * as vectors from './ttVectorInstructions';

type Instruction = (exc: ExecContext, a: number) => void;

const doNothing: Instruction = () => {};

/** The opcode ranges of the dispatch, as `TT_RunIns`'s switch lists them. */
const INSTRUCTION_RANGES: readonly (readonly [first: number, last: number, instruction: Instruction])[] = [
  [0x00, 0x05, vectors.setVectorsToAxis],
  [0x06, 0x07, vectors.setProjectionVectorToLine],
  [0x08, 0x09, vectors.setFreeVectorToLine],
  [0x0a, 0x0a, vectors.setProjectionVectorFromStack],
  [0x0b, 0x0b, vectors.setFreeVectorFromStack],
  [0x0c, 0x0c, vectors.getProjectionVector],
  [0x0d, 0x0d, vectors.getFreeVector],
  [0x0e, 0x0e, vectors.setFreeVectorToProjectionVector],
  [0x0f, 0x0f, intersect],
  [0x10, 0x10, state.setReferencePoint(0)],
  [0x11, 0x11, state.setReferencePoint(1)],
  [0x12, 0x12, state.setReferencePoint(2)],
  [0x13, 0x13, state.setZonePointer(0)],
  [0x14, 0x14, state.setZonePointer(1)],
  [0x15, 0x15, state.setZonePointer(2)],
  [0x16, 0x16, state.setZonePointers],
  [0x17, 0x17, state.setLoop],
  [0x18, 0x18, state.setRoundState(RoundState.GRID)],
  [0x19, 0x19, state.setRoundState(RoundState.HALF_GRID)],
  [0x1a, 0x1a, state.setMinimumDistance],
  [0x1b, 0x1b, otherwise],
  [0x1c, 0x1c, jumpRelative],
  [0x1d, 0x1d, state.setControlValueCutIn],
  [0x1e, 0x1e, state.setSingleWidthCutIn],
  [0x1f, 0x1f, state.setSingleWidth],
  [0x20, 0x20, stackOps.duplicate],
  [0x21, 0x21, doNothing],
  [0x22, 0x22, stackOps.clear],
  [0x23, 0x23, stackOps.swap],
  [0x24, 0x24, stackOps.depth],
  [0x25, 0x25, stackOps.copyIndexed],
  [0x26, 0x26, stackOps.moveIndexed],
  [0x27, 0x27, alignPoints],
  [0x29, 0x29, untouchPoint],
  [0x2a, 0x2a, loopCallFunction],
  [0x2b, 0x2b, callFunction],
  [0x2c, 0x2c, defineFunction],
  [0x2d, 0x2d, endFunction],
  [0x2e, 0x2f, moveDirectAbsolutePoint],
  [0x30, 0x31, interpolateUntouchedPoints],
  [0x32, 0x33, shiftPoints],
  [0x34, 0x35, shiftContour],
  [0x36, 0x37, shiftZone],
  [0x38, 0x38, shiftPointsByPixels],
  [0x39, 0x39, interpolatePoints],
  [0x3a, 0x3b, moveStackIndirectRelativePoint],
  [0x3c, 0x3c, alignToReferencePoint],
  [0x3d, 0x3d, state.setRoundState(RoundState.DOUBLE_GRID)],
  [0x3e, 0x3f, moveIndirectAbsolutePoint],
  [0x40, 0x41, stackOps.pushCounted],
  [0x42, 0x42, writeStorage],
  [0x43, 0x43, readStorage],
  [0x44, 0x44, writeControlValueInPixels],
  [0x45, 0x45, readControlValue],
  [0x46, 0x47, getCoordinate],
  [0x48, 0x48, setCoordinateFromStack],
  [0x49, 0x4a, measureDistance],
  [0x4b, 0x4b, state.measurePixelsPerEm],
  [0x4c, 0x4c, state.measurePointSize],
  [0x4d, 0x4d, state.setAutoFlipOn],
  [0x4e, 0x4e, state.setAutoFlipOff],
  [0x4f, 0x4f, state.debug],
  [0x50, 0x50, stackOps.lessThan],
  [0x51, 0x51, stackOps.lessThanOrEqual],
  [0x52, 0x52, stackOps.greaterThan],
  [0x53, 0x53, stackOps.greaterThanOrEqual],
  [0x54, 0x54, stackOps.equal],
  [0x55, 0x55, stackOps.notEqual],
  [0x56, 0x56, stackOps.isOdd],
  [0x57, 0x57, stackOps.isEven],
  [0x58, 0x58, ifTrue],
  [0x59, 0x59, doNothing],
  [0x5a, 0x5a, stackOps.and],
  [0x5b, 0x5b, stackOps.or],
  [0x5c, 0x5c, stackOps.not],
  [0x5d, 0x5d, deltaPoint],
  [0x5e, 0x5e, state.setDeltaBase],
  [0x5f, 0x5f, state.setDeltaShift],
  [0x60, 0x60, stackOps.add],
  [0x61, 0x61, stackOps.subtract],
  [0x62, 0x62, stackOps.divide],
  [0x63, 0x63, stackOps.multiply],
  [0x64, 0x64, stackOps.absolute],
  [0x65, 0x65, stackOps.negate],
  [0x66, 0x66, stackOps.floor],
  [0x67, 0x67, stackOps.ceiling],
  [0x68, 0x6b, state.round],
  // NROUND rounds nothing, as no engine compensates.
  [0x6c, 0x6f, doNothing],
  [0x70, 0x70, writeControlValueInFontUnits],
  [0x71, 0x72, deltaPoint],
  [0x73, 0x75, deltaControlValue],
  [0x76, 0x76, state.setSuperRound],
  [0x77, 0x77, state.setSuperRound45],
  [0x78, 0x78, jumpRelativeOnTrue],
  [0x79, 0x79, jumpRelativeOnFalse],
  [0x7a, 0x7a, state.setRoundState(RoundState.OFF)],
  [0x7c, 0x7c, state.setRoundState(RoundState.UP_TO_GRID)],
  [0x7d, 0x7d, state.setRoundState(RoundState.DOWN_TO_GRID)],
  // SANGW and AA are no longer supported, and do nothing.
  [0x7e, 0x7f, doNothing],
  [0x80, 0x80, flipPoints],
  [0x81, 0x82, flipRange],
  // SCANCTRL and SCANTYPE set what only the rasteriser reads.
  [0x85, 0x85, doNothing],
  [0x86, 0x87, vectors.setDualProjectionVectorToLine],
  [0x88, 0x88, state.getInformation],
  [0x89, 0x89, defineInstruction],
  [0x8a, 0x8a, stackOps.roll],
  [0x8b, 0x8b, stackOps.maximum],
  [0x8c, 0x8c, stackOps.minimum],
  [0x8d, 0x8d, doNothing],
  [0x8e, 0x8e, state.instructionControl],
  [0xb0, 0xbf, stackOps.pushFixed],
  [0xc0, 0xdf, moveDirectRelativePoint],
  [0xe0, 0xff, moveIndirectRelativePoint],
];

/** GETVARIATION and GETDATA, which a font without a blend does not know. */
const VARIATION_INSTRUCTIONS: readonly (readonly [opcode: number, instruction: Instruction])[] = [
  [0x91, state.getVariation],
  [0x92, state.getData],
];

/** The 256 instructions, each unknown opcode running its IDEF. */
function dispatchTable(hasBlend: boolean): readonly Instruction[] {
  const table: Instruction[] = new Array<Instruction>(256).fill(unknownOpcode);
  for (const [first, last, instruction] of INSTRUCTION_RANGES) table.fill(instruction, first, last + 1);
  if (hasBlend) for (const [opcode, instruction] of VARIATION_INSTRUCTIONS) table[opcode] = instruction;
  return table;
}

const TABLE_WITHOUT_BLEND = dispatchTable(false);
const TABLE_WITH_BLEND = dispatchTable(true);

/** `TT_CONFIG_OPTION_MAX_RUNNABLE_OPCODES`: FreeType stops a program past this many instructions. */
const MAX_RUNNABLE_OPCODES = 1_000_000;

/**
 * `TT_RunIns`: runs the code from the instruction pointer to its end. Null on success, or the
 * error that stopped it. Missing arguments read as zero.
 */
function runInstructions(exc: ExecContext): string | null {
  const table = exc.face.axisCount > 0 ? TABLE_WITH_BLEND : TABLE_WITHOUT_BLEND;
  for (let count = 1; ; count++) {
    if (count > MAX_RUNNABLE_OPCODES) return 'Execution_Too_Long';
    exc.error = null;
    exc.opcode = exc.code[exc.ip]!;
    exc.length = 1;
    const pops = OPCODE_POPS[exc.opcode]!;
    exc.args = exc.top - pops;
    if (exc.args < 0) {
      exc.stack.fill(0, 0, pops);
      exc.args = 0;
    }
    exc.newTop = exc.args + OPCODE_PUSHES[exc.opcode]!;
    if (exc.newTop > exc.stack.length) return 'Stack_Overflow';
    table[exc.opcode]!(exc, exc.args);
    if (exc.error) return exc.error;
    exc.top = exc.newTop;
    exc.ip += exc.length;
    if (exc.ip >= exc.code.length) return exc.callTop > 0 ? 'Code_Overflow' : null;
  }
}

/**
 * FreeType caps the twilight zone at twice the points and control values, but at least 30, so
 * malformed bytecode runs fast and a font that `ttfautohint` hinted keeps its twilight segments.
 */
const MIN_TWILIGHT_POINT_LIMIT = 30;
/** `twilight.n_points` is an `FT_UShort`. */
const MAX_TWILIGHT_POINT_LIMIT = 0xffff;

/** The twilight points a program may address, for a zone of `pointCount` points. */
function twilightPointLimit(pointCount: number, controlValueCount: number): number {
  return Math.min(
    Math.max(MIN_TWILIGHT_POINT_LIMIT, 2 * (pointCount + controlValueCount)),
    MAX_TWILIGHT_POINT_LIMIT
  );
}

/**
 * FreeType's heuristic loop limits: real bytecode loops over the points of a glyph, or over the
 * control values in the control value program, and seldom does so. A glyph program may make 10
 * runs a point and one every 10 control values, each at least 50. A program without points may
 * make 300 and 22 a control value.
 */
const MIN_LOOP_CALLS = 50;
const LOOP_CALLS_PER_POINT = 10;
const CONTROL_VALUES_PER_LOOP_CALL = 10;
const LOOP_CALLS_WITHOUT_POINTS = 300;
const LOOP_CALLS_PER_CONTROL_VALUE = 22;
/** FreeType assumes at most 100 control values a glyph, against a font of too many control values. */
const MAX_CONTROL_VALUES_PER_GLYPH = 100;

/** The LOOPCALL runs, and the negative jumps, a program may make on a zone of `pointCount` points. */
function maxLoopCalls(pointCount: number, controlValueCount: number, glyphCount: number): number {
  const loopCalls =
    pointCount > 0
      ? Math.max(MIN_LOOP_CALLS, LOOP_CALLS_PER_POINT * pointCount) +
        Math.max(MIN_LOOP_CALLS, Math.trunc(controlValueCount / CONTROL_VALUES_PER_LOOP_CALL))
      : LOOP_CALLS_WITHOUT_POINTS + LOOP_CALLS_PER_CONTROL_VALUE * controlValueCount;
  return Math.min(loopCalls, MAX_CONTROL_VALUES_PER_GLYPH * glyphCount);
}

/** `TT_Run_Context`: the loop limits for the zone's size, and the run from the size's graphics state. */
export function runContext(exc: ExecContext): string | null {
  exc.zp0 = exc.zp1 = exc.zp2 = exc.pts;
  const { pointCount } = exc.pts;
  const controlValueCount = exc.controlValues.length;
  const twilightLimit = twilightPointLimit(pointCount, controlValueCount);
  if (exc.twilight.pointCount > twilightLimit) exc.twilight.pointCount = twilightLimit;

  exc.loopCallCount = 0;
  exc.negativeJumpCount = 0;
  exc.maxLoopCallCount = exc.maxNegativeJumpCount = maxLoopCalls(
    pointCount,
    controlValueCount,
    exc.face.glyphCount
  );

  exc.graphicsState = { ...exc.sizeGraphicsState, roundState: RoundState.GRID };
  exc.computeMoveVector();
  exc.backwardCompatibility &= ~(IUP_X_DONE | IUP_Y_DONE);
  exc.top = 0;
  exc.callTop = 0;
  return runInstructions(exc);
}
