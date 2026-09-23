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
    it('rejects a negative value, naming the bits the mask keeps of it', () => {
      const error = run('-1');
      expect(error?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
      expect(error?.message).toContain('Godot stores 224');
    });

    it('rejects a value past 32 bits without wrapping into a false pass', () => {
      // 2^32 + 32 has bits inside the mask; an int32 `& ~mask` would read 32
      // and pass it.
      expect(run('4294967328')?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
    });

    it.each(['', ' ', 'abc', '0x20'])('rejects %o as a format error', (value) => {
      // `0x20` is not a Variant literal: the number tokenizer has no hex branch
      // and READING_INT stops at `x`, though `Number('0x20')` reads 32.
      expect(run(value)?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_FORMAT');
    });

    it('truncates a float rather than calling it a format error', () => {
      // A bit-field slot is an INT, so Godot reads the number token and
      // converts: `32.5` stores 32. Whether 32 is a legal bit is the value
      // question below, not a format one.
      expect(run('32.5')?.code).not.toBe('INVALID_AUTOWRAP_TRIM_FLAGS_FORMAT');
    });

    it('warns that the fraction was dropped, at the shared truncation tier', () => {
      // 64 is a legal bit, so the arms have nothing to say and only this keeps
      // the slot from going silent on `_to_int`'s own alteration, which
      // `markIntSlot` tags it for. `truncatedInts.test.ts` sweeps for the same gap.
      const truncated = run('64.9');
      expect(truncated?.severity).toBe('warning');
      expect(truncated?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_VALUE');
      expect(truncated?.message).toContain('stores 64');
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
  // Label.justification_flags: label.cpp:1437 offers a sparse set, missing
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
    // Membership, not magnitude: 4 and 16 sit inside 0..235, so
    // `{ min: 0, max: 235 }` would accept exactly the values worth reporting.
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

  it('keeps a value past 32 bits, because the field is int64', () => {
    // `BitField<T>` is int64 and this setter bare-assigns, so 2^32 + 1 is
    // stored intact and only the hint warns.
    expect(run('4294967297')?.severity).toBe('warning');
  });

  it('carries the hinted grounding, so boundGrounding counts it as audited', () => {
    expect(validator.grounding).toEqual({ kind: 'hinted', cite: 'label.cpp:1437' });
  });
});

describe('a mask that keeps a bit past 32', () => {
  // `BitField<T>` is int64 and the engine states such bits:
  // `RenderingServer::ArrayFormat` sets one at 35 and asserts its own 64-bit
  // width (servers/rendering/rendering_server.h:351, :357).
  const wide = maskedBitField('flags', 2 ** 32 + 192, {
    enforced: 'label.cpp:63',
    labels: { 64: 'START_EDGE', 128: 'END_EDGE' },
    hintedBits: 192,
  });

  it('warns on a kept bit past 32 that the hint does not offer', () => {
    // An int32 `&` reads 2^32 as 0, so the hint arm must refuse a value wider
    // than the bits it offers.
    const diagnostic = wide('flags', String(2 ** 32), 5);
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.code).toBe('INVALID_FLAGS_VALUE');
  });

  it('stays silent on a value inside the bits the hint offers', () => {
    expect(wide('flags', '192', 5)).toBeNull();
  });
});

describe('a masked bit field names what the engine keeps', () => {
  it('reports the stored bits for the negative spelling too', () => {
    // `-1` and `4294967295` are the same 32 bits, and Godot's `p_flags & MASK`
    // treats them identically, so the message must not depend on the spelling.
    expect(run('-1')?.message).toContain('Godot stores 224');
    expect(run('4294967295')?.message).toContain('Godot stores 224');
  });
});
