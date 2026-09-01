/**
 * The question `enginePropertyCoverage` asks of nodes, asked of the resources a
 * `.tscn` carries in its `[sub_resource]` sections.
 *
 * Nothing asked it before: that guard reads the node capture and the two
 * hierarchies are disjoint, so a material or mesh property Godot serialises and
 * we validate nowhere was invisible to every guard in the repo. It survived a
 * node-coverage campaign, a diagnostic audit and a hint-parity sweep.
 *
 * SCOPE — a resource type we register validators for, and its ancestors. Not
 * all of ClassDB: counting the classes nobody has started on would bury the
 * number this guard exists to hold, the same line `enginePropertyCoverage`
 * draws. Ancestors are in for the reason this guard exists at all: a validator
 * on a leaf whose base declares the property is the defect, so the base's whole
 * declaration has to be counted for the placement to be forced.
 *
 * Resource classes we decode but never lint — ShaderMaterial,
 * ParticleProcessMaterial, ArrayMesh, the shapes and curves — are out, and are
 * the standing resource-lint backlog rather than this ledger's business.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';
import { loadCoreLinter } from './loadCoreLinter.mjs';
import { unvalidatedByClass } from './registryKeys.mjs';

const PROPS = join(import.meta.dirname, 'resource-properties.json');
const BASES = join(import.meta.dirname, 'resource-bases.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');
// Not `existsSync(dist)`: that cannot tell a fresh build from one predating
// the very change being measured, and it SKIPS rather than fails, so a run
// with no build at all reads green over a guard that never executed.
//
// Computed in `beforeAll`, never at module scope: it walks a tree a concurrent
// `tsc --build` may be writing, and a throw during module evaluation surfaces
// as a vitest collection error instead of the actionable message.

/**
 * Properties in scope with no validator.
 *
 * Zero is the standing state. Raise it only for a property a `.tscn` cannot
 * express — an empty ADD_PROPERTY setter string, a runtime-only RID — and say
 * which.
 */
const EXPECTED_UNVALIDATED = 0;

/** Every class from a registered resource type up to `Resource`, inclusive. */
export function coveredClasses(registeredTypes, bases) {
  const scope = new Set();
  for (const type of registeredTypes) {
    // A node type is absent from the resource table, which is how the two
    // hierarchies stay apart with no second list to maintain.
    if (!(type in bases)) continue;
    let current = type;
    while (current !== undefined && !scope.has(current)) {
      scope.add(current);
      current = bases[current];
    }
  }
  return scope;
}

describe('resource property coverage', { timeout: 60_000 }, () => {
  const engine = JSON.parse(readFileSync(PROPS, 'utf8'));
  const bases = JSON.parse(readFileSync(BASES, 'utf8'));

  // Fails every assertion below with one actionable message rather than letting
  // them agree with a previous revision's registry.
  beforeAll(() => {
    requireFreshDist(CORE, 'this coverage ledger');
  });

  let validatorRegistry;
  let declaringTypes;
  // 60s, matching the suite option above rather than the 10s hook default.
  // Loading the built barrel is the whole cost of this file, and three ledgers
  // do it at once under a full `--project scripts` run — comfortably fast
  // alone, and over the default when they contend.
  beforeAll(async () => {
    ({ validatorRegistry, registeredTypes: declaringTypes } = await loadCoreLinter());
  }, 60_000);

  it('scopes to the ancestry of what we register', () => {
    const covered = coveredClasses(declaringTypes('declaring'), bases);
    // Named, because the scope is derived from what is registered: deleting a
    // registration would drop its rows from the count rather than fail it, so
    // the ledger's zero would survive the coverage going away.
    for (const cls of [
      'BaseMaterial3D',
      'Material',
      'Resource',
      'Environment',
      'PrimitiveMesh',
      'Mesh',
    ]) {
      expect([...covered]).toContain(cls);
    }
    // Resource is in as an ancestor, and its other subtrees stay out with it.
    expect(covered.has('Animation')).toBe(false);
    expect(covered.has('ParticleProcessMaterial')).toBe(false);
    expect(covered.size).toBeLessThan(Object.keys(bases).length / 4);
  });

  it('counts against what the engine declares, which the capture must carry', () => {
    expect(engine.BaseMaterial3D?.length).toBeGreaterThan(100);
    // The leaf declares nothing of its own, which is exactly why the validators
    // cannot live there.
    expect(engine.StandardMaterial3D).toBeUndefined();
  });

  it('leaves no property of a claimed resource class unvalidated', () => {
    const covered = coveredClasses(declaringTypes('declaring'), bases);
    const rows = unvalidatedByClass(engine, validatorRegistry, covered);
    const total = rows.reduce((sum, r) => sum + r.missing.length, 0);
    const report = rows.map((r) => `  ${r.cls} (${r.missing.length}): ${r.missing.join(', ')}`);

    expect(
      total,
      `Unvalidated resource properties now number ${total}, not ${EXPECTED_UNVALIDATED}.\n${report.join('\n')}`
    ).toBe(EXPECTED_UNVALIDATED);
  });
});
