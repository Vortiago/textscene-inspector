import { describe, expect, it } from 'vitest';
import {
  BREAK_TRIM_HINTED_BITS,
  BREAK_TRIM_NAMES,
  BREAK_TRIM_MASK,
  JUSTIFICATION_HINTED_NAMES,
  VISIBLE_CHARACTERS_BEHAVIOR_NAMES,
} from './textServerEnums';

describe('VISIBLE_CHARACTERS_BEHAVIOR_NAMES', () => {
  it('names the five behaviours in declaration order (text_server.h:90-96)', () => {
    expect(VISIBLE_CHARACTERS_BEHAVIOR_NAMES).toEqual({
      0: 'VC_CHARS_BEFORE_SHAPING',
      1: 'VC_CHARS_AFTER_SHAPING',
      2: 'VC_GLYPHS_AUTO',
      3: 'VC_GLYPHS_LTR',
      4: 'VC_GLYPHS_RTL',
    });
  });
});

describe('justification and line-break flag tables', () => {
  it('lists the six justification bits a hint offers, each as its constant (text_server.h:78-88)', () => {
    expect(JUSTIFICATION_HINTED_NAMES).toEqual({
      1: 'JUSTIFICATION_KASHIDA',
      2: 'JUSTIFICATION_WORD_BOUND',
      8: 'JUSTIFICATION_AFTER_LAST_TAB',
      32: 'JUSTIFICATION_SKIP_LAST_LINE',
      64: 'JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS',
      128: 'JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE',
    });
  });

  it('labels the three bits BREAK_TRIM_MASK keeps (text_server.h:116-120)', () => {
    expect(BREAK_TRIM_NAMES).toEqual({
      32: 'BREAK_TRIM_INDENT',
      64: 'BREAK_TRIM_START_EDGE_SPACES',
      128: 'BREAK_TRIM_END_EDGE_SPACES',
    });
    expect(BREAK_TRIM_MASK).toBe(224);
  });

  it('offers the two trim bits the inspector hint lists, not the indent bit', () => {
    expect(BREAK_TRIM_HINTED_BITS).toBe(192);
  });
});
