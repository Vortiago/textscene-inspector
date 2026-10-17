import { describe, expect, it } from 'vitest';
import { VISIBLE_CHARACTERS_BEHAVIOR_NAMES } from './textServerEnums';

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
