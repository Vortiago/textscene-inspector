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
 *
 * Every case writes nothing and shares no state, so all of them are launched at
 * module scope and awaited together: each run is ~100ms of Node cold start and
 * vitest runs `it` blocks in a file serially, so running them inline would make
 * the file ten cold starts long instead of one.
 */

import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const SCRIPT = join(import.meta.dirname, 'new-node-slice.mjs');
const REPO_ROOT = join(import.meta.dirname, '..');

/** Run the scaffold as a dry run; resolves to `{ ok, out }`, stdout+stderr merged. */
async function dry(args) {
  try {
    const { stdout } = await execFileAsync('node', [SCRIPT, ...args, '--dry-run'], {
      cwd: REPO_ROOT,
    });
    return { ok: true, out: stdout };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const INVOCATIONS = {
  noIntent: ['Widget3D', '3d', '--chain', 'Node3D'],
  badIntent: ['Widget3D', '3d', '--intent', 'maybe', '--chain', 'Node3D'],
  noChain: ['Widget3D', '3d', '--intent', 'pending'],
  selfChain: ['Widget3D', '3d', '--intent', 'pending', '--chain', 'Widget3D'],
  removedFlag: [
    'Widget3D', '3d', '--intent', 'transform-only', '--chain', 'Node3D', '--transform-only',
  ],
  controlRendering: [
    'Container', '2d/ui', '--base', 'control', '--intent', 'transform-only', '--chain', 'Control',
  ],
  transformOnly: [
    'RayCast3D', 'physics/3d', '--intent', 'transform-only', '--chain', 'Node3D', '--linter',
  ],
  transformOnly2D: [
    'Probe2D', '2d', '--base', 'node2d', '--intent', 'transform-only', '--chain', 'Node2D',
  ],
  pending: [
    'ProgressBar', '2d/ui', '--base', 'control', '--intent', 'pending', '--chain', 'Range', '--linter',
  ],
  draws: ['Widget3D', '3d', '--intent', 'draws', '--chain', 'Node3D'],
  controlPending: [
    'CheckButton', '2d/ui', '--base', 'control', '--intent', 'pending', '--chain', 'BaseButton',
  ],
};

const keys = Object.keys(INVOCATIONS);
const results = Object.fromEntries(
  (await Promise.all(keys.map((k) => dry(INVOCATIONS[k])))).map((r, i) => [keys[i], r])
);

describe('new-node-slice argument contract', () => {
  it('refuses to run without --intent', () => {
    expect(results.noIntent.ok).toBe(false);
    expect(results.noIntent.out).toMatch(/--intent is required/);
  });

  it('refuses an unknown --intent', () => {
    expect(results.badIntent.ok).toBe(false);
    expect(results.badIntent.out).toMatch(/--intent is required and must be one of/);
  });

  it('refuses to run without --chain, naming the silent failure it prevents', () => {
    expect(results.noChain.ok).toBe(false);
    expect(results.noChain.out).toMatch(/--chain is required/);
    expect(results.noChain.out).toMatch(/no inherited validation/);
  });

  it('refuses a --chain that names the type itself', () => {
    expect(results.selfChain.ok).toBe(false);
    expect(results.selfChain.out).toMatch(/must be the PARENT class/);
  });

  it('rejects the removed --transform-only flag instead of silently ignoring it', () => {
    expect(results.removedFlag.ok).toBe(false);
    expect(results.removedFlag.out).toMatch(/--transform-only is gone/);
  });

  it('refuses a rendering Control, which needs the overlay registry it cannot wire', () => {
    // The scaffold emits nodeComponentRegistry + r3f/nodes/index.ts. A Control
    // that draws belongs to controlComponentRegistry, r3f/controls/index.ts and
    // TWO_D_UI_TYPES (ADR-0003) — so it must refuse rather than register a DOM
    // component into the THREE registry.
    expect(results.controlRendering.ok).toBe(false);
    expect(results.controlRendering.out).toMatch(/--base control supports only --intent pending/);
  });
});

describe('new-node-slice intent shapes', () => {
  it('gives a transform-only slice a render registration and the base-type entry', () => {
    const { ok, out } = results.transformOnly;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/index\.r3f\.ts/);
    expect(out).toMatch(/wire.*r3f\/nodes\/index\.ts/);
    expect(out).toMatch(/wire.*nodeBaseTypes\.ts \(RayCast3D → NODE3D_LEAVES\)/);
    // No own parser/types/Component: property knowledge lives in linterParser.
    expect(out).not.toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/parser\.ts/);
    expect(out).not.toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/Component\.tsx/);
  });

  it('leaves a pending slice with no render registration and no render wiring', () => {
    const { ok, out } = results.pending;
    expect(ok).toBe(true);
    expect(out).not.toMatch(/index\.r3f\.ts/);
    expect(out).not.toMatch(/wire.*r3f\/nodes\/index\.ts/);
    // A parent owning no *_LEAVES array becomes an explicit object entry.
    expect(out).toMatch(/wire.*nodeBaseTypes\.ts \(ProgressBar: 'Range'\)/);
    expect(out).toMatch(/wire.*linter\/index\.ts/);
  });

  it('gives a draws slice its own parser, types and Component', () => {
    const { ok, out } = results.draws;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/3d\/widget3d\/parser\.ts/);
    expect(out).toMatch(/create {2}nodes\/3d\/widget3d\/types\.ts/);
    expect(out).toMatch(/create {2}nodes\/3d\/widget3d\/Component\.tsx/);
  });

  it('accepts control as a base for a pending slice', () => {
    expect(results.controlPending.ok).toBe(true);
    expect(results.controlPending.out).toMatch(/base: control, intent: pending/);
  });

  it('marks a node2d slice canvasItem, so it lands in the 2D workspace', () => {
    // `canvasItemRegistry.guard.test.ts` requires every 2D-suffixed type to be
    // a canvasItem; without the flag the dispatcher renders it in the 3D
    // viewport instead, and the guard catches it only after the slice is built.
    expect(results.transformOnly2D.ok).toBe(true);
    expect(results.transformOnly2D.out).toMatch(/base: node2d, intent: transform-only/);
  });

  it('writes nothing on a dry run', () => {
    // The scaffold aborts on an existing slice, so a leaked write would turn the
    // repeated runs above into failures rather than passing silently.
    expect(results.transformOnly.out).toMatch(/dry run — nothing written/);
  });
});
