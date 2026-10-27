/**
 * Runs a Type 2 charstring (Adobe Technical Note #5177) to the contours it draws, in the
 * charstring's 16.16 fixed-point units with y up. It follows FreeType's Adobe engine
 * (`cf2_interpT2CharString` in `psintrp.c`), which Godot's text server loads CFF glyphs through, in
 * what it accepts as well as in what it draws: FreeType refuses a charstring for an operand of the
 * wrong type, an out-of-range subroutine or an operator short of operands, and so does this. Such a
 * charstring draws nothing. Hints only count, since the outline is the unhinted one (#931).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ArithmeticOperators } from './cffArithmetic';
import { MalformedCharstring, OperandStack } from './cffOperandStack';
import { FLEX_OPERANDS, PathOperators } from './cffPathOperators';
import { GlyphPen, type CharstringContour } from './cffPen';
import { subrBias, type CffFont, type CffPrivate } from './cffTables';

/** `CF2_OPERAND_STACK_SIZE`, and `CFF2_DEFAULT_STACK` for a CFF2 table. */
const OPERAND_STACK_CFF1 = 48;
const OPERAND_STACK_CFF2 = 513;

/**
 * `CF2_MAX_SUBR`: the subroutine calls nested below the glyph's own charstring. The specification
 * asks for 10. FreeType checks for more than 16 but keeps room for 16, so a 17th call fails too.
 */
const MAX_SUBROUTINE_DEPTH = 16;

/** `CF2_MAX_HINTS`: the horizontal and vertical stems together that a hint mask can address. */
const MAX_STEMS = 96;

/** The instructions one charstring may run. FreeType's number "matches Avalon" (`psintrp.c`). */
const INSTRUCTION_LIMIT = 20_000_000;

const OP = {
  hstem: 1,
  vstem: 3,
  vmoveto: 4,
  rlineto: 5,
  hlineto: 6,
  vlineto: 7,
  rrcurveto: 8,
  callsubr: 10,
  return: 11,
  escape: 12,
  endchar: 14,
  vsindex: 15,
  blend: 16,
  hstemhm: 18,
  hintmask: 19,
  cntrmask: 20,
  rmoveto: 21,
  hmoveto: 22,
  vstemhm: 23,
  rcurveline: 24,
  rlinecurve: 25,
  vvcurveto: 26,
  hhcurveto: 27,
  shortint: 28,
  callgsubr: 29,
  vhcurveto: 30,
  hvcurveto: 31,
  fixedNumber: 255,
} as const;

/** A charstring or subroutine and the byte to read next. A read past its end gives 0, as `cf2_buf_readByte` does. */
class ByteCursor {
  constructor(
    private readonly dv: DataView,
    private at: number,
    private readonly end: number
  ) {}

  get isEnd(): boolean {
    return this.at >= this.end;
  }

  readByte(): number {
    return this.isEnd ? 0 : this.dv.getUint8(this.at++);
  }
}

/** One run of `cf2_interpT2CharString`: the charstring of a glyph, or of a `seac` component of one. */
class CharstringRun {
  private readonly stack: OperandStack;
  private readonly arithmetic: ArithmeticOperators;
  private readonly path: PathOperators;
  private readonly pen: GlyphPen;
  /** The charstrings that called into the one being read, outermost first. */
  private readonly callers: ByteCursor[] = [];
  private cursor: ByteCursor;
  private stemCount = 0;
  private hasHintMask = false;
  private vsindex: number;
  private hasBlended = false;

  /**
   * `origin` is where the first relative move starts: a `seac` accent is drawn at an offset.
   * `glyphPrivate` stays that of the glyph a component belongs to, as in FreeType.
   */
  constructor(
    private readonly font: CffFont,
    private readonly glyphPrivate: CffPrivate,
    charstring: { start: number; end: number },
    private readonly contours: CharstringContour[],
    private readonly isComponent: boolean,
    origin: { x: number; y: number }
  ) {
    this.stack = new OperandStack(font.isCff2 ? OPERAND_STACK_CFF2 : OPERAND_STACK_CFF1);
    this.arithmetic = new ArithmeticOperators(this.stack);
    this.pen = new GlyphPen(contours);
    this.path = new PathOperators(this.pen, origin.x, origin.y);
    this.cursor = new ByteCursor(font.dv, charstring.start, charstring.end);
    this.vsindex = glyphPrivate.vsindex;
  }

  execute(): void {
    for (let remaining = INSTRUCTION_LIMIT; remaining > 0; remaining--) {
      if (this.step(this.nextOperator())) return;
    }
    throw new MalformedCharstring(`charstring runs past ${INSTRUCTION_LIMIT} instructions`);
  }

