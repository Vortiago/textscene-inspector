/**
 * The TrueType instructions that read and write the storage area and the control value table
 * (`ttinterp.c`, `Ins_RS` to `Ins_RCVT` and `Ins_DELTAC`). An index past either is ignored, and
 * a read past it answers zero. Each takes the stack index `a` of its first argument.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulFix } from '../fontMetrics';
import { isOutside } from './ttArithmetic';
import type { ExecContext } from './ttExecContext';

export function readStorage(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  exc.stack[a] = isOutside(index, exc.storage.length) ? 0 : exc.storage[index]!;
}

export function writeStorage(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  if (!isOutside(index, exc.storage.length)) exc.writeStorage(index, exc.stack[a + 1]!);
}

/** WCVTP: a control value in pixels. */
export function writeControlValueInPixels(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  if (!isOutside(index, exc.controlValues.length)) exc.writeControlValue(index, exc.stack[a + 1]!);
}

/**
 * WCVTF: a control value in font units. FreeType writes it to the table in use without the glyph
 * program's copy, so a glyph's write lasts for the size.
 */
export function writeControlValueInFontUnits(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  if (!isOutside(index, exc.controlValues.length))
    exc.controlValues[index] = ftMulFix(exc.stack[a + 1]!, exc.scale);
}

export function readControlValue(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  exc.stack[a] = isOutside(index, exc.controlValues.length) ? 0 : exc.controlValues[index]!;
}

/** DELTAP1 and DELTAC1 start at the delta base; the 2 and 3 forms 16 and 32 ppem above it. */
const DELTA_PPEM_RANGE = 16;

/** 0 for DELTAP1 and DELTAC1, 1 for the 2 forms, 2 for the 3 forms. */
function deltaForm(opcode: number): number {
  switch (opcode) {
    case 0x71:
    case 0x74:
      return 1;
    case 0x72:
    case 0x75:
      return 2;
    default:
      return 0;
  }
}

/** The current ppem's place in the instruction's range of 16 ppem, which may lie outside it. */
function ppemInDeltaRange(exc: ExecContext): number {
  return exc.ppem - exc.graphicsState.deltaBase - DELTA_PPEM_RANGE * deltaForm(exc.opcode);
}

/**
 * `Ins_DELTAP` and `Ins_DELTAC`: pops the delta pairs below the count, each a target and an
 * argument byte, and answers how many there are. It answers 0 when the current ppem is outside
 * the instruction's range, so no pair applies.
 */
export function popDeltaPairs(exc: ExecContext, a: number): number {
  let pairCount = exc.stack[a]!;
  const pairsOnStack = Math.trunc(exc.newTop / 2);
  if (pairCount < 0 || pairCount > pairsOnStack) pairCount = pairsOnStack;
  exc.newTop -= 2 * pairCount;
  return (ppemInDeltaRange(exc) & ~0xf) === 0 ? pairCount : 0;
}

/** The target of delta pair `pair` below `a`, nearest first: a point or a control value. */
export function deltaTarget(exc: ExecContext, a: number, pair: number): number {
  return exc.stack[a - 1 - 2 * pair]!;
}

/** The 26.6 step of delta pair `pair` below `a`, or null for a pair whose high nibble names another ppem. */
export function deltaStep(exc: ExecContext, a: number, pair: number): number | null {
  const argument = exc.stack[a - 2 - 2 * pair]!;
  if ((argument & 0xf0) !== ppemInDeltaRange(exc) << 4) return null;
  const step = (argument & 0xf) - 8;
  const stepUnit = 1 << (6 - exc.graphicsState.deltaShift);
  return (step >= 0 ? step + 1 : step) * stepUnit;
}

/** DELTAC1 to DELTAC3: steps a control value at one ppem. */
export function deltaControlValue(exc: ExecContext, a: number): void {
  const pairCount = popDeltaPairs(exc, a);
  for (let pair = 0; pair < pairCount; pair++) {
    const step = deltaStep(exc, a, pair);
    const index = deltaTarget(exc, a, pair);
    if (step !== null && !isOutside(index, exc.controlValues.length))
      exc.writeControlValue(index, exc.controlValues[index]! + step);
  }
}
