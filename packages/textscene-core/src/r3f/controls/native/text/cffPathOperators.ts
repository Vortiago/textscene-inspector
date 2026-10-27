/**
 * The path-painting operators of a Type 2 charstring: how each reads its operands off the stack,
 * moves the current point and draws through the pen. The operand counts follow FreeType's
 * interpreter (`psintrp.c`) where it differs from the specification: an operator with too many
 * operands drops the extra ones, and one with too few fails.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { OperandStack } from './cffOperandStack';
import { GlyphPen } from './cffPen';

/** `ADD_INT32`: coordinates wrap in 32 bits. */
const add = (a: number, b: number) => (a + b) | 0;

/** The operators `12 34` to `12 37`, with which of a flex's twelve deltas each reads from the stack (`cf2_doFlex`). */
export const FLEX_OPERANDS: ReadonlyMap<number, readonly boolean[]> = new Map([
  // hflex
  [34, [true, false, true, true, true, false, true, false, true, false, true, false]],
  // flex
  [35, Array<boolean>(12).fill(true)],
  // hflex1
  [36, [true, true, true, true, true, false, true, false, true, true, true, false]],
  // flex1: its last delta is read apart, along whichever axis the curve has moved further.
  [37, [true, true, true, true, true, true, true, true, true, true, false, false]],
]);

export class PathOperators {
  /** The current point, which the operators move relative to. */
  constructor(
    private readonly pen: GlyphPen,
    private x: number,
    private y: number
  ) {}

  closeOpenPath(): void {
    this.pen.closeOpenPath();
  }

  relativeMove(stack: OperandStack): void {
    this.y = add(this.y, stack.popFixed());
    this.x = add(this.x, stack.popFixed());
    this.pen.moveTo(this.x, this.y);
  }

  horizontalMove(stack: OperandStack): void {
    this.x = add(this.x, stack.popFixed());
    this.pen.moveTo(this.x, this.y);
  }

  verticalMove(stack: OperandStack): void {
    this.y = add(this.y, stack.popFixed());
    this.pen.moveTo(this.x, this.y);
  }

  relativeLines(stack: OperandStack): void {
    for (let i = 0; i < stack.count; i += 2) this.lineBy(stack.real(i), stack.real(i + 1));
  }

  /** `hlineto` and `vlineto`: lines that alternate between the two axes, the first along `startsHorizontal`. */
  alternatingLines(stack: OperandStack, startsHorizontal: boolean): void {
    let isHorizontal = startsHorizontal;
    for (let i = 0; i < stack.count; i++) {
      this.lineBy(isHorizontal ? stack.real(i) : 0, isHorizontal ? 0 : stack.real(i));
      isHorizontal = !isHorizontal;
    }
  }

  /** `rrcurveto`: a curve for each six operands, the operands left over dropped. */
  relativeCurves(stack: OperandStack): void {
    this.curvesFrom(stack, 0);
  }

  /** `rcurveline`: `rrcurveto` and then a line from the operands left over. */
  curvesThenLine(stack: OperandStack): void {
    const at = this.curvesFrom(stack, 0);
    this.lineBy(stack.real(at), stack.real(at + 1));
  }

  /** `rlinecurve`: lines, then curves while any operand is left, so a partial curve fails. */
  linesThenCurves(stack: OperandStack): void {
    let at = 0;
    for (; at + 6 < stack.count; at += 2) this.lineBy(stack.real(at), stack.real(at + 1));
    for (; at < stack.count; at += 6) this.curveBy(stack, at);
  }

  /** `vvcurveto`: curves that start and end vertical, the first with an optional leading dx. */
  verticalVerticalCurves(stack: OperandStack): void {
    const { count, first } = alignedOperands(stack);
    for (let at = first; at < count; at += 4) {
      const hasLeadingDelta = (count - at) % 2 === 1;
      const x1 = hasLeadingDelta ? add(stack.real(at++), this.x) : this.x;
      const y1 = add(stack.real(at), this.y);
      const x2 = add(stack.real(at + 1), x1);
      const y2 = add(stack.real(at + 2), y1);
      this.curveTo(x1, y1, x2, y2, x2, add(stack.real(at + 3), y2));
    }
  }

  /** `hhcurveto`: curves that start and end horizontal, the first with an optional leading dy. */
  horizontalHorizontalCurves(stack: OperandStack): void {
    const { count, first } = alignedOperands(stack);
    for (let at = first; at < count; at += 4) {
      const hasLeadingDelta = (count - at) % 2 === 1;
      const y1 = hasLeadingDelta ? add(stack.real(at++), this.y) : this.y;
      const x1 = add(stack.real(at), this.x);
      const x2 = add(stack.real(at + 1), x1);
      const y2 = add(stack.real(at + 2), y1);
      this.curveTo(x1, y1, x2, y2, add(stack.real(at + 3), x2), y2);
    }
  }

