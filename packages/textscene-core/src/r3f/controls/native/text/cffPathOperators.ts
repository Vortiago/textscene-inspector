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
    private readonly stack: OperandStack,
    private readonly pen: GlyphPen,
    private x: number,
    private y: number
  ) {}

  relativeMove(): void {
    this.y = add(this.y, this.stack.popFixed());
    this.x = add(this.x, this.stack.popFixed());
    this.pen.moveTo(this.x, this.y);
  }

  horizontalMove(): void {
    this.x = add(this.x, this.stack.popFixed());
    this.pen.moveTo(this.x, this.y);
  }

  verticalMove(): void {
    this.y = add(this.y, this.stack.popFixed());
    this.pen.moveTo(this.x, this.y);
  }

  relativeLines(): void {
    for (let i = 0; i < this.stack.count; i += 2) this.lineBy(this.real(i), this.real(i + 1));
  }

  /** `hlineto` and `vlineto`: lines that alternate between the two axes, the first along `startsHorizontal`. */
  alternatingLines(startsHorizontal: boolean): void {
    let isHorizontal = startsHorizontal;
    for (let i = 0; i < this.stack.count; i++) {
      this.lineBy(isHorizontal ? this.real(i) : 0, isHorizontal ? 0 : this.real(i));
      isHorizontal = !isHorizontal;
    }
  }

  /** `rrcurveto`: a curve for each six operands, the operands left over dropped. */
  relativeCurves(): void {
    this.curves();
  }

  /** `rcurveline`: `rrcurveto` and then a line from the operands left over. */
  curvesThenLine(): void {
    const at = this.curves();
    this.lineBy(this.real(at), this.real(at + 1));
  }

  /** `rlinecurve`: lines, then curves while any operand is left, so a partial curve fails. */
  linesThenCurves(): void {
    let at = 0;
    for (; at + 6 < this.stack.count; at += 2) this.lineBy(this.real(at), this.real(at + 1));
    for (; at < this.stack.count; at += 6) this.curveBy(at);
  }

  /** `vvcurveto`: curves that start and end vertical, the first with an optional leading dx. */
  verticalVerticalCurves(): void {
    const { count, first } = alignedOperands(this.stack);
    for (let at = first; at < count; at += 4) {
      const hasLeadingDelta = (count - at) % 2 === 1;
      const x1 = hasLeadingDelta ? add(this.real(at++), this.x) : this.x;
      const y1 = add(this.real(at), this.y);
      const x2 = add(this.real(at + 1), x1);
      const y2 = add(this.real(at + 2), y1);
      this.curveTo(x1, y1, x2, y2, x2, add(this.real(at + 3), y2));
    }
  }

  /** `hhcurveto`: curves that start and end horizontal, the first with an optional leading dy. */
  horizontalHorizontalCurves(): void {
    const { count, first } = alignedOperands(this.stack);
    for (let at = first; at < count; at += 4) {
      const hasLeadingDelta = (count - at) % 2 === 1;
      const y1 = hasLeadingDelta ? add(this.real(at++), this.y) : this.y;
      const x1 = add(this.real(at), this.x);
      const x2 = add(this.real(at + 1), x1);
      const y2 = add(this.real(at + 2), y1);
      this.curveTo(x1, y1, x2, y2, add(this.real(at + 3), x2), y2);
    }
  }

  /** `hvcurveto` and `vhcurveto`: curves that turn between a horizontal and a vertical tangent, the last with an optional extra delta. */
  alternatingCurves(startsHorizontal: boolean): void {
    const { count, first } = alignedOperands(this.stack);
    let isHorizontal = startsHorizontal;
    for (let at = first; at < count; at += 4) {
      const hasLastDelta = count - at === 5;
      const lastDelta = hasLastDelta ? this.real(at + 4) : 0;
      if (isHorizontal) {
        const x1 = add(this.real(at), this.x);
        const x2 = add(this.real(at + 1), x1);
        const y2 = add(this.real(at + 2), this.y);
        this.curveTo(x1, this.y, x2, y2, add(lastDelta, x2), add(this.real(at + 3), y2));
      } else {
        const y1 = add(this.real(at), this.y);
        const x2 = add(this.real(at + 1), this.x);
        const y2 = add(this.real(at + 2), y1);
        this.curveTo(this.x, y1, x2, y2, add(this.real(at + 3), x2), add(lastDelta, y2));
      }
      if (hasLastDelta) at++;
      isHorizontal = !isHorizontal;
    }
  }

  /** The two curves of a flex, from the deltas `readFromStack` selects (`cf2_doFlex`). */
  flex(readFromStack: readonly boolean[]): void {
    const isHorizontalFlex = !readFromStack[9];
    const reads = readFromStack.slice(0, isHorizontalFlex ? 9 : 10);
    const points = [this.x, this.y];
    let operand = 0;
    reads.forEach((isRead, i) => {
      points.push(isRead ? add(points[i]!, this.real(operand++)) : points[i]!);
    });
    if (isHorizontalFlex) points.push(this.y);
    const isLastDeltaOnOneAxis = !readFromStack[10] && !readFromStack[11];
    if (isLastDeltaOnOneAxis) {
      this.addFlexEnd(points, this.real(operand));
    } else {
      points.push(readFromStack[10] ? add(points[10]!, this.real(operand++)) : this.x);
      points.push(readFromStack[11] ? add(points[11]!, this.real(operand)) : this.y);
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

  /** Curves while six operands remain. Returns where the operands left over begin. */
  private curves(): number {
    let at = 0;
    for (; at + 6 <= this.stack.count; at += 6) this.curveBy(at);
    return at;
  }

  /** The curve whose six deltas start at operand `at`. */
  private curveBy(at: number): void {
    const x1 = add(this.real(at), this.x);
    const y1 = add(this.real(at + 1), this.y);
    const x2 = add(this.real(at + 2), x1);
    const y2 = add(this.real(at + 3), y1);
    this.curveTo(x1, y1, x2, y2, add(this.real(at + 4), x2), add(this.real(at + 5), y2));
  }

  private real(index: number): number {
    return this.stack.real(index);
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
