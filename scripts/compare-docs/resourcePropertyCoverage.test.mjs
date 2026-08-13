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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCoreLinter } from './loadCoreLinter.mjs';

const PROPS = join(import.meta.dirname, 'resource-properties.json');
const BASES = join(import.meta.dirname, 'resource-bases.json');
const DIST = join(import.meta.dirname, '../../packages/textscene-core/dist/linter/index.js');
const built = existsSync(DIST);

/**
 * Properties in scope with no validator.
 *
 * Measured at 176 when the guard was introduced, and closed in the same change,
 * so zero is the standing state rather than an aspiration. Raise it only for a
 * property a `.tscn` cannot express — an empty ADD_PROPERTY setter string, a
 * runtime-only RID — and say which.
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

/** A registered key can stand for a whole indexed family (`glow_levels/*`). */
function keyMatcher(key) {
  if (!key.includes('*') && !key.includes('#')) return (name) => name === key;
  const source = key
    .split('')
    .map((ch) => {
      if (ch === '*') return '[^/]+';
      if (ch === '#') return '\\d+';
      return /[a-zA-Z0-9_/]/.test(ch) ? ch : `\\${ch}`;
    })
    .join('');
  const re = new RegExp(`^${source}$`);
  return (name) => re.test(name);
}

/**
 * Per declaring class, not per leaf: a validator for a `BaseMaterial3D`
 * property belongs on `BaseMaterial3D`, so the base-walk is deliberately not
 * applied and `getOwnKeys` is asked instead of `findValidator`.
 */
function unvalidatedByClass(engine, validatorRegistry, covered) {
  const rows = [];
  for (const [cls, props] of Object.entries(engine)) {
    if (!covered.has(cls)) continue;
    const matchers = validatorRegistry.getOwnKeys(cls).map(keyMatcher);
    const missing = props.map((p) => p.name).filter((name) => !matchers.some((m) => m(name)));
    if (missing.length > 0) rows.push({ cls, missing });
  }
  return rows.sort((a, b) => b.missing.length - a.missing.length);
}

describe.skipIf(!built)('resource property coverage', { timeout: 60_000 }, () => {
  const engine = JSON.parse(readFileSync(PROPS, 'utf8'));
  const bases = JSON.parse(readFileSync(BASES, 'utf8'));

  let validatorRegistry;
  beforeAll(async () => {
    ({ validatorRegistry } = await loadCoreLinter());
  });

  it('scopes to the ancestry of what we register', () => {
    const covered = coveredClasses(validatorRegistry.getRegisteredNodeTypes(), bases);
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
    const covered = coveredClasses(validatorRegistry.getRegisteredNodeTypes(), bases);
    const rows = unvalidatedByClass(engine, validatorRegistry, covered);
    const total = rows.reduce((sum, r) => sum + r.missing.length, 0);
    const report = rows.map((r) => `  ${r.cls} (${r.missing.length}): ${r.missing.join(', ')}`);

    expect(
      total,
      `Unvalidated resource properties now number ${total}, not ${EXPECTED_UNVALIDATED}.\n${report.join('\n')}`
    ).toBe(EXPECTED_UNVALIDATED);
  });
});
