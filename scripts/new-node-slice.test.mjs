/**
 * Contract tests for the slice scaffold, driven through `--dry-run`.
 *
 * The scaffold is about to run ~150 times, and three of its decisions are the
 * ones a subagent cannot recover from on its own:
 *
 *   - `--intent` must settle the render registration and the sheet status
 *     TOGETHER, because `sheets.test.mjs` asserts they agree and a mismatch
 *     fails the wave rather than the slice.
 *   - `--chain` must be mandatory. A type missing from `NODE_BASE_TYPES`
 *     silently receives zero inherited validation — no error, no warning.
 *   - a `pending` slice must wire NO render barrel, since the absence of a
 *     component is exactly what keeps the "Not implemented" badge honest.
 *
 * `--dry-run` prints the full plan and writes nothing, so these assert the plan
 * without touching the tree.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dirname, 'new-node-slice.mjs');
const REPO_ROOT = join(import.meta.dirname, '..');

/** Run the scaffold; returns `{ ok, out }` with stdout+stderr merged. */
function run(args) {
  try {
    return {
      ok: true,
      out: execFileSync('node', [SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const dry = (args) => run([...args, '--dry-run']);

describe('new-node-slice argument contract', () => {
  it('refuses to run without --intent', () => {
    const { ok, out } = dry(['Widget3D', '3d', '--chain', 'Node3D']);
    expect(ok).toBe(false);
    expect(out).toMatch(/--intent is required/);
  });

  it('refuses an unknown --intent', () => {
    const { ok, out } = dry(['Widget3D', '3d', '--intent', 'maybe', '--chain', 'Node3D']);
    expect(ok).toBe(false);
    expect(out).toMatch(/--intent is required and must be one of/);
  });

  it('refuses to run without --chain, naming the silent failure it prevents', () => {
    const { ok, out } = dry(['Widget3D', '3d', '--intent', 'pending']);
    expect(ok).toBe(false);
    expect(out).toMatch(/--chain is required/);
    expect(out).toMatch(/no inherited validation/);
  });

  it('refuses a --chain that names the type itself', () => {
    const { ok, out } = dry(['Widget3D', '3d', '--intent', 'pending', '--chain', 'Widget3D']);
    expect(ok).toBe(false);
    expect(out).toMatch(/must be the PARENT class/);
  });

  it('rejects the removed --transform-only flag instead of silently ignoring it', () => {
    const { ok, out } = dry([
      'Widget3D',
      '3d',
      '--intent',
      'transform-only',
      '--chain',
      'Node3D',
      '--transform-only',
    ]);
    expect(ok).toBe(false);
    expect(out).toMatch(/--transform-only is gone/);
  });
});

describe('new-node-slice intent shapes', () => {
  it('gives a transform-only slice a render registration and the base-type entry', () => {
    const { ok, out } = dry([
      'RayCast3D',
      'physics/3d',
      '--intent',
      'transform-only',
      '--chain',
      'Node3D',
      '--linter',
    ]);
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/index\.r3f\.ts/);
    expect(out).toMatch(/wire.*r3f\/nodes\/index\.ts/);
    expect(out).toMatch(/wire.*nodeBaseTypes\.ts \(RayCast3D → NODE3D_LEAVES\)/);
    // No own parser/types/Component: property knowledge lives in linterParser.
    expect(out).not.toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/parser\.ts/);
    expect(out).not.toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/Component\.tsx/);
  });

  it('leaves a pending slice with no render registration and no render wiring', () => {
    const { ok, out } = dry([
      'ProgressBar',
      '2d/ui',
      '--base',
      'control',
      '--intent',
      'pending',
      '--chain',
      'Range',
      '--linter',
    ]);
    expect(ok).toBe(true);
    expect(out).not.toMatch(/index\.r3f\.ts/);
    expect(out).not.toMatch(/wire.*r3f\/nodes\/index\.ts/);
    // A parent owning no *_LEAVES array becomes an explicit object entry.
    expect(out).toMatch(/wire.*nodeBaseTypes\.ts \(ProgressBar: 'Range'\)/);
    expect(out).toMatch(/wire.*linter\/index\.ts/);
  });

  it('gives a draws slice its own parser, types and Component', () => {
    const { ok, out } = dry(['Widget3D', '3d', '--intent', 'draws', '--chain', 'Node3D']);
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/3d\/widget3d\/parser\.ts/);
    expect(out).toMatch(/create {2}nodes\/3d\/widget3d\/types\.ts/);
    expect(out).toMatch(/create {2}nodes\/3d\/widget3d\/Component\.tsx/);
  });

  it('accepts control as a base', () => {
    const { ok, out } = dry([
      'CheckButton',
      '2d/ui',
      '--base',
      'control',
      '--intent',
      'pending',
      '--chain',
      'BaseButton',
    ]);
    expect(ok).toBe(true);
    expect(out).toMatch(/base: control, intent: pending/);
  });

  it('writes nothing on a dry run', () => {
    const { out } = dry(['RayCast3D', 'physics/3d', '--intent', 'transform-only', '--chain', 'Node3D']);
    expect(out).toMatch(/dry run — nothing written/);
    // The scaffold aborts on an existing slice, so a leaked write would turn the
    // repeated runs above into failures rather than passing silently.
  });
});
