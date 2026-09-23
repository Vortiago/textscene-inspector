/**
 * The loader the docs generators stand on fails for environmental reasons: a
 * changed `dist/` specifier shape, or a Node without `registerHooks`.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';

const CORE = join(import.meta.dirname, '../../packages/textscene-core');

// The first import pulls the whole linter barrel, which exceeds vitest's 5s
// default. Later tests hit the cache.
describe('loadCoreLinter', { timeout: 30_000 }, () => {
  // Not `existsSync(dist)`, which skips on no build and passes a stale one. In
  // `beforeAll`, not at module scope, where a throw during a concurrent `tsc
  // --build` surfaces as a collection error instead of this message.
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

    // The universal rule reaches every node. The spatial matcher asks the base
    // chain, so it reaches an unsuffixed Node3D such as ReflectionProbe and not
    // NavigationAgent3D, whose base is plain Node.
    expect(named('ReflectionProbe')).toContain('binary-resource-reference');
    expect(named('ReflectionProbe')).toContain('valid-node3d-visibility');
    expect(named('GridMap')).toContain('valid-node3d-visibility');
    expect(named('RayCast3D')).toContain('valid-node3d-visibility');
    expect(named('NavigationAgent3D')).not.toContain('valid-node3d-visibility');
    expect(named('Label')).not.toContain('valid-node3d-visibility');
  });
});
