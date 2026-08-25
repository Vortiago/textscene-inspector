/**
 * Contract tests for the slice scaffold, driven through `--dry-run`.
 *
 * The scaffold is about to run ~150 times, and three of its decisions are the
 * ones a subagent cannot recover from on its own:
 *
 *   - `--intent` must settle the render registration and the sheet status
 *     TOGETHER, because `sheets.test.mjs` asserts they agree and a mismatch
 *     fails the wave rather than the slice.
 *   - `--chain` must be mandatory and must agree with ClassDB. `NODE_BASE_TYPES`
 *     is derived from the catalog, so a type name Godot does not know receives
 *     zero inherited validation — no error, no warning.
 *   - a `pending` slice must wire NO render barrel, since the absence of a
 *     component is exactly what keeps the "Not implemented" badge honest.
 *
 * `--dry-run` prints the full plan and writes nothing, so these assert the plan
 * without touching the tree. The plan is file NAMES, so the one case about
 * generated CONTENT — the node2d `canvasItem` flag — renders that template
 * directly instead.
 *
 * Every case writes nothing and shares no state, so all of them are launched at
 * module scope and awaited together: each run is ~100ms of Node cold start and
 * vitest runs `it` blocks in a file serially, so running them inline would make
 * the file ten cold starts long instead of one.
 */

import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASES } from './new-node-slice/bases.mjs';
import { reusedParserFiles } from './new-node-slice/templates/reusedParser.mjs';
import { drawsFiles } from './new-node-slice/templates/drawsSlice.mjs';

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
    'RayCast2D', '2d', '--base', 'node2d', '--intent', 'transform-only', '--chain', 'Node2D',
  ],
  pending: [
    'ProgressBar', '2d/ui', '--base', 'control', '--intent', 'pending', '--chain', 'Range', '--linter',
  ],
  draws: ['ShapeCast3D', '3d', '--intent', 'draws', '--chain', 'Node3D'],
  controlPending: [
    'CheckButton', '2d/ui', '--base', 'control', '--intent', 'pending', '--chain', 'Button',
  ],
  unknownType: ['Widget3D', '3d', '--intent', 'pending', '--chain', 'Node3D'],
  inheritsSkippingEmpty: [
    'AspectRatioContainer', '2d/ui', '--base', 'control', '--intent', 'pending',
    '--chain', 'Container', '--linter',
  ],
  inheritsFromImmediateParent: [
    'CheckButton', '2d/ui', '--base', 'control', '--intent', 'pending', '--chain', 'Button', '--linter',
  ],
  wrongChain: ['ShapeCast3D', '3d', '--intent', 'pending', '--chain', 'Node2D'],
  // A category dir NO real slice occupies. These are dry runs so nothing is
  // written, and the path only has to be free: the scaffold falls back from the
  // canonical `shared/` to a type-named dir when `shared/` is already taken, so
  // pointing these at a real family made the assertions depend on that family
  // being unimplemented — which stopped being true the day SpriteBase3D got its
  // tier.
  tierValidatorsOnly: ['SpriteBase3D', '3d/scaffoldcheck', '--tier'],
  tierWithRule: ['SpriteBase3D', '3d/scaffoldcheck', '--tier', '--rule'],
  tierInstantiable: ['PinJoint2D', 'physics/2d', '--tier'],
  tierUnknown: ['Jiont2D', 'physics/2d', '--tier'],
  tierWithLeafFlag: ['SpriteBase3D', '3d/scaffoldcheck', '--tier', '--chain', 'Node3D'],
  tierWithBaseFlag: ['SpriteBase3D', '3d/scaffoldcheck', '--tier', '--base', 'node2d'],
  ruleWithoutTier: ['ShapeCast3D', '3d', '--intent', 'pending', '--chain', 'Node3D', '--rule'],
};

/**
 * Every case names a REAL Godot type, because `--chain` is checked against
 * ClassDB. Real types get scaffolded as the coverage waves reach them, so
 * nothing here may assume its type is still unscaffolded — hence the
 * before/after snapshot rather than a bare `not.toExist`.
 */
const PROGRESSBAR_SLICE = join(REPO_ROOT, 'packages/textscene-core/src/nodes/2d/ui/progressbar');
const existedBefore = existsSync(PROGRESSBAR_SLICE);

const keys = Object.keys(INVOCATIONS);
const results = Object.fromEntries(
  (await Promise.all(keys.map((k) => dry(INVOCATIONS[k])))).map((r, i) => [keys[i], r])
);

