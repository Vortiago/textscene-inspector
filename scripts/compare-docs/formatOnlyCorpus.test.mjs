/**
 * The corpus check against scratch validators, with no dist: it must report a
 * validator that cites no grounding yet refuses a literal Godot stores, and
 * nothing else.
 */

import { describe, expect, it } from 'vitest';
import { applicableEntries, corpusRefusals } from './formatOnlyCorpus.mjs';
import { FORMAT_ONLY_CORPUS, SETTER_TYPES } from './formatOnlyCorpus.data.mjs';
import { ENGINE_CITE_RE } from '../../packages/textscene-core/src/linter/testing/engineCite.ts';

const TYPE_STRING = 4;
const TYPE_ARRAY = 28;
const HINT_ARRAY_TYPE = 31;

const TYPE_OBJECT = 24;
const HINT_RESOURCE_TYPE = 17;

const CORPUS = [
  { type: TYPE_STRING, literal: '"a"', cite: 'variant_parser.cpp:276', stores: 'as-written' },
  { type: TYPE_STRING, literal: '@"a"', cite: 'variant_parser.cpp:262-265', stores: 'as-written' },
  { type: TYPE_ARRAY, literal: '[]', cite: 'variant_parser.cpp:1650', stores: 'as-written' },
  { type: TYPE_ARRAY, literal: '[null]', cite: 'polygon_2d.cpp:435-437', stores: 'as-written', slot: 'untyped' },
];

const CONVERTED = { type: TYPE_STRING, literal: 'NodePath("a")', cite: 'variant.cpp:582-589', stores: 'converted' };

/** A scratch validator that refuses anything `accepts` rejects. */
function scratch(accepts, tags = { formatOnly: true }) {
  const validator = (key, value, line) =>
    accepts(value) ? null : { message: `refused ${value}`, severity: 'error', key, line };
  return Object.assign(validator, tags);
}

const row = (label, type, hint = 0, hint_string = '') => ({ label, type, hint, hint_string });

describe('applicableEntries', () => {
  it('gives an untyped slot every entry of its Variant type', () => {
    const literals = applicableEntries(row('X.a', TYPE_ARRAY), CORPUS).map((e) => e.literal);
    expect(literals).toEqual(['[]', '[null]']);
  });

  it('gives a hinted container slot only the entries that hold for every hint', () => {
    const hinted = row('X.a', TYPE_ARRAY, HINT_ARRAY_TYPE, 'NodePath');
    expect(applicableEntries(hinted, CORPUS).map((e) => e.literal)).toEqual(['[]']);
  });

  it('gives an entry scoped to one element hint only to that hint', () => {
    const scoped = { type: TYPE_ARRAY, literal: '["a"]', cite: 'array.cpp:260', stores: 'converted', slot: { hint: HINT_ARRAY_TYPE, hint_string: 'NodePath' } };
    const nodePaths = row('X.a', TYPE_ARRAY, HINT_ARRAY_TYPE, 'NodePath');
    const ints = row('X.b', TYPE_ARRAY, HINT_ARRAY_TYPE, 'int');
    expect(applicableEntries(nodePaths, [scoped])).toEqual([scoped]);
    expect(applicableEntries(ints, [scoped])).toEqual([]);
    expect(applicableEntries(row('X.c', TYPE_ARRAY), [scoped])).toEqual([]);
  });

  it('gives an entry that names a hint but no hint string to every slot with that hint', () => {
    const anyResource = { type: TYPE_OBJECT, literal: 'SubResource("a")', cite: 'variant_parser.cpp:1115', stores: 'as-written', slot: { hint: HINT_RESOURCE_TYPE } };
    const textures = row('X.a', TYPE_OBJECT, HINT_RESOURCE_TYPE, 'Texture2D');
    expect(applicableEntries(textures, [anyResource])).toEqual([anyResource]);
    expect(applicableEntries(row('X.b', TYPE_OBJECT), [anyResource])).toEqual([]);
  });
});

describe('corpusRefusals', () => {
  it('reports nothing for a validator that takes every applicable literal', () => {
    const validatorFor = () => scratch(() => true);
    expect(corpusRefusals([row('X.a', TYPE_STRING)], validatorFor, CORPUS)).toEqual([]);
  });

  it('reports a validator narrower than the tokenizer, with the literal and its cite', () => {
    // The `v.stringName` that refused the 3.x `@` jacket.
    const unjacketed = scratch((value) => /^&?"[^"]*"$/.test(value));
    const refusals = corpusRefusals([row('Label.text', TYPE_STRING)], () => unjacketed, CORPUS);
    expect(refusals).toEqual(['Label.text refuses @"a" (variant_parser.cpp:262-265)']);
  });

  it('counts a warning on a literal stored as written, since nothing cites it', () => {
    const warns = Object.assign(() => ({ message: 'w', severity: 'warning' }), { formatOnly: true });
    expect(corpusRefusals([row('X.a', TYPE_STRING)], () => warns, CORPUS)).toHaveLength(2);
  });

  it('allows the converted-spelling warning on a converted literal', () => {
    const warns = Object.assign(() => ({ message: 'w', severity: 'warning' }), { formatOnly: true });
    expect(corpusRefusals([row('X.a', TYPE_STRING)], () => warns, [CONVERTED])).toEqual([]);
  });

  it('reports an error on a converted literal, which the setter still takes', () => {
    const refuses = scratch(() => false);
    expect(corpusRefusals([row('Label.text', TYPE_STRING)], () => refuses, [CONVERTED])).toEqual([
      'Label.text refuses NodePath("a") (variant.cpp:582-589)',
    ]);
  });

  it('checks an int-slot validator, which cites no grounding either', () => {
    const intSlot = scratch(() => false, { intSlot: { cite: 'variant.h:360-377', width: 'int32' } });
    expect(corpusRefusals([row('X.a', TYPE_STRING)], () => intSlot, CORPUS)).toHaveLength(2);
  });

  it('skips a validator that cites a grounding for what it refuses', () => {
    const grounded = scratch(() => false, { grounding: { kind: 'enforced', cite: 'array.cpp:276' } });
    expect(corpusRefusals([row('X.a', TYPE_STRING)], () => grounded, CORPUS)).toEqual([]);
  });

  it('skips a row that no validator covers', () => {
    expect(corpusRefusals([row('X.a', TYPE_STRING)], () => undefined, CORPUS)).toEqual([]);
  });

  it('checks each refusal under its own row, so one wide validator excuses no other', () => {
    const rows = [row('A.wide', TYPE_ARRAY), row('B.narrow', TYPE_ARRAY)];
    const byLabel = {
      'A.wide': scratch(() => true),
      'B.narrow': scratch((value) => value === '[]'),
    };
    const refusals = corpusRefusals(rows, (r) => byLabel[r.label], CORPUS);
    expect(refusals).toEqual(['B.narrow refuses [null] (polygon_2d.cpp:435-437)']);
  });
});

describe('the corpus data', () => {
  it('cites an engine line for every literal and every setter type', () => {
    const cites = [...FORMAT_ONLY_CORPUS.map((e) => [e.literal, e.cite]), ...[...SETTER_TYPES].map(([label, e]) => [label, e.cite])];
    expect(cites.length).toBeGreaterThan(80);
    expect(cites.filter(([, cite]) => !ENGINE_CITE_RE.test(cite))).toEqual([]);
  });

  it('says for every literal whether the slot stores it as written or converted', () => {
    expect(FORMAT_ONLY_CORPUS.filter((e) => e.stores !== 'as-written' && e.stores !== 'converted')).toEqual([]);
  });
});
