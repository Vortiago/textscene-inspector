/**
 * `enginePropertyCoverage`'s question, asked of the resources in a `.tscn`'s
 * `[sub_resource]` sections. Scope: each resource type we register validators
 * for, and its ancestors, so a property declared on a base is counted there.
 * Resource classes we decode but never lint are out.
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
/**
 * Properties in scope with no validator. Raise it only for a property a `.tscn`
 * cannot express, such as an empty ADD_PROPERTY setter string or a runtime-only
 * RID, and say which.
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

  // Not `existsSync(dist)`, which skips on no build and passes a stale one. In
  // `beforeAll`, not at module scope, where a throw during a concurrent `tsc
  // --build` surfaces as a collection error instead of this message.
  beforeAll(() => {
    requireFreshDist(CORE, 'this coverage ledger');
  });

  let validatorRegistry;
  let registeredTypes;
  // 60s, matching the suite option above, not the 10s hook default: three
  // ledgers load the barrel at once under a full `--project scripts` run.
  beforeAll(async () => {
    ({ validatorRegistry, registeredTypes } = await loadCoreLinter());
  }, 60_000);

  it('scopes to the ancestry of what we register', () => {
    const covered = coveredClasses(registeredTypes('declaring'), bases);
    // Named, since the scope derives from what is registered: deleting a
    // registration shrinks the count instead of failing it.
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
    // The leaf declares nothing of its own, so the validators cannot live there.
    expect(engine.StandardMaterial3D).toBeUndefined();
  });

  it('leaves no property of a claimed resource class unvalidated', () => {
    const covered = coveredClasses(registeredTypes('declaring'), bases);
    const rows = unvalidatedByClass(engine, validatorRegistry, covered);
    const total = rows.reduce((sum, r) => sum + r.missing.length, 0);
    const report = rows.map((r) => `  ${r.cls} (${r.missing.length}): ${r.missing.join(', ')}`);

    expect(
      total,
      `Unvalidated resource properties now number ${total}, not ${EXPECTED_UNVALIDATED}.\n${report.join('\n')}`
    ).toBe(EXPECTED_UNVALIDATED);
  });
});
