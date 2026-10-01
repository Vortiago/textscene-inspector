/**
 * Every registered validator that cites no grounding, run over the corpus of
 * literals Godot stores in its slot's Variant type. A refusal is an error on a
 * file the engine opens, with no citation to audit, so the ledger holds none.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';
import { loadCoreLinter } from './loadCoreLinter.mjs';
import { applicableEntries, corpusRefusals } from './formatOnlyCorpus.mjs';
import { FORMAT_ONLY_CORPUS, SETTER_TYPES } from './formatOnlyCorpus.data.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const RESOURCE_PROPS = join(import.meta.dirname, 'resource-properties.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');

/**
 * One row per captured property, from both captures, typed by what its setter
 * takes. The keys cannot collide: `Node` and `Resource` are separate branches
 * under `Object`.
 */
function capturedRows() {
  const engine = {
    ...JSON.parse(readFileSync(PROPS, 'utf8')),
    ...JSON.parse(readFileSync(RESOURCE_PROPS, 'utf8')),
  };
  return Object.entries(engine).flatMap(([nodeType, properties]) =>
    properties.map((p) => ({
      label: `${nodeType}.${p.name}`,
      nodeType,
      name: p.name,
      declaredType: p.type,
      type: SETTER_TYPES.get(`${nodeType}.${p.name}`)?.type ?? p.type,
      hint: p.hint,
      hint_string: p.hint_string,
    }))
  );
}

describe('validators that cite no grounding, against the literals Godot stores', () => {
  beforeAll(() => {
    requireFreshDist(CORE, 'the formatOnly corpus ledger');
  });

  let rows;
  let validatorFor;
  // 60s, not the 10s hook default: the ledgers load the barrel at once under a
  // full `--project scripts` run.
  beforeAll(async () => {
    const { validatorRegistry } = await loadCoreLinter();
    rows = capturedRows();
    validatorFor = (row) => validatorRegistry.declarationFor(row.nodeType, row.name) ?? undefined;
  }, 60_000);

  /** The rows this ledger checks: covered by a validator that cites nothing. */
  const subjects = () =>
    rows.filter((row) => {
      const validator = validatorFor(row);
      return validator !== undefined && !validator.grounding;
    });

  it('reaches the population it claims, Resource rows included', () => {
    // Measured at 1225 when the ledger landed. A floor, since a lost capture or
    // an unbuilt barrel shrinks the population and turns the ledger green.
    expect(subjects().length).toBeGreaterThan(1200);
    const labels = new Set(subjects().map((row) => row.label));
    expect(
      [
        'Label.structured_text_bidi_override_options',
        'Sprite2D.texture',
        'Label.text',
        'BaseMaterial3D.albedo_texture',
      ].filter((label) => !labels.has(label))
    ).toEqual([]);
  });

  it('gives every subject at least one corpus literal to take', () => {
    // A slot type the corpus does not cover would pass vacuously.
    const uncovered = subjects()
      .filter((row) => applicableEntries(row, FORMAT_ONLY_CORPUS).length === 0)
      .map((row) => `${row.label} (type ${row.type}, hint ${row.hint} "${row.hint_string}")`);
    expect(uncovered.sort()).toEqual([]);
  });

  it('holds no SETTER_TYPES entry the capture no longer needs', () => {
    // An entry for a property that left the capture, or whose declared type
    // now matches its setter, would retype a row for no reason.
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    const stale = [...SETTER_TYPES].flatMap(([label, { type }]) => {
      const row = byLabel.get(label);
      if (!row) return [`${label}: not in the capture`];
      return row.declaredType === type ? [`${label}: already declared as type ${type}`] : [];
    });
    expect(stale).toEqual([]);
  });

  it('refuses no literal the engine reads and stores', () => {
    expect(corpusRefusals(rows, validatorFor, FORMAT_ONLY_CORPUS).sort()).toEqual([]);
  });
});
