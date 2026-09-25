/**
 * Asks the engine what it declared, where every other coverage check asks what
 * exists here: an unvalidated property has no artefact here to anchor on.
 * `node-properties.json` is `ClassDB.class_get_property_list(c, true)` from
 * `pnpm nodes:properties`, so CI needs no engine.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';
import { loadCoreLinter, loadCoreParser } from './loadCoreLinter.mjs';
import { keyMatcher, unvalidatedByClass } from './registryKeys.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');
// A ledger, not a pass mark: it only goes down, counted per declaring class
// with no base-walk, since a `Control` validator belongs in `Control`'s slice.
// The four left stay unvalidated, each pinned by a `findValidator` null test.
const EXPECTED_UNVALIDATED = 4;
// Three pass an empty setter string to ADD_PROPERTY, so `ClassDB::set_property`
// drops the write: `ShapeCast2D`/`ShapeCast3D.collision_result` and
// `LimitAngularVelocityModifier3D.joint_count`. `OpenXRRenderModel.render_model`
// is a `Variant::RID`, a runtime handle with no literal a scene can write.

/**
 * The classes this ledger measures: the ones this repo claims, closed over the
 * base chain. The closure reaches an abstract tier that registers nothing, such
 * as `CSGShape3D`. Unregistered types belong to the coverage ledger.
 */
function coveredClasses(nodeRegistry, declaringTypes, baseChainOf) {
  const covered = new Set([...nodeRegistry.getAllTypeNames(), ...declaringTypes]);
  for (const cls of [...covered]) for (const ancestor of baseChainOf(cls)) covered.add(ancestor);
  return covered;
}

// Loading the built barrel exceeds vitest's 5s default under a full run.
describe('engine property coverage', { timeout: 60_000 }, () => {
  const engine = JSON.parse(readFileSync(PROPS, 'utf8'));

  // Not `existsSync(dist)`, which skips on no build and passes a stale one. In
  // `beforeAll`, not at module scope, where a throw during a concurrent `tsc
  // --build` surfaces as a collection error instead of this message.
  beforeAll(() => {
    requireFreshDist(CORE, 'this coverage ledger');
  });

  // One load for the whole file, not one per await.
  let validatorRegistry;
  let registeredTypes;
  let nodeRegistry;
  // 60s, not the 10s hook default: three ledgers load the barrel at once under
  // a full `--project scripts` run.
  beforeAll(async () => {
    ({ validatorRegistry, registeredTypes } = await loadCoreLinter());
    ({ nodeRegistry } = await loadCoreParser());
  }, 60_000);

  it('the captured table covers the classes it should', () => {
    // Abstract bases declare the most, so a table from the catalog's
    // instantiable list would miss the classes that own the properties.
    expect(Object.keys(engine).length).toBeGreaterThan(200);
    expect(engine.Light3D?.length).toBe(27);
    expect(engine.Control?.length).toBeGreaterThan(0);
  });

  it('the captured table carries the hint a bound would be grounded on', () => {
    const blur = engine.Light3D.find((p) => p.name === 'shadow_blur');
    expect(blur.hint_string).toBe('0,10,0.001');
  });

  it('wildcard keys cover their indexed family rather than reading as a gap', () => {
    const matchers = validatorRegistry.getOwnKeys('Generic6DOFJoint3D').map(keyMatcher);
    const missing = engine.Generic6DOFJoint3D.map((p) => p.name).filter(
      (name) => !matchers.some((m) => m(name))
    );
    expect(missing).toEqual([]);
  });

  it('scopes to the classes this repo claims, named rather than only derived', () => {
    const covered = coveredClasses(nodeRegistry, registeredTypes('declaring'), (cls) => validatorRegistry.baseChainOf(cls));
    // Named, since the scope derives from the registry this ledger audits:
    // deregistering a class shrinks the count instead of failing it.
    for (const cls of [
      'Node',
      'CanvasItem',
      'Node2D',
      'Node3D',
      'Control',
      'Range',
      'BaseButton',
      'Camera3D',
      'MeshInstance3D',
      'Viewport',
      // Reached only through the closure.
      'CSGShape3D',
      'CSGPrimitive3D',
      'PhysicsBody3D',
    ]) {
      expect([...covered]).toContain(cls);
    }
    expect(covered.size).toBeGreaterThanOrEqual(266);
    expect(covered.has('EditorFileDialog')).toBe(false);
  });

  it('the unvalidated-property ledger has not grown', () => {
    const covered = coveredClasses(nodeRegistry, registeredTypes('declaring'), (cls) => validatorRegistry.baseChainOf(cls));

    // Not a filter on `usage == 2`: that is STORAGE without EDITOR, hidden from the
    // inspector but serialised, as `SpringBoneCollision3D.bone` is, and validated.
    // `class_get_property_list` does not report setters, so a getter-only property
    // counts here until its ADD_PROPERTY is read.
    const rows = unvalidatedByClass(engine, validatorRegistry, covered);
    const total = rows.reduce((sum, r) => sum + r.missing.length, 0);
    const report = rows.map((r) => `  ${r.cls} (${r.missing.length}): ${r.missing.join(', ')}`);

    expect(
      total,
      `Unvalidated engine properties now number ${total}, not ${EXPECTED_UNVALIDATED}.\n` +
        `Down is good: lower the constant with the fix. Up means a class gained a property no validator covers.\n${report.join('\n')}`
    ).toBe(EXPECTED_UNVALIDATED);
  });
});
