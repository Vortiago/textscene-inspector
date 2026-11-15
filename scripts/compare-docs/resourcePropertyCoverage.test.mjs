/**
 * `enginePropertyCoverage`'s question, asked of the resources in a `.tscn`'s
 * `[sub_resource]` sections. Scope: every resource class the ClassDB capture
 * holds, since the property descriptor checks a class no slice registers.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireFreshDist } from '../distFreshness.mjs';
import { loadCoreLinter } from './loadCoreLinter.mjs';
import { unvalidatedByClass } from './registryKeys.mjs';
import { RESOURCE_PROPS_OUT } from './build-node-catalog/paths.mjs';

const CORE = join(import.meta.dirname, '../../packages/textscene-core');

describe('resource property coverage', { timeout: 60_000 }, () => {
  const engine = JSON.parse(readFileSync(RESOURCE_PROPS_OUT, 'utf8'));

  // Not `existsSync(dist)`, which skips on no build and passes a stale one. In
  // `beforeAll`, not at module scope, where a throw during a concurrent `tsc
  // --build` surfaces as a collection error instead of this message.
  beforeAll(() => {
    requireFreshDist(CORE, 'this coverage ledger');
  });

  let validatorRegistry;
  // 60s, matching the suite option above, not the 10s hook default: three
  // ledgers load the barrel at once under a full `--project scripts` run.
  beforeAll(async () => {
    ({ validatorRegistry } = await loadCoreLinter());
  }, 60_000);

  it('counts against what the engine declares, which the capture must carry', () => {
    expect(Object.keys(engine).length).toBeGreaterThan(250);
    expect(engine.BaseMaterial3D?.length).toBeGreaterThan(100);
    // The leaf declares nothing of its own, so the validators cannot live there.
    expect(engine.StandardMaterial3D).toBeUndefined();
  });

  it('leaves no property of any captured resource class unvalidated', () => {
    // The property descriptor answers a class no slice registers, so the scope is the capture.
    const rows = unvalidatedByClass(engine, validatorRegistry, new Set(Object.keys(engine)));
    const report = rows.map((r) => `  ${r.cls} (${r.missing.length}): ${r.missing.join(', ')}`);
    expect(report).toEqual([]);
  });
});
