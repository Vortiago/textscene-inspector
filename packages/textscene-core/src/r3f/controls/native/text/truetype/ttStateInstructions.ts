/**
 * The TrueType instructions that set the graphics state and measure the size (`ttinterp.c`,
 * `Ins_SRP0` to `Ins_INSTCTRL`, `Ins_GETINFO`, `Ins_MPPEM` and the rounding). Each takes the stack
 * index `a` of its first argument.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulFix } from '../fontMetrics';
import { toUint16 } from '../../../../../godot/variant/intWidth';
import { CodeRange, type ExecContext } from './ttExecContext';
import { GLYPH_ZONE, TWILIGHT_ZONE } from './ttGraphicsState';
import {
  RoundState,
  SUPER_ROUND_45_GRID,
  SUPER_ROUND_GRID,
  superRoundOf,
  type RoundStateValue,
} from './ttRounding';
import type { GlyphZone } from './ttZone';

export function setReferencePoint0(exc: ExecContext, a: number): void {
  exc.graphicsState.rp0 = toUint16(exc.stack[a]!);
}

export function setReferencePoint1(exc: ExecContext, a: number): void {
  exc.graphicsState.rp1 = toUint16(exc.stack[a]!);
}

export function setReferencePoint2(exc: ExecContext, a: number): void {
  exc.graphicsState.rp2 = toUint16(exc.stack[a]!);
}

/** The zone a zone pointer names, or null for a number that names none, which changes nothing. */
function zoneNumbered(exc: ExecContext, a: number): GlyphZone | null {
  switch (exc.stack[a]! | 0) {
    case TWILIGHT_ZONE:
      return exc.twilight;
    case GLYPH_ZONE:
      return exc.pts;
    default:
      return null;
  }
}

export function setZonePointer0(exc: ExecContext, a: number): void {
  const zone = zoneNumbered(exc, a);
  if (!zone) return;
  exc.zp0 = zone;
  exc.graphicsState.gep0 = toUint16(exc.stack[a]!);
}

export function setZonePointer1(exc: ExecContext, a: number): void {
  const zone = zoneNumbered(exc, a);
  if (!zone) return;
  exc.zp1 = zone;
  exc.graphicsState.gep1 = toUint16(exc.stack[a]!);
}

export function setZonePointer2(exc: ExecContext, a: number): void {
  const zone = zoneNumbered(exc, a);
  if (!zone) return;
  exc.zp2 = zone;
  exc.graphicsState.gep2 = toUint16(exc.stack[a]!);
}

/** SZPS: all three zone pointers. */
export function setZonePointers(exc: ExecContext, a: number): void {
  const zone = zoneNumbered(exc, a);
  if (!zone) return;
  exc.zp0 = exc.zp1 = exc.zp2 = zone;
  const { graphicsState } = exc;
  graphicsState.gep0 = graphicsState.gep1 = graphicsState.gep2 = toUint16(exc.stack[a]!);
}

/** The loop count FreeType allows, as a heuristic bound on a runaway loop. */
const MAX_LOOP = 0xffff;

/** SLOOP: how many points the next looping instruction takes. */
export function setLoop(exc: ExecContext, a: number): void {
  const loop = exc.stack[a]!;
  if (loop < 0) exc.fail('Bad_Argument');
  else exc.graphicsState.loop = Math.min(loop, MAX_LOOP);
}

/** RTG, RTHG, RTDG, RDTG, RUTG and ROFF, by the round state each sets. */
export function setRoundState(state: RoundStateValue): (exc: ExecContext) => void {
  return (exc) => {
    exc.graphicsState.roundState = state;
  };
}

/** SROUND: super rounding on the pixel grid. */
export function setSuperRound(exc: ExecContext, a: number): void {
  exc.superRound = superRoundOf(SUPER_ROUND_GRID, exc.stack[a]!);
  exc.graphicsState.roundState = RoundState.SUPER;
}

/** S45ROUND: super rounding on the grid of a 45 degree vector. */
export function setSuperRound45(exc: ExecContext, a: number): void {
  exc.superRound = superRoundOf(SUPER_ROUND_45_GRID, exc.stack[a]!);
  exc.graphicsState.roundState = RoundState.SUPER_45;
}

export function setMinimumDistance(exc: ExecContext, a: number): void {
  exc.graphicsState.minimumDistance = exc.stack[a]!;
}

export function setControlValueCutIn(exc: ExecContext, a: number): void {
  exc.graphicsState.controlValueCutIn = exc.stack[a]!;
}

export function setSingleWidthCutIn(exc: ExecContext, a: number): void {
  exc.graphicsState.singleWidthCutIn = exc.stack[a]!;
}