  /** The next operator or number byte. The end of a charstring acts as `return`, or as `endchar` at the top. */
  private nextOperator(): number {
    if (this.cursor.isEnd) return this.callers.length > 0 ? OP.return : OP.endchar;
    const op = this.cursor.readByte();
    // CFF2 ignores an explicit `return` and `endchar`.
    return this.font.isCff2 && (op === OP.return || op === OP.endchar) ? 0 : op;
  }

  /** Runs one operator. True when it has ended the glyph. */
  private step(op: number): boolean {
    if (op >= 32 || op === OP.shortint) {
      this.pushNumber(op);
      return false;
    }
    switch (op) {
      case OP.callsubr:
      case OP.callgsubr:
        this.callSubroutine(op === OP.callgsubr);
        return false;
      case OP.return:
        this.returnFromSubroutine();
        return false;
      case OP.blend:
        this.blend();
        return false;
      case OP.escape:
        this.escape();
        return false;
      case OP.endchar:
        this.endChar();
        return true;
      default:
        this.runAndClear(op);
        return false;
    }
  }

  /** An operator that leaves nothing on the stack, and an unknown one, which FreeType ignores. */
  private runAndClear(op: number): void {
    const { stack, path } = this;
    switch (op) {
      case OP.hstem:
      case OP.vstem:
      case OP.hstemhm:
      case OP.vstemhm:
        if (!this.hasHintMask) this.countStems();
        break;
      case OP.hintmask:
        this.maskHints(true);
        break;
      case OP.cntrmask:
        this.maskHints(false);
        break;
      case OP.vsindex:
        this.selectVariationData();
        break;
      case OP.rmoveto:
        path.relativeMove(stack);
        break;
      case OP.hmoveto:
        path.horizontalMove(stack);
        break;
      case OP.vmoveto:
        path.verticalMove(stack);
        break;
      case OP.rlineto:
        path.relativeLines(stack);
        break;
      case OP.hlineto:
        path.alternatingLines(stack, true);
        break;
      case OP.vlineto:
        path.alternatingLines(stack, false);
        break;
      case OP.rrcurveto:
        path.relativeCurves(stack);
        break;
      case OP.rcurveline:
        path.curvesThenLine(stack);
        break;
      case OP.rlinecurve:
        path.linesThenCurves(stack);
        break;
      case OP.vvcurveto:
        path.verticalVerticalCurves(stack);
        break;
      case OP.hhcurveto:
        path.horizontalHorizontalCurves(stack);
        break;
      case OP.vhcurveto:
        path.alternatingCurves(stack, false);
        break;
      case OP.hvcurveto:
        path.alternatingCurves(stack, true);
        break;
    }
    stack.clear();
  }

