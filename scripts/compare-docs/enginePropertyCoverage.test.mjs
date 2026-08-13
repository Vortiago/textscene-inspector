/**
 * The guard that asks the ENGINE what it declared, rather than asking us what
 * we wrote.
 *
 * Every other coverage check in this repo is anchored on something that exists
 * here: the ledger diffs registered against unregistered types, the grounding
 * audit verifies citations that are already written, `propertyGrammarParity`
 * compares our parser against our validators. All of them ask what is present.
 * A property Godot serialises and we validate nowhere has no artefact to anchor
 * on, so it is invisible to all of them, and `Light3D` sat with 15 validators
 * against its 27 own properties through a node-coverage campaign and a
 * 283-diagnostic audit without either being able to see it.
 *
 * `node-properties.json` is a live `ClassDB.class_get_property_list(c, true)`
 * captured by `pnpm nodes:properties`, so this compares against the engine's own
 * declaration with no engine present, which is what CI requires.
 *
 * The number below is a ledger, not a pass mark. It should only ever go DOWN.
 *
 * Known over-count, stated because the number would otherwise be read as pure
 * work: a getter-only property is STORAGE-flagged and appears here, but nothing
 * can assign it from a `.tscn`, so the right outcome is no validator.
 * `ShapeCast2D`/`ShapeCast3D`'s `collision_result` are the two known cases
 * (`ADD_PROPERTY(… "collision_result"), "", "get_collision_result")`, an empty
 * setter string). `class_get_property_list` does not report setters, and the
 * tempting filter is wrong: those two carry `usage == 2`, STORAGE without
 * EDITOR, which is PROPERTY_USAGE_NO_EDITOR and means hidden-from-inspector,
 * NOT unserialised. `SpringBoneCollision3D.bone` carries the same flag and is
 * correctly validated, so filtering on it would silently drop real work to make
 * this number look better. Each one is settled by reading the ADD_PROPERTY
 * during the sweep, and the ledger drops either way.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stalenessMessage } from '../distFreshness.mjs';
import { loadCoreLinter, loadCoreParser } from './loadCoreLinter.mjs';

const PROPS = join(import.meta.dirname, 'node-properties.json');
const CORE = join(import.meta.dirname, '../../packages/textscene-core');
// Not `existsSync(dist)`: that cannot tell a fresh build from one predating
// the very change being measured, and it SKIPS rather than fails, so a run
// with no build at all reads green over a guard that never executed.
const stale = stalenessMessage(CORE, 'this coverage ledger');

/**
 * Unvalidated properties, per class, counted where the ENGINE declares them.
 *
 * Attribution matters: a validator for a `Control` property belongs in
 * `Control`'s slice, not in each of the forty leaves that inherit it, so the
 * diff is per declaring class and the base-walk is deliberately not applied.
 */
// 191 at the guard's introduction, then closed in two waves: 102, then 85.
//
// The four left are all correctly unvalidated, and the number should stay at 4
// rather than reaching 0. `ShapeCast2D`/`ShapeCast3D.collision_result` and
// `LimitAngularVelocityModifier3D.joint_count` each pass an empty setter string
// to their ADD_PROPERTY, so `ClassDB::set_property` drops the write before any
// `_set` runs and a .tscn cannot express them. `OpenXRRenderModel.render_model`
// is a DIFFERENT shape and its setter is real (`set_render_model`): it is
// `Variant::RID`, a runtime handle with no literal a scene author could write. Each is pinned by a test asserting `findValidator` returns
// null, so a later sweep cannot "close" them by inventing coverage.
const EXPECTED_UNVALIDATED = 4;

/**
 * A registered key can stand for a whole indexed family.
 *
 * `Generic6DOFJoint3D` registers 18 wildcard keys covering 84 engine
 * properties, and `PropertyListHelper` families register as `item_#/*`. Compared
 * literally these read as the single largest gap in the codebase while being
 * entirely covered, which is the difference between a ledger and a scare.
 */
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

// Loading the built barrel (every slice self-registers) comfortably exceeds
// vitest's 5s default, and under a full-monorepo run it exceeded it in the one
// place the isolated run never did. Same shape as loadCoreLinter.test.mjs.
describe('engine property coverage', { timeout: 60_000 }, () => {
  const engine = JSON.parse(readFileSync(PROPS, 'utf8'));

  // Fails every assertion below with one actionable message rather than letting
  // them agree with a previous revision's registry.
  beforeAll(() => {
    if (stale) throw new Error(stale);
  });


  // One load for the whole file: two independent awaits paid the barrel cost
  // twice and raced the timeout separately.
  let validatorRegistry;
  let nodeRegistry;
  beforeAll(async () => {
    ({ validatorRegistry } = await loadCoreLinter());
    ({ nodeRegistry } = await loadCoreParser());
  });

  it('the captured table covers the classes it should', () => {
    // Abstract bases are the point: they declare the most and can never be
    // instantiated, so a table built from the catalog's instantiable list would
    // miss exactly the classes that own the properties.
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

  it('the unvalidated-property ledger has not grown', () => {
    // Only classes this repo already claims. An unregistered type's properties
    // are the coverage ledger's business, not this guard's, and mixing the two
    // populations would make both numbers unreadable.
    const covered = new Set([
      ...nodeRegistry.getAllTypeNames(),
      ...validatorRegistry.getRegisteredNodeTypes(),
    ]);

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
