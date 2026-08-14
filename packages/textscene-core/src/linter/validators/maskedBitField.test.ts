import { describe, it, expect } from 'vitest';
import { hintedBitField, maskedBitField } from './maskedBitField.js';

// BREAK_TRIM_INDENT | BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES
// (servers/text/text_server.h:120).
const TRIM_MASK = 32 | 64 | 128;
const TRIM_LABELS = {
  32: 'BREAK_TRIM_INDENT',
  64: 'BREAK_TRIM_START_EDGE_SPACES',
  128: 'BREAK_TRIM_END_EDGE_SPACES',
};

// The hint enumerates only the two edge-space bits (label.cpp:1436), while the
// setter's mask keeps BREAK_TRIM_INDENT as well.
const TRIM_HINTED_BITS = 64 | 128;

const validator = maskedBitField('autowrap_trim_flags', TRIM_MASK, {
  enforced: 'label.cpp:63',
  labels: TRIM_LABELS,
  hintedBits: TRIM_HINTED_BITS,
});

/** The same property without the narrower hint, for the single-tier path. */
const maskOnly = maskedBitField('autowrap_trim_flags', TRIM_MASK, {
  enforced: 'label.cpp:63',
  labels: TRIM_LABELS,
});

const run = (value: string) => validator('autowrap_trim_flags', value, 7);

describe('maskedBitField', () => {
  describe('accepts every subset of the hinted bits', () => {
    it.each(['0', '64', '128', '192'])('accepts %s', (value) => {
      expect(run(value)).toBeNull();
    });
  });

  describe('warns on a bit the setter keeps but the hint omits', () => {
    it.each(['32', '96', '160', '224'])('warns on %s, which carries bit 32', (value) => {
      const diagnostic = run(value);
      expect(diagnostic?.severity).toBe('warning');
      expect(diagnostic?.message).toContain('BREAK_TRIM_INDENT');
    });

    it('names only the offending bit, not every bit set', () => {
      // 96 is INDENT|START; only INDENT is unreachable from the inspector, so
      // reporting START too would send a reader looking for a second problem.
      const message = run('96')?.message ?? '';
      expect(message).toContain('sets BREAK_TRIM_INDENT (32)');
      expect(message).not.toContain('sets BREAK_TRIM_INDENT (32) | BREAK_TRIM_START');
    });

    it('accepts every mask subset when no narrower hint is given', () => {
      for (const value of ['0', '32', '64', '96', '128', '160', '192', '224']) {
        expect(maskOnly('autowrap_trim_flags', value, 7)).toBeNull();
      }
    });
  });

  describe('rejects bits outside the mask', () => {
    it('rejects a bit below the mask that a max bound would allow', () => {
      // The case that motivates the combinator: 4 is in 0..224, so
      // `v.int({min:0,max:224})` would pass it, yet Godot stores 0.
      const error = run('4');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
      expect(error?.message).toContain('Godot stores 0');
    });

    it('rejects a mixed value, naming the surviving bits', () => {
      expect(run('36')?.message).toContain('Godot stores 32');
    });

    it('rejects the deprecated BREAK_TRIM_EDGE_SPACES bit, which the mask omits', () => {
      expect(run('16')?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
    });

    it('rejects a value wider than the mask', () => {
      expect(run('4096')?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
    });
  });

  describe('edge cases', () => {
    it('rejects a negative value without claiming a 32-bit stored result', () => {
      const error = run('-1');
      expect(error?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
      expect(error?.message).not.toContain('Godot stores');
    });

    it('rejects a value past 32 bits without wrapping into a false pass', () => {
      // 2^32 + 32 has bits inside the mask; ToInt32 would make `& ~mask` read 32
      // and pass it. The `num > mask` guard runs first for exactly this reason.
      expect(run('4294967328')?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
    });

    it.each(['', ' ', 'abc', '0x20'])('rejects %o as a format error', (value) => {
      // `0x20` is not a Variant literal at all: the number tokenizer has no hex
      // branch and READING_INT stops at `x`. `Number('0x20')` reads 32, which is
      // why the old gate ACCEPTED a spelling Godot refuses.
      expect(run(value)?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_FORMAT');
    });

    it('truncates a float rather than calling it a format error', () => {
      // A bit-field slot is an INT, so Godot reads the number token and
      // converts: `32.5` stores 32. Whether 32 is a legal bit is the VALUE
      // question below, not a format one.
      expect(run('32.5')?.code).not.toBe('INVALID_AUTOWRAP_TRIM_FLAGS_FORMAT');
      expect(run('64.9')).toBeNull();
    });

    it('tolerates surrounding whitespace, as the property scanner may leave it', () => {
      expect(run(' 192 ')).toBeNull();
    });
  });

  describe('metadata', () => {
    it('carries the enforced grounding, so boundGrounding counts it as audited', () => {
      expect(validator.grounding).toEqual({ kind: 'enforced', cite: 'label.cpp:63' });
    });

    it('names the constants in the sheet Accepts column', () => {
      expect(validator.accepts).toBe(
        'bit mask of BREAK_TRIM_INDENT (32) | BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128)'
      );
    });
  });
});

describe('hintedBitField', () => {
  // Label.justification_flags: label.cpp:1437 offers a SPARSE set, missing
  // JUSTIFICATION_TRIM_EDGE_SPACES (4) and JUSTIFICATION_CONSTRAIN_ELLIPSIS
  // (16), both of which the bare-assign setter keeps.
  const validator = hintedBitField('justification_flags', {
    hinted: 'label.cpp:1437',
    labels: {
      1: 'JUSTIFICATION_KASHIDA',
      2: 'JUSTIFICATION_WORD_BOUND',
      8: 'JUSTIFICATION_AFTER_LAST_TAB',
      32: 'JUSTIFICATION_SKIP_LAST_LINE',
      64: 'JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS',
      128: 'JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE',
    },
  });
  const run = (value: string) => validator('justification_flags', value, 3);

  it.each(['0', '1', '2', '3', '8', '32', '64', '128', '235'])('accepts %s', (value) => {
    expect(run(value)).toBeNull();
  });

  it.each(['4', '16', '20', '255'])('warns on %s, a bit the hint omits', (value) => {
    // The whole reason this is not a v.int range: 4 and 16 sit INSIDE 0..235,
    // so `{ min: 0, max: 235 }` would accept exactly the values worth
    // reporting. Membership, not magnitude.
    expect(run(value)?.severity).toBe('warning');
  });

  it('warns rather than errors, because the setter keeps the value', () => {
    const diagnostic = run('16');
    expect(diagnostic?.code).toBe('INVALID_JUSTIFICATION_FLAGS_VALUE');
    expect(diagnostic?.message).toContain('Godot keeps the value');
  });

  it('warns on a negative value', () => {
    expect(run('-1')?.severity).toBe('warning');
  });

  it('rejects a non-integer as a format error, not a warning', () => {
    expect(run('two')?.severity).toBe('error');
  });

  it('does not wrap on a value past 32 bits', () => {
    // 2^32 + 1 has bit 1 set after ToInt32; the magnitude guard runs first.
    expect(run('4294967297')?.severity).toBe('warning');
  });

  it('carries the hinted grounding, so boundGrounding counts it as audited', () => {
    expect(validator.grounding).toEqual({ kind: 'hinted', cite: 'label.cpp:1437' });
  });
});
