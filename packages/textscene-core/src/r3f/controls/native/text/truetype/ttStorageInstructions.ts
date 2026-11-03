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

/**
 * `Ins_DELTAP` and `Ins_DELTAC`: the delta pairs the instruction pops below its count, nearest
 * first, each a target and an argument byte. Calls `apply` with the target and the 26.6 step of
 * each pair whose high nibble names the current ppem.
 */
export function forEachDelta(
  exc: ExecContext,
  a: number,
  apply: (target: number, step: number) => void
): void {
  let pairCount = exc.stack[a]!;
  const pairsOnStack = Math.trunc(exc.newTop / 2);
  if (pairCount < 0 || pairCount > pairsOnStack) pairCount = pairsOnStack;
  exc.newTop -= 2 * pairCount;

  const ppemInRange = exc.ppem - exc.graphicsState.deltaBase - DELTA_PPEM_RANGE * deltaForm(exc.opcode);
  if ((ppemInRange & ~0xf) !== 0) return;
  const stepUnit = 1 << (6 - exc.graphicsState.deltaShift);
  for (let pair = 0; pair < pairCount; pair++) {
    const target = exc.stack[a - 1 - 2 * pair]!;
    const argument = exc.stack[a - 2 - 2 * pair]!;
    if ((argument & 0xf0) !== ppemInRange << 4) continue;
    const step = (argument & 0xf) - 8;
    apply(target, (step >= 0 ? step + 1 : step) * stepUnit);
  }
}

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

/** DELTAC1 to DELTAC3: steps a control value at one ppem. */
export function deltaControlValue(exc: ExecContext, a: number): void {
  forEachDelta(exc, a, (index, step) => {
    if (!isOutside(index, exc.controlValues.length))
      exc.writeControlValue(index, exc.controlValues[index]! + step);
  });
}
