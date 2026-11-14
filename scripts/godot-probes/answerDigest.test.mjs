import { describe, expect, it } from 'vitest';
import { isSmokeId, renderAnswersFile } from './answerDigest.mjs';

const FLOAT = 'float probe(float a) { return a; }';
const INT = 'int probe(int a) { return a; }';

/** The answers file of a run whose one probe, `source`, gives `lanes`. */
const fileOf = (source, lanes) => {
  const record = { godot: 'g', adapter: 'a', probes: { p: { source, inputs: [], results: [lanes] } } };
  return renderAnswersFile({
    probes: record,
    random: record,
    operators: { cases: {} },
    corpus: { cases: {} },
  });
};

const digestsOf = (text) => JSON.parse(text).digests;

describe('the committed answers file', () => {
  it('is the same when a float NaN lane changes sign', () => {
    expect(fileOf(FLOAT, ['ffc00000'])).toBe(fileOf(FLOAT, ['7fc00000']));
  });

  it('changes its digest when a float NaN lane becomes zero', () => {
    expect(digestsOf(fileOf(FLOAT, ['00000000'])).probes).not.toBe(
      digestsOf(fileOf(FLOAT, ['7fc00000'])).probes
    );
  });

  it('changes its digest when an int lane changes bits, NaN bits included', () => {
    expect(digestsOf(fileOf(INT, ['ffc00000'])).probes).not.toBe(digestsOf(fileOf(INT, ['7fc00000'])).probes);
  });

  it('parses as JSON with a digest for each family', () => {
    expect(Object.keys(digestsOf(fileOf(FLOAT, ['3f800000'])))).toEqual([
      'probes',
      'random',
      'operators',
      'corpus',
    ]);
  });
});

describe('the smoke subset', () => {
  it('takes about one id in 32, by the id alone', () => {
    const ids = Array.from({ length: 3200 }, (_, index) => `case-${index}`);
    const share = ids.filter(isSmokeId).length / ids.length;
    expect(share).toBeGreaterThan(1 / 48);
    expect(share).toBeLessThan(1 / 24);
  });
});
