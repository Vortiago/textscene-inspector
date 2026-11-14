import { describe, expect, it } from 'vitest';
import { lanesAgree, recordKeepingAgreeingEntries } from './laneAgreement.mjs';

const QUIET_NAN = 0x7fc00000;
const NEGATIVE_QUIET_NAN = 0xffc00000;

describe('whether a lane agrees with Godot', () => {
  it('passes a float NaN lane of either sign', () => {
    expect(lanesAgree(QUIET_NAN, NEGATIVE_QUIET_NAN, true)).toBe(true);
  });

  it('fails a float NaN lane against zero', () => {
    expect(lanesAgree(QUIET_NAN, 0, true)).toBe(false);
  });

  it('fails a float NaN lane against an infinity', () => {
    expect(lanesAgree(QUIET_NAN, 0x7f800000, true)).toBe(false);
  });

  it('fails negative zero against positive zero', () => {
    expect(lanesAgree(0x80000000, 0, true)).toBe(false);
  });

  it('compares an int lane bit for bit, even with the bits of two NaNs', () => {
    expect(lanesAgree(QUIET_NAN, NEGATIVE_QUIET_NAN, false)).toBe(false);
  });
});

/** A record text of one probe, `source`, with `results` as Godot's lanes. */
const recordOf = (source, results) =>
  `${JSON.stringify({ godot: 'g', adapter: 'a', probes: { p: { source, inputs: [], results: [results] } } }, null, 1)}\n`;

describe('the record a run keeps', () => {
  const FLOAT = 'float probe(float a) { return a; }';
  const INT = 'int probe(int a) { return a; }';

  it('keeps the recorded bits of a float lane whose NaN changes sign', () => {
    const recorded = recordOf(FLOAT, ['7fc00000']);
    expect(recordKeepingAgreeingEntries(recorded, recordOf(FLOAT, ['ffc00000']))).toBe(recorded);
  });

  it('takes the run when a NaN lane becomes zero', () => {
    const run = recordOf(FLOAT, ['00000000']);
    expect(recordKeepingAgreeingEntries(recordOf(FLOAT, ['7fc00000']), run)).toBe(run);
  });

  it('takes the run when an int lane changes bits', () => {
    const run = recordOf(INT, ['ffc00000']);
    expect(recordKeepingAgreeingEntries(recordOf(INT, ['7fc00000']), run)).toBe(run);
  });

  it('takes the run when there is no record yet', () => {
    const run = recordOf(FLOAT, ['7fc00000']);
    expect(recordKeepingAgreeingEntries(undefined, run)).toBe(run);
  });
});
