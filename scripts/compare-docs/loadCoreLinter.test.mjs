/**
 * The linter loader is the seam the docs generators stand on, and its failure
 * modes are environmental rather than logical: a `dist/` whose internal
 * specifier shape changed, or a Node without `registerHooks` (it arrived in
 * 22.15/23.5; `engines` requires >=24). Both are invisible to every other test.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';

const CORE = join(import.meta.dirname, '../../packages/textscene-core');

// The first import pulls the whole linter barrel (every slice self-registers),
// which comfortably exceeds vitest's 5s default; later tests hit the cache.
describe('loadCoreLinter', { timeout: 30_000 }, () => {
  // Not `existsSync(dist)`: that cannot tell a fresh build from one predating
  // the very change being measured, and it SKIPS rather than fails, so a run
  // with no build at all reads green over a guard that never executed.
  //
  // In `beforeAll`, never at module scope: it walks a tree a concurrent
  // `tsc --build` may be writing, and a throw during module evaluation surfaces
  // as a vitest collection error instead of the actionable message.
  beforeAll(() => {
    requireFreshDist(CORE, 'the docs generators');
  });

  it('loads the built registries with every slice self-registered', async () => {
    const { loadCoreLinter } = await import('./loadCoreLinter.mjs');
    const core = await loadCoreLinter();
    expect(core.ruleRegistry.getRules().length).toBeGreaterThan(0);
    expect(core.registeredTypes('declaring').length).toBeGreaterThan(0);
  });

  it('executes applicability matchers, so unsupported types resolve honestly', async () => {
    const { loadCoreLinter } = await import('./loadCoreLinter.mjs');
    const { ruleRegistry } = await loadCoreLinter();
    const named = (type) => ruleRegistry.getRulesForNodeType(type).map((r) => r.meta.name);

    // The universal rule reaches every node. The spatial matcher asks the real
    // base chain, so it reaches every Node3D descendant whether or not Godot
    // suffixed the name, and NO type that merely ends in "3D".
    //
    // A `nodeType.endsWith('3D')` matcher gets ReflectionProbe right by accident
    // while missing the 16 spatial types Godot did not suffix, and claiming
    // NavigationAgent3D, whose base is plain Node. The generated Linting block reports whatever this
    // resolves to, so the asymmetry was published as fact.
    expect(named('ReflectionProbe')).toContain('binary-resource-reference');
    expect(named('ReflectionProbe')).toContain('valid-node3d-visibility');
    expect(named('GridMap')).toContain('valid-node3d-visibility');
    expect(named('RayCast3D')).toContain('valid-node3d-visibility');
    expect(named('NavigationAgent3D')).not.toContain('valid-node3d-visibility');
    expect(named('Label')).not.toContain('valid-node3d-visibility');
  });
});