describe('new-node-slice tier chaining', () => {
  it('chains a validators-only tier to the registration above it', () => {
    // A tier that registers without importing its parent's linterParser fails
    // baseChainImport's "every slice REACHES the ancestor the base chain names",
    // and the cheapest wrong fix is to import any sibling that silences it.
    expect(results.tierValidatorsOnly.ok).toBe(true);
    expect(results.tierValidatorsOnly.out).toMatch(/inherit\s+\S*linterParser\.js/);
  });
});

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

  it('refuses a type name Godot does not know', () => {
    // The base table is derived from the catalog, so an invented or misspelled
    // type gets no entry and no inherited validator — silently. `Widget3D` is
    // the shape of that mistake: plausible, and absent from ClassDB.
    expect(results.unknownType.ok).toBe(false);
    expect(results.unknownType.out).toMatch(/Widget3D is not in .*node-catalog\.json/);
  });

  it('inherits from the nearest ancestor that registers, not the --base flag', () => {
    // `Container` sits between AspectRatioContainer and Control and registers
    // nothing (Godot binds it no properties), so stopping at the immediate
    // parent would skip Control's whole set. Three agents in one wave
    // disagreed about this import; the scaffold now settles it.
    const { ok, out } = results.inheritsSkippingEmpty;
    expect(ok).toBe(true);
    expect(out).toMatch(/inherit \.\.\/control\/linterParser\.js/);
  });

  it('stops at the immediate parent when that parent does register', () => {
    // The other half of the same rule: Button declares its own 13 members, so
    // CheckButton must import Button rather than walking past it to BaseButton.
    const { ok, out } = results.inheritsFromImmediateParent;
    expect(ok).toBe(true);
    expect(out).toMatch(/inherit \.\.\/button\/linterParser\.js/);
  });

  it('refuses a --chain Godot disagrees with, naming the real parent', () => {
    expect(results.wrongChain.ok).toBe(false);
    expect(results.wrongChain.out).toMatch(/ShapeCast3D derives from Node3D/);
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

describe('new-node-slice tier mode', () => {
  it('scaffolds a validators-only tier with no barrel entry', () => {
    // A validators-only tier is pulled in by whichever leaf imports its
    // linterParser, so wiring the barrel would be redundant.
    const { ok, out } = results.tierValidatorsOnly;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/3d\/scaffoldcheck\/shared\/linterParser\.ts/);
    expect(out).not.toMatch(/linter\/index\.ts/);
    expect(out).toMatch(/validators-only tier: no barrel entry/);
  });

  it('wires the barrel only when the tier carries a rule', () => {
    // A rule has no leaf importer, so without the barrel entry ruleCoverage
    // reports it as declared-but-never-registered.
    const { ok, out } = results.tierWithRule;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/3d\/scaffoldcheck\/shared\/linter\.ts/);
    expect(out).toMatch(/wire.*linter\/index\.ts/);
  });

  it('names the subclasses the tier will reach, so a mis-keyed tier is visible', () => {
    expect(results.tierValidatorsOnly.out).toMatch(/heirs {3}\d+: /);
  });

  it('refuses an instantiable type, which wants an ordinary slice', () => {
    expect(results.tierInstantiable.ok).toBe(false);
    expect(results.tierInstantiable.out).toMatch(/PinJoint2D is instantiable/);
  });

  it('refuses a name no catalogued type descends from', () => {
    // The tier-shaped typo: it registers validators nothing can inherit, and
    // nothing else would fail.
    expect(results.tierUnknown.ok).toBe(false);
    expect(results.tierUnknown.out).toMatch(/No catalogued type descends from Jiont2D/);
  });

  it('refuses leaf flags on a tier, and --rule without one', () => {
    expect(results.tierWithLeafFlag.ok).toBe(false);
    expect(results.tierWithLeafFlag.out).toMatch(/--chain does not apply to --tier/);
    // `--base` carries a default, so it is the one of the three that can be
    // passed without changing `opts` in a way the branch could notice.
    expect(results.tierWithBaseFlag.ok).toBe(false);
    expect(results.tierWithBaseFlag.out).toMatch(/--base does not apply to --tier/);
    expect(results.ruleWithoutTier.ok).toBe(false);
    expect(results.ruleWithoutTier.out).toMatch(/--rule only applies with --tier/);
  });
});