/** SSW: the single width, which the stack holds in font units. */
export function setSingleWidth(exc: ExecContext, a: number): void {
  exc.graphicsState.singleWidthValue = ftMulFix(exc.stack[a]!, exc.scale);
}

export function setAutoFlipOn(exc: ExecContext): void {
  exc.graphicsState.isAutoFlip = true;
}

export function setAutoFlipOff(exc: ExecContext): void {
  exc.graphicsState.isAutoFlip = false;
}

export function setDeltaBase(exc: ExecContext, a: number): void {
  exc.graphicsState.deltaBase = toUint16(exc.stack[a]!);
}

/** The largest delta shift: a step of 1/64 pixel. */
const MAX_DELTA_SHIFT = 6;

export function setDeltaShift(exc: ExecContext, a: number): void {
  const shift = exc.stack[a]!;
  if (shift < 0 || shift > MAX_DELTA_SHIFT) exc.fail('Bad_Argument');
  else exc.graphicsState.deltaShift = shift;
}

/** The INSTCTRL selector that waives backward compatibility for one glyph. */
const SELECTOR_NATIVE_CLEARTYPE = 3;

/**
 * INSTCTRL: the control value program sets a flag of `instructControl`, by a selector from one to
 * three and the flag's own value or zero. A glyph program may only set or clear the waiver of
 * backward compatibility, for itself. Any other use does nothing.
 */
export function instructionControl(exc: ExecContext, a: number): void {
  const value = exc.stack[a]!;
  const selector = exc.stack[a + 1]!;
  if (selector < 1 || selector > 3) return;
  const flag = 1 << (selector - 1);
  if (value !== 0 && value !== flag) return;
  if (exc.iniRange === CodeRange.CVT)
    exc.graphicsState.instructControl = (exc.graphicsState.instructControl & ~flag) | value;
  else if (exc.iniRange === CodeRange.GLYPH && selector === SELECTOR_NATIVE_CLEARTYPE)
    exc.backwardCompatibility = (value & 4) ^ 4;
}

/** `interpreter_version`: FreeType's default v40 interpreter. */
const INTERPRETER_VERSION = 40;

/**
 * The GETINFO selector bits whose answer bits a v40 interpreter sets outside monochrome mode, for
 * the FT_LOAD_DEFAULT load Godot asks for: subpixel hinting, symmetric smoothing, subpixel
 * positioned and grayscale ClearType.
 */
const SUBPIXEL_ANSWERS: readonly (readonly [selector: number, answer: number])[] = [
  [64, 1 << 13],
  [1024, 1 << 17],
  [2048, 1 << 18],
  [4096, 1 << 19],
];

/**
 * GETINFO: the interpreter's version and features. Godot's glyphs are neither rotated, stretched
 * nor loaded in grayscale mode, and a variable font always has a blend in Godot.
 */
export function getInformation(exc: ExecContext, a: number): void {
  const selector = exc.stack[a]!;
  let answer = (selector & 1) !== 0 ? INTERPRETER_VERSION : 0;
  if ((selector & 8) !== 0 && exc.face.axisCount > 0) answer |= 1 << 10;
  for (const [bit, answerBit] of SUBPIXEL_ANSWERS) if ((selector & bit) !== 0) answer |= answerBit;
  exc.stack[a] = answer;
}

/**
 * GETVARIATION: the normalised coordinate of each axis, in 2.14. Godot draws a variable font at
 * its default instance, whose every coordinate is zero.
 */
export function getVariation(exc: ExecContext, a: number): void {
  const { axisCount } = exc.face;
  if (axisCount >= exc.stack.length + 1 - exc.top) {
    exc.fail('Stack_Overflow');
    return;
  }
  exc.stack.fill(0, a, a + axisCount);
  exc.newTop += axisCount;
}

/** GETDATA: the number FreeType answers, undocumented. */
export function getData(exc: ExecContext, a: number): void {
  exc.stack[a] = 17;
}

export function measurePixelsPerEm(exc: ExecContext, a: number): void {
  exc.stack[a] = exc.ppem;
}

/** MPS: the point size FreeType's subpixel interpreter answers, the size in 26.6. */
export function measurePointSize(exc: ExecContext, a: number): void {
  exc.stack[a] = exc.pointSize;
}

/** ROUND: the distance in the current round state. NROUND rounds nothing, as no engine compensates. */
export function round(exc: ExecContext, a: number): void {
  exc.stack[a] = exc.round(exc.stack[a]!);
}

/** DEBUG: FreeType does not pop its argument, and stops the program. */
export function debug(exc: ExecContext): void {
  exc.fail('Debug_OpCode');
}
