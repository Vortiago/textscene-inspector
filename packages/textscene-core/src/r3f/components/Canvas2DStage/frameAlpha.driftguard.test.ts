/**
 * Drift guard: every viewport frame copy picks its transfer through `viewportTransfer`, so an opaque
 * viewport's image reads alpha 1 as Godot's `swizzle_a = ONE` view does (`texture_storage.cpp:3641-3642`).
 * A copy that passes no transfer, or a fixed one, lets a SUB or MUL item show what lies behind.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { callSites, isProductionSource, reportOffenders, walkSources } from '../../testing/sourceScan';

const SOURCE_ROOT = join(import.meta.dirname, '../../..');

/** `frame.render(…)` and `frame.draw(…)` calls whose last argument is no `viewportTransfer(…)`. */
function fixedTransferLines(source: string): number[] {
  return callSites(source, /\bframe\.(?:render|draw)\(/)
    .filter((site) => !/^viewportTransfer\(/.test(site.args.at(-1) ?? ''))
    .map((site) => site.line);
}

const SOURCES = walkSources([SOURCE_ROOT], isProductionSource);

describe('viewport frame copies', () => {
  it('take their transfer from viewportTransfer', () => {
    const offenders = reportOffenders(SOURCES, fixedTransferLines);
    expect(offenders, `pass viewportTransfer(…): ${offenders.join(', ')}`).toEqual([]);
  });

  it('would catch a copy with no transfer or a fixed one, and passes a chosen one', () => {
    expect(fixedTransferLines('  frame.render(gl, scene, camera);')).toEqual([1]);
    expect(fixedTransferLines("  frame.draw(gl, scene, camera, clears, 'decode');")).toEqual([1]);
    expect(
      fixedTransferLines("  frame.render(gl, scene, camera, viewportTransfer('none', isTransparent));")
    ).toEqual([]);
  });
});
