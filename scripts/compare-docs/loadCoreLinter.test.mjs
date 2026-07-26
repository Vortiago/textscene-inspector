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

    // The universal rule reaches every node; the `endsWith('3D')` matcher does
    // not reach ReflectionProbe. This asymmetry is what the generated Linting
    // block for unsupported nodes reports, so pin it.
    expect(named('ReflectionProbe')).toContain('binary-resource-reference');
    expect(named('ReflectionProbe')).not.toContain('valid-node3d-visibility');
    expect(named('RayCast3D')).toContain('valid-node3d-visibility');
  });
});