  private pushNumber(op: number): void {
    const { stack, cursor } = this;
    if (op === OP.shortint) {
      const high = cursor.readByte();
      stack.pushInt((((high << 8) | cursor.readByte()) << 16) >> 16);
    } else if (op === OP.fixedNumber) {
      const bytes = [cursor.readByte(), cursor.readByte(), cursor.readByte(), cursor.readByte()];
      stack.pushFixed((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!);
    } else if (op <= 246) {
      stack.pushInt(op - 139);
    } else if (op <= 250) {
      stack.pushInt((op - 247) * 256 + cursor.readByte() + 108);
    } else {
      stack.pushInt(-((op - 251) * 256 + cursor.readByte()) - 108);
    }
  }

  private callSubroutine(isGlobal: boolean): void {
    if (this.callers.length >= MAX_SUBROUTINE_DEPTH)
      throw new MalformedCharstring(`subroutines nest deeper than ${MAX_SUBROUTINE_DEPTH}`);
    const subroutines = isGlobal ? this.font.globalSubrs : this.glyphPrivate.localSubrs;
    const number = this.stack.popInt();
    const entry = subroutines.entry(number + subrBias(subroutines.count));
    if (!entry)
      throw new MalformedCharstring(
        `${isGlobal ? 'global' : 'local'} subroutine ${number} is not in the font`
      );
    this.callers.push(this.cursor);
    this.cursor = new ByteCursor(this.font.dv, entry.start, entry.end);
  }

  private returnFromSubroutine(): void {
    const caller = this.callers.pop();
    if (!caller) throw new MalformedCharstring('return from the top-level charstring');
    this.cursor = caller;
  }

  /** The stems an operand list declares, each two operands; an odd one out is the width. */
  private countStems(): void {
    this.stemCount += this.stack.count >> 1;
  }

  /**
   * `hintmask` and `cntrmask`: operands left on the stack are a last `vstem`, and the bytes after
   * the operator are the mask. Only a `hintmask` ends the stems: a later `hstem` is then ignored.
   * FreeType ignores a `hintmask` that comes after the mask with more than one operand, mask bytes
   * included, which then run as operators.
   */
  private maskHints(endsStems: boolean): void {
    if (this.stack.count > 1 && this.hasHintMask) return;
    this.countStems();
    if (this.stemCount > MAX_STEMS)
      throw new MalformedCharstring(`${this.stemCount} stems are more than the ${MAX_STEMS} a mask holds`);
    if (endsStems) this.hasHintMask = true;
    for (let maskByte = 0; maskByte < (this.stemCount + 7) >> 3; maskByte++) this.cursor.readByte();
  }

  /** `vsindex` selects the variation data a later `blend` reads. Only CFF2 has it, and only before a `blend`. */
  private selectVariationData(): void {
    if (!this.font.isCff2) return;
    if (this.hasBlended) throw new MalformedCharstring('vsindex after blend');
    const index = this.stack.popInt();
    if (index >= 0) this.vsindex = index;
  }

  /**
   * `blend` at the default instance, where every region weighs 0: each value keeps its default
   * and its deltas go. A `blend` of `n` values needs `n * (regions + 1)` operands (`cf2_doBlend`).
   */
  private blend(): void {
    const { stack } = this;
    if (!this.font.isCff2) {
      stack.clear();
      return;
    }
    const regions = this.font.regionCount(this.vsindex);
    if (regions === null)
      throw new MalformedCharstring(`blend names variation data ${this.vsindex}, which the font lacks`);
    const values = stack.popInt();
    const operands = values * (regions + 1);
    if (values < 0 || operands > stack.count)
      throw new MalformedCharstring(
        `blend of ${values} values needs ${operands} operands, got ${stack.count}`
      );
    const first = stack.count - operands;
    for (let i = 0; i < values; i++) stack.setReal(first + i, stack.real(first + i));
    stack.drop(operands - values);
    this.hasBlended = true;
  }

  /** The two-byte operators: flexes, and for CFF the arithmetic ones. An unknown one clears the stack. */
  private escape(): void {
    const op = this.cursor.readByte();
    const flex = FLEX_OPERANDS.get(op);
    if (flex) {
      this.path.flex(this.stack, flex);
    } else if (!this.font.isCff2 && this.arithmetic.run(op)) {
      return;
    }
    this.stack.clear();
  }

  /**
   * `endchar`. With more than one operand left on a CFF it is the deprecated `seac`: `adx ady
   * bchar achar`, an accent drawn at (adx, ady) and then the base character, both named by their
   * standard character code.
   */
  private endChar(): void {
    this.path.closeOpenPath();
    if (this.font.isCff2 || this.stack.count <= 1) return;
    if (this.isComponent) throw new MalformedCharstring('seac inside a seac component');
    const accentCode = this.stack.popInt();
    const baseCode = this.stack.popInt();
    const y = this.stack.popFixed();
    const x = this.stack.popFixed();
    this.drawComponent(accentCode, { x, y });
    this.drawComponent(baseCode, { x: 0, y: 0 });
  }

  private drawComponent(standardCode: number, origin: { x: number; y: number }): void {
    const glyphIndex = this.font.glyphOfStandardCode(standardCode);
    const charstring = glyphIndex === null ? null : this.font.charStrings.entry(glyphIndex);
    if (!charstring)
      throw new MalformedCharstring(`seac names standard character ${standardCode}, which the charset lacks`);
    new CharstringRun(this.font, this.glyphPrivate, charstring, this.contours, true, origin).execute();
  }
}

/**
 * The contours glyph `glyphIndex` draws, or null for a glyph that does not exist or whose
 * charstring FreeType would refuse to load.
 */
export function interpretCharstring(font: CffFont, glyphIndex: number): CharstringContour[] | null {
  const charstring = font.charStrings.entry(glyphIndex);
  if (!charstring) return null;
  const contours: CharstringContour[] = [];
  try {
    new CharstringRun(font, font.privateOf(glyphIndex), charstring, contours, false, {
      x: 0,
      y: 0,
    }).execute();
  } catch (error) {
    // A DataView read that leaves the table is a corrupt font, which FreeType also refuses.
    if (error instanceof MalformedCharstring || error instanceof RangeError) return null;
    throw error;
  }
  return contours;
}
