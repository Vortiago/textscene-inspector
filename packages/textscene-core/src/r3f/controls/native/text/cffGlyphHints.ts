/**
 * What a charstring declares about its hints: the horizontal and vertical stems, and the mask that
 * says which of them hold for the outline drawn next. Stems come first in the charstring; a mask
 * can switch them on and off as the outline goes on (hint substitution).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { StemHint } from './cffHintEdge';
import { MalformedCharstring } from './cffOperandStack';

/** `CF2_MAX_HINTS`: the horizontal and vertical stems together that a hint mask can address. */
export const MAX_STEMS = 96;

/** `CF2_HintMaskRec`: one bit per stem, horizontal stems first, the first stem in the top bit of the first byte. */
export class HintMask {
  /** True once a mask is set: later stems are then ignored. */
  isValid = false;
  /** True from setting the mask until a hint map uses it. */
  isNew = false;
  private bits: boolean[] = [];

  get bitCount(): number {
    return this.bits.length;
  }

  /** Reads the mask for `stemCount` stems from `readByte` (`cf2_hintmask_read`). No byte is read for no stems. */
  read(stemCount: number, readByte: () => number): void {
    this.setCount(stemCount);
    const bytes = Array.from({ length: (stemCount + 7) >> 3 }, readByte);
    this.bits = this.bits.map((_, i) => ((bytes[i >> 3]! >> (7 - (i & 7))) & 1) === 1);
  }

  /** Turns all `stemCount` stems on (`cf2_hintmask_setAll`): the mask a glyph without a `hintmask` has. */
  setAll(stemCount: number): void {
    this.setCount(stemCount);
    this.bits.fill(true);
  }

  /** The mask as it is now, to switch bits off without changing it. */
  copyBits(): boolean[] {
    return [...this.bits];
  }

  private setCount(stemCount: number): void {
    if (stemCount > MAX_STEMS)
      throw new MalformedCharstring(`${stemCount} stems are more than the ${MAX_STEMS} a mask holds`);
    this.bits = Array<boolean>(stemCount).fill(false);
    this.isValid = true;
    this.isNew = true;
  }
}

export class GlyphHints {
  readonly horizontalStems: StemHint[] = [];
  readonly verticalStems: StemHint[] = [];
  readonly mask = new HintMask();

  get stemCount(): number {
    return this.horizontalStems.length + this.verticalStems.length;
  }
}