describe('new-node-slice intent shapes', () => {
  it('gives a transform-only slice a render registration and the base-type entry', () => {
    const { ok, out } = results.transformOnly;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/index\.r3f\.ts/);
    expect(out).toMatch(/wire.*r3f\/nodes\/index\.ts/);
    expect(out).toMatch(/chain {3}RayCast3D → Node3D \(derived/);
    // No own parser/types/Component: property knowledge lives in linterParser.
    expect(out).not.toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/parser\.ts/);
    expect(out).not.toMatch(/create {2}nodes\/physics\/3d\/raycast3d\/Component\.tsx/);
  });

  it('leaves a pending slice with no render registration and no render wiring', () => {
    const { ok, out } = results.pending;
    expect(ok).toBe(true);
    expect(out).not.toMatch(/index\.r3f\.ts/);
    expect(out).not.toMatch(/wire.*r3f\/nodes\/index\.ts/);
    expect(out).toMatch(/chain {3}ProgressBar → Range \(derived/);
    expect(out).toMatch(/wire.*linter\/index\.ts/);
  });

  it('gives a draws slice its own parser, types and Component', () => {
    const { ok, out } = results.draws;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/3d\/shapecast3d\/parser\.ts/);
    expect(out).toMatch(/create {2}nodes\/3d\/shapecast3d\/types\.ts/);
    expect(out).toMatch(/create {2}nodes\/3d\/shapecast3d\/Component\.tsx/);
  });

  it('gives a draws slice the registration test the other shapes carry', () => {
    // Without it nothing in the slice loads either aggregation barrel, so a
    // dropped import in `parser/TscnParser.ts` or `r3f/nodes/index.ts` leaves
    // every co-located test green while the type falls back to Node at runtime.
    expect(results.draws.out).toMatch(/create {2}nodes\/3d\/shapecast3d\/shapecast3d\.test\.ts/);

    const emitted = drawsFiles({
      typeName: 'ShapeCast3D',
      lower: 'shapecast3d',
      camel: 'shapeCast3D',
      base: BASES.node3d,
      toSrc: '../../../',
      toBase: '../../base/node3d',
      reusedParser: { fn: 'parseNode3D', importPath: '../../base/node3d/parser' },
    });
    const test = emitted.get('shapecast3d.test.ts');
    expect(test).toContain("import './index';");
    expect(test).toContain("import './index.r3f';");
    expect(test).toContain('Unsupported node type');
  });

  it('accepts control as a base for a pending slice', () => {
    expect(results.controlPending.ok).toBe(true);
    expect(results.controlPending.out).toMatch(/base: control, intent: pending/);
  });

  it('marks a node2d slice canvasItem, so it lands in the 2D workspace', () => {
    // Without the flag the dispatcher renders the slice in the 3D viewport, and
    // `canvasItemRegistry.guard.test.ts` catches it only once the slice is
    // built. The flag lives in generated CONTENT and `--dry-run` prints only
    // names, so the plan settles the routing and the template is rendered
    // directly for the emit.
    expect(results.transformOnly2D.ok).toBe(true);
    expect(results.transformOnly2D.out).toMatch(/base: node2d, intent: transform-only/);
    expect(results.transformOnly2D.out).toMatch(/create {2}nodes\/2d\/raycast2d\/index\.r3f\.ts/);

    const emitted = reusedParserFiles({
      typeName: 'RayCast2D',
      lower: 'raycast2d',
      camel: 'rayCast2D',
      intent: 'transform-only',
      base: BASES.node2d,
      toSrc: '../../../',
      toBase: '../../base/node2d',
      reusedParser: { fn: 'parseNode2D', importPath: '../../base/node2d/parser' },
    });
    expect(emitted.get('index.r3f.ts')).toMatch(/^\s*canvasItem: true,$/m);
  });

  it('routes a `draws` slice to the same workspace its base declares', () => {
    // The flag is the base's, not the intent's, and the two templates emit it
    // independently. A `draws` slice missing it fails differently per base:
    // node2d turns canvasItemRegistry.guard red immediately, while node drops
    // `container` and the subtree silently vanishes from the 2D canvas with no
    // guard to notice.
    for (const [baseKey, flag] of [
      ['node2d', /^\s*canvasItem: true,$/m],
      ['node', /^\s*container: true,$/m],
    ]) {
      const emitted = drawsFiles({
        typeName: 'Widget',
        camel: 'widget',
        base: BASES[baseKey],
        toSrc: '../../../',
        toBase: `../../${BASES[baseKey].dir}`,
        reusedParser: { fn: BASES[baseKey].parser, importPath: `../../${BASES[baseKey].dir}/parser` },
      });
      expect(emitted.get('index.r3f.ts'), baseKey).toMatch(flag);
    }
  });

  it('mounts a `pending` slice on its base rather than dropping to the fallback', () => {
    // A gap still needs `visible` and the workspace split, and
    // `GenericNodeFallback` carries neither. `renderIntent: 'pending'` is what
    // keeps the badge honest instead of the absent registration.
    const emitted = reusedParserFiles({
      typeName: 'ReflectionProbe',
      lower: 'reflectionprobe',
      camel: 'reflectionProbe',
      intent: 'pending',
      base: BASES.node3d,
      toSrc: '../../../',
      toBase: '../../base/node3d',
      reusedParser: { fn: 'parseNode3D', importPath: '../../base/node3d/parser' },
    });
    expect(emitted.get('index.r3f.ts')).toMatch(/^\s*renderIntent: 'pending',$/m);
  });

  it('leaves a `pending` Control on the passthrough fallback', () => {
    // Deliberately not symmetric. The Node bases mount an invisible transform
    // group, but mounting `Control` swaps `display: contents` passthrough for
    // positioned anchor-laid-out divs — a render change, not a badge fix.
    const emitted = reusedParserFiles({
      typeName: 'ProgressBar',
      lower: 'progressbar',
      camel: 'progressBar',
      intent: 'pending',
      base: BASES.control,
      toSrc: '../../../../',
      toBase: '../../../2d/ui/control',
      reusedParser: { fn: 'parseControl', importPath: '../../../2d/ui/control/parser' },
    });
    expect(emitted.has('index.r3f.ts')).toBe(false);
  });

  it('writes nothing on a dry run', () => {
    // Asserted against the filesystem, not just the message: the ProgressBar run
    // above prints a full create/wire plan, so a leaked write would land here.
    expect(results.transformOnly.out).toMatch(/dry run — nothing written/);
    expect(existsSync(PROGRESSBAR_SLICE)).toBe(existedBefore);
  });
});
