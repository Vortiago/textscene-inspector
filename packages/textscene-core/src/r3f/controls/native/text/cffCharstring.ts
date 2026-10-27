/**
 * Runs a Type 2 charstring (Adobe Technical Note 5177) to the contours it draws, in 16.16 fixed-point
 * px at the font size with y up. It follows FreeType's Adobe engine
 * (`cf2_interpT2CharString` in `psintrp.c`), which Godot's text server loads CFF glyphs through, in
 * what it accepts as well as in what it draws: FreeType refuses a charstring for an operand of the
 * wrong type, an out-of-range subroutine or an operator short of operands, and so does this. Such a
 * charstring draws nothing. The outline is hinted in y, as Godot loads it: the hints move stem
 * edges onto the pixel grid, and the glyph path in `cffGlyphPath.ts` applies them.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ArithmeticOperators } from './cffArithmetic';
import { BlueZones } from './cffBlues';
import { GlyphHints, HintMask } from './cffGlyphHints';
import { GlyphPath } from './cffGlyphPath';
import type { StemHint } from './cffHintEdge';
import { MalformedCharstring, OperandStack } from './cffOperandStack';
import { FLEX_OPERANDS, PathOperators } from './cffPathOperators';
import { ContourBuilder, type CharstringContour } from './cffPen';
import type { PrivateBlues } from './cffPrivateDict';
import { twoByteInteger, type CffFont, type CffPrivate } from './cffTables';

/** `CF2_OPERAND_STACK_SIZE`, and `CFF2_DEFAULT_STACK` for a CFF2 table. */
const OPERAND_STACK_CFF1 = 48;
const OPERAND_STACK_CFF2 = 513;

/**
 * `CF2_MAX_SUBR`: the subroutine calls nested below the glyph's own charstring. The specification
 * asks for 10. FreeType checks for more than 16 but keeps room for 16, so a 17th call fails too.
 */
const MAX_SUBROUTINE_DEPTH = 16;

/** The instructions one charstring may run. FreeType's number "matches Avalon" (`psintrp.c`). */
const INSTRUCTION_LIMIT = 20_000_000;

/** Where a glyph's own charstring, and the base of a `seac`, starts drawing. */
const ORIGIN = { x: 0, y: 0 };

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

