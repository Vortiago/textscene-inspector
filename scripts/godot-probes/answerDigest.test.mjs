import { describe, expect, it } from 'vitest';
import { canonicalAnswers, isSmokeId, renderAnswersFile, staleFamilies } from './answerDigest.mjs';

const FLOAT = 'float probe(float a) { return a; }';
const INT = 'int probe(int a) { return a; }';

/** The answers of a run on `adapter` whose one probe, `source`, gives `lanes`. */
const answersOf = (source, lanes, adapter = 'a') => {
  const record = { godot: 'g', adapter, probes: { p: { source, inputs: [], results: [lanes] } } };
  return {
    probes: record,
    random: record,
    operators: { cases: {} },
    corpus: { cases: {} },
    expressions: { cases: {} },
    heads: { cases: {} },
    materials: { godot: 'g', cases: {}, verdicts: {} },
  };
};

const fileOf = (source, lanes, adapter) => renderAnswersFile(answersOf(source, lanes, adapter));

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
      'expressions',
      'heads',
      'materials',
      'materialVerdicts',
    ]);
  });
});

describe('the answers as every reader sees them', () => {
  it('hold one NaN for a float NaN lane of any sign', () => {
    expect(canonicalAnswers(answersOf(FLOAT, ['ffc00000'])).probes.probes.p.results).toEqual([['7fc00000']]);
  });

  it('name the adapter without the vector width, which differs by runner CPU', () => {
    const adapter = 'llvmpipe (LLVM 20.1.2, 512 bits)';
    expect(canonicalAnswers(answersOf(FLOAT, ['3f800000'], adapter)).probes.adapter).toBe(
      'llvmpipe (LLVM 20.1.2)'
    );
  });

  it('make the same file on a runner of another vector width', () => {
    expect(fileOf(FLOAT, ['3f800000'], 'llvmpipe (LLVM 20.1.2, 256 bits)')).toBe(
      fileOf(FLOAT, ['3f800000'], 'llvmpipe (LLVM 20.1.2, 512 bits)')
    );
  });
});

describe('a run that skips the material sweep', () => {
  const withoutMaterials = (answers) => ({ ...answers, materials: undefined });
  const committed = fileOf(FLOAT, ['3f800000']);

  it('keeps the committed material digests and smoke cases, so the file stays the same', () => {
    const skipped = withoutMaterials(answersOf(FLOAT, ['3f800000']));
    expect(renderAnswersFile(skipped, JSON.parse(committed))).toBe(committed);
  });

  it('keeps the committed counts of the sweep, as the smoke cases hold too few to count', () => {
    const skipped = withoutMaterials(answersOf(FLOAT, ['3f800000']));
    const kept = { ...JSON.parse(committed), materialCounts: { materials: 9, nextPasses: 2, texts: 5 } };
    expect(JSON.parse(renderAnswersFile(skipped, kept)).materialCounts).toEqual(kept.materialCounts);
  });

  it('fails when the committed file has no material digest either', () => {
    const skipped = withoutMaterials(answersOf(FLOAT, ['3f800000']));
    expect(() => renderAnswersFile(skipped, { digests: {}, smoke: {} })).toThrow(/family materials/);
  });

  it('checks only the families it recorded against the committed digests', () => {
    const skipped = canonicalAnswers(withoutMaterials(answersOf(FLOAT, ['3f800000'])));
    expect(staleFamilies(skipped, JSON.parse(committed))).toEqual([]);
  });
});

describe('a live run against the committed digests', () => {
  const committed = JSON.parse(fileOf(FLOAT, ['3f800000']));

  it('names each family whose digest differs', () => {
    expect(staleFamilies(canonicalAnswers(answersOf(FLOAT, ['ffc00000'])), committed)).toEqual([
      'probes',
      'random',
    ]);
  });

  it('names none when every digest matches', () => {
    expect(staleFamilies(canonicalAnswers(answersOf(FLOAT, ['3f800000'])), committed)).toEqual([]);
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
