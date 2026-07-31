/**
 * The linter loader is the seam the docs generators stand on, and its failure
 * modes are environmental rather than logical: a `dist/` whose internal
 * specifier shape changed, or a Node without `registerHooks` (it arrived in
 * 22.15/23.5; `engines` requires >=24). Both are invisible to every other test.
 */

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, '../../packages/textscene-core/dist/linter/index.js');
const built = existsSync(DIST);

// The first import pulls the whole linter barrel (every slice self-registers),
// which comfortably exceeds vitest's 5s default; later tests hit the cache.
describe.skipIf(!built)('loadCoreLinter', { timeout: 30_000 }, () => {
  it('loads the built registries with every slice self-registered', async () => {
    const { loadCoreLinter } = await import('./loadCoreLinter.mjs');
    const core = await loadCoreLinter();
    expect(core.ruleRegistry.getRules().length).toBeGreaterThan(0);
    expect(core.validatorRegistry.getRegisteredNodeTypes().length).toBeGreaterThan(0);
  });

  it('executes applicability matchers, so unsupported types resolve honestly', async () => {
    const { loadCoreLinter } = await import('./loadCoreLinter.mjs');
    const { ruleRegistry } = await loadCoreLinter();
    const named = (type) => ruleRegistry.getRulesForNodeType(type).map((r) => r.meta.name);

    // The universal rule reaches every node. The spatial matcher asks the real
    // base chain, so it reaches every Node3D descendant whether or not Godot
    // suffixed the name, and NO type that merely ends in "3D".
    //
    // This case previously pinned the opposite for ReflectionProbe, back when
    // the matcher was `nodeType.endsWith('3D')`: that heuristic missed the 16
    // spatial types Godot did not suffix and claimed NavigationAgent3D, whose
    // base is plain Node. The generated Linting block reports whatever this
    // resolves to, so the asymmetry was published as fact.
    expect(named('ReflectionProbe')).toContain('binary-resource-reference');
    expect(named('ReflectionProbe')).toContain('valid-node3d-visibility');
    expect(named('GridMap')).toContain('valid-node3d-visibility');
    expect(named('RayCast3D')).toContain('valid-node3d-visibility');
    expect(named('NavigationAgent3D')).not.toContain('valid-node3d-visibility');
    expect(named('Label')).not.toContain('valid-node3d-visibility');
  });
});