  /** `hvcurveto` and `vhcurveto`: curves that turn between a horizontal and a vertical tangent, the last with an optional extra delta. */
  alternatingCurves(stack: OperandStack, startsHorizontal: boolean): void {
    const { count, first } = alignedOperands(stack);
    let isHorizontal = startsHorizontal;
    for (let at = first; at < count; at += 4) {
      const hasLastDelta = count - at === 5;
      const lastDelta = hasLastDelta ? stack.real(at + 4) : 0;
      if (isHorizontal) {
        const x1 = add(stack.real(at), this.x);
        const x2 = add(stack.real(at + 1), x1);
        const y2 = add(stack.real(at + 2), this.y);
        this.curveTo(x1, this.y, x2, y2, add(lastDelta, x2), add(stack.real(at + 3), y2));
      } else {
        const y1 = add(stack.real(at), this.y);
        const x2 = add(stack.real(at + 1), this.x);
        const y2 = add(stack.real(at + 2), y1);
        this.curveTo(this.x, y1, x2, y2, add(stack.real(at + 3), x2), add(lastDelta, y2));
      }
      if (hasLastDelta) at++;
      isHorizontal = !isHorizontal;
    }
  }

  /** The two curves of a flex, from the deltas `readFromStack` selects (`cf2_doFlex`). */
  flex(stack: OperandStack, readFromStack: readonly boolean[]): void {
    const isHorizontalFlex = !readFromStack[9];
    const reads = readFromStack.slice(0, isHorizontalFlex ? 9 : 10);
    const points = [this.x, this.y];
    let operand = 0;
    reads.forEach((isRead, i) => {
      points.push(isRead ? add(points[i]!, stack.real(operand++)) : points[i]!);
    });
    if (isHorizontalFlex) points.push(this.y);
    const isLastDeltaOnOneAxis = !readFromStack[10] && !readFromStack[11];
    if (isLastDeltaOnOneAxis) {
      this.addFlexEnd(points, stack.real(operand));
    } else {
      points.push(readFromStack[10] ? add(points[10]!, stack.real(operand++)) : this.x);
      points.push(readFromStack[11] ? add(points[11]!, stack.real(operand)) : this.y);
    }
    this.curveTo(points[2]!, points[3]!, points[4]!, points[5]!, points[6]!, points[7]!);
    this.curveTo(points[8]!, points[9]!, points[10]!, points[11]!, points[12]!, points[13]!);
  }

  /** The last point of a `flex1`: the final delta moves along the axis the five before it moved further along. */
  private addFlexEnd(points: number[], lastDelta: number): void {
    const isAlongX = Math.abs(add(points[10]!, -this.x)) > Math.abs(add(points[11]!, -this.y));
    points.push(isAlongX ? add(points[10]!, lastDelta) : this.x);
    points.push(isAlongX ? this.y : add(points[11]!, lastDelta));
  }

  /** Curves from operand `from` while six remain. Returns where the operands left over begin. */
  private curvesFrom(stack: OperandStack, from: number): number {
    let at = from;
    for (; at + 6 <= stack.count; at += 6) this.curveBy(stack, at);
    return at;
  }

  /** The curve whose six deltas start at operand `at`. */
  private curveBy(stack: OperandStack, at: number): void {
    const x1 = add(stack.real(at), this.x);
    const y1 = add(stack.real(at + 1), this.y);
    const x2 = add(stack.real(at + 2), x1);
    const y2 = add(stack.real(at + 3), y1);
    this.curveTo(x1, y1, x2, y2, add(stack.real(at + 4), x2), add(stack.real(at + 5), y2));
  }

  private lineBy(dx: number, dy: number): void {
    this.x = add(this.x, dx);
    this.y = add(this.y, dy);
    this.pen.lineTo(this.x, this.y);
  }

  private curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.pen.curveTo(x1, y1, x2, y2, x3, y3);
    this.x = x3;
    this.y = y3;
  }
}

/**
 * The operands a curve operator uses: its count with the second bit cleared, which makes an
 * operand list of 4n+2 or 4n+3 the 4n or 4n+1 it should be, and where the first curve starts
 * once the surplus operands are skipped. FreeType enforces the shape this way.
 */
function alignedOperands(stack: OperandStack): { count: number; first: number } {
  const count = stack.count & ~2;
  return { count, first: stack.count - count };
}