/** The operators that paint, each by the `PathOperators` method that reads its operands. */
const PATH_OPERATORS = new Map<number, (path: PathOperators) => void>([
  [OP.rmoveto, (path) => path.relativeMove()],
  [OP.hmoveto, (path) => path.horizontalMove()],
  [OP.vmoveto, (path) => path.verticalMove()],
  [OP.rlineto, (path) => path.relativeLines()],
  [OP.hlineto, (path) => path.alternatingLines(true)],
  [OP.vlineto, (path) => path.alternatingLines(false)],
  [OP.rrcurveto, (path) => path.relativeCurves()],
  [OP.rcurveline, (path) => path.curvesThenLine()],
  [OP.rlinecurve, (path) => path.linesThenCurves()],
  [OP.vvcurveto, (path) => path.verticalVerticalCurves()],
  [OP.hhcurveto, (path) => path.horizontalHorizontalCurves()],
  [OP.vhcurveto, (path) => path.alternatingCurves(false)],
  [OP.hvcurveto, (path) => path.alternatingCurves(true)],
]);

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
  private readonly glyphPath: GlyphPath;
  private readonly hints = new GlyphHints();
  /** The charstrings that called into the one being read, outermost first. */
  private readonly callers: ByteCursor[] = [];
  private cursor: ByteCursor;
  private vsindex: number;
  private hasBlended = false;

  /**
   * `origin` is where the first relative move starts: a `seac` accent is drawn at an offset.
   * `glyphPrivate` stays that of the glyph a component belongs to, as in FreeType, and so do its `blues`.
   */
  constructor(
    private readonly font: CffFont,
    private readonly glyphPrivate: CffPrivate,
    private readonly blues: BlueZones,
    charstring: { start: number; end: number },
    private readonly contours: CharstringContour[],
    private readonly isComponent: boolean,
    origin: { x: number; y: number }
  ) {
    this.stack = new OperandStack(font.isCff2 ? OPERAND_STACK_CFF2 : OPERAND_STACK_CFF1);
    this.arithmetic = new ArithmeticOperators(this.stack);
    this.glyphPath = new GlyphPath(new ContourBuilder(contours), this.hints, blues, origin.y);
    this.path = new PathOperators(this.stack, this.glyphPath, origin.x, origin.y);
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
    const { stack } = this;
    switch (op) {
      case OP.hstem:
      case OP.hstemhm:
        if (!this.hints.mask.isValid) this.declareStems(this.hints.horizontalStems);
        break;
      case OP.vstem:
      case OP.vstemhm:
        if (!this.hints.mask.isValid) this.declareStems(this.hints.verticalStems);
        break;
      case OP.hintmask:
        this.maskHints();
        break;
      case OP.cntrmask:
        this.maskCounters();
        break;
      case OP.vsindex:
        this.selectVariationData();
        break;
      default:
        PATH_OPERATORS.get(op)?.(this.path);
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
    } else {
      stack.pushInt(twoByteInteger(op, cursor.readByte()));
    }
  }

  private callSubroutine(isGlobal: boolean): void {
    if (this.callers.length >= MAX_SUBROUTINE_DEPTH)
      throw new MalformedCharstring(`subroutines nest deeper than ${MAX_SUBROUTINE_DEPTH}`);
    const subroutines = isGlobal ? this.font.globalSubrs : this.glyphPrivate.localSubrs;
    const number = this.stack.popInt();
    const entry = subroutines.subroutine(number);
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

  /** The stems an operand list declares: each is a start, relative to the last stem's end, and a width. An odd one out is the glyph's width. */
  private declareStems(stems: StemHint[]): void {
    const { stack } = this;
    let position = 0;
    for (let i = stack.count & 1; i < stack.count; i += 2) {
      const min = (position = (position + stack.real(i)) | 0);
      const max = (position = (position + stack.real(i + 1)) | 0);
      stems.push({ min, max, used: false, minDS: 0, maxDS: 0 });
    }
  }

  /**
   * `hintmask`: operands left on the stack are a last `vstem`, and the bytes after the operator
   * are the mask. FreeType ignores a `hintmask` with more than one operand once a mask is set, mask
   * bytes included, which then run as operators.
   */
  private maskHints(): void {
    this.readMask(this.hints.mask);
  }

  /** `cntrmask`: as a `hintmask`, but the mask only places and locks the stems of a counter group, and sets no mask. */
  private maskCounters(): void {
    const counterMask = new HintMask();
    if (this.readMask(counterMask)) this.glyphPath.lockCounterStems(counterMask);
  }

  /** Declares the vstem the operands hold and reads the mask bytes into `mask`. False when FreeType ignores the operator. */
  private readMask(mask: HintMask): boolean {
    if (this.stack.count > 1 && this.hints.mask.isValid) return false;
    this.declareStems(this.hints.verticalStems);
    mask.read(this.hints.stemCount, () => this.cursor.readByte());
    return true;
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
    for (let i = 0; i < values; i++) stack.markFixed(first + i);
    stack.drop(operands - values);
    this.hasBlended = true;
  }

  /** The two-byte operators: flexes, and for CFF the arithmetic ones. An unknown one clears the stack. */
  private escape(): void {
    const op = this.cursor.readByte();
    const flex = FLEX_OPERANDS.get(op);
    if (flex) {
      this.path.flex(flex);
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
    this.glyphPath.closeOpenPath();
    if (this.font.isCff2 || this.stack.count <= 1) return;
    if (this.isComponent) throw new MalformedCharstring('seac inside a seac component');
    const accentCode = this.stack.popInt();
    const baseCode = this.stack.popInt();
    const y = this.stack.popFixed();
    const x = this.stack.popFixed();
    this.drawComponent(accentCode, { x, y });
    this.drawComponent(baseCode, ORIGIN);
  }

  private drawComponent(standardCode: number, origin: { x: number; y: number }): void {
    const glyphIndex = this.font.glyphOfStandardCode(standardCode);
    const charstring = glyphIndex === null ? null : this.font.charStrings.entry(glyphIndex);
    if (!charstring)
      throw new MalformedCharstring(`seac names standard character ${standardCode}, which the charset lacks`);
    new CharstringRun(
      this.font,
      this.glyphPrivate,
      this.blues,
      charstring,
      this.contours,
      true,
      origin
    ).execute();
  }
}

/** The sizes a font keeps zones for, so a size that changes every frame cannot grow the cache without bound. */
const MAX_SCALES_PER_FONT = 16;

/** Written only by `blueZonesAt`. A font's entry goes when the font's blue values are collected. */
const zonesOfFont = new WeakMap<PrivateBlues, Map<number, BlueZones>>();

/** The zones of `blues` at `scale`, shared by the glyphs of a size: a zone is read-only once built. */
function blueZonesAt(blues: PrivateBlues, scale: number): BlueZones {
  let atScale = zonesOfFont.get(blues);
  if (!atScale) zonesOfFont.set(blues, (atScale = new Map()));
  let zones = atScale.get(scale);
  if (!zones) {
    if (atScale.size >= MAX_SCALES_PER_FONT) atScale.clear();
    atScale.set(scale, (zones = new BlueZones(blues, scale)));
  }
  return zones;
}

/**
 * The contours glyph `glyphIndex` draws at `scale`, the 16.16 factor from a design unit to a
 * pixel, or null for a glyph that does not exist or whose charstring FreeType would refuse to load.
 */
export function interpretCharstring(
  font: CffFont,
  glyphIndex: number,
  scale: number
): CharstringContour[] | null {
  const charstring = font.charStrings.entry(glyphIndex);
  if (!charstring) return null;
  const contours: CharstringContour[] = [];
  const glyphPrivate = font.privateOf(glyphIndex);
  try {
    new CharstringRun(
      font,
      glyphPrivate,
      blueZonesAt(glyphPrivate.blues, scale),
      charstring,
      contours,
      false,
      ORIGIN
    ).execute();
  } catch (error) {
    // A DataView read that leaves the table is a corrupt font, which FreeType also refuses.
    if (error instanceof MalformedCharstring || error instanceof RangeError) return null;
    throw error;
  }
  return contours;
}
