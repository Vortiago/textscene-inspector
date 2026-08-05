import { describe, it, expect } from 'vitest';
import { maskedBitField } from './maskedBitField.js';

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

    it.each(['', ' ', 'abc', '32.5', '0x20'])('rejects the non-integer %o as a format error', (value) => {
      expect(run(value)?.code).toBe('INVALID_AUTOWRAP_TRIM_FLAGS_FORMAT');
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
