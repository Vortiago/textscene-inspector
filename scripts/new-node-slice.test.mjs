/**
 * Contract tests for the slice scaffold through `--dry-run`, which prints the plan's file names
 * and writes nothing. A case about generated content renders the template directly. The runs
 * share no state, so they start together at module scope: each is about 100 ms of Node cold
 * start, and vitest runs a file's `it` blocks serially.
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

/** Runs the scaffold as a dry run. Resolves to `{ ok, out }`, with stdout and stderr merged. */
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
  noIntent: ['Widget3D', '3d'],
  badIntent: ['Widget3D', '3d', '--intent', 'maybe'],
  removedFlag: [
    'Widget3D', '3d', '--intent', 'transform-only', '--transform-only',
  ],
  controlRendering: [
    'Container', '2d/ui', '--base', 'control', '--intent', 'transform-only', ],
  transformOnly: [
    'RayCast3D', 'physics/3d', '--intent', 'transform-only', '--linter',
  ],
  transformOnly2D: [
    'RayCast2D', '2d', '--base', 'node2d', '--intent', 'transform-only', ],
  pending: [
    'ProgressBar', '2d/ui', '--base', 'control', '--intent', 'pending', '--linter',
  ],
  draws: ['ShapeCast3D', '3d', '--intent', 'draws'],
  // MeshInstance3D owns a parser.ts, so `--base node3d` and the real ancestry disagree about what
  // a SoftBody3D slice reuses.
  drawsUnderTypedAncestor: ['SoftBody3D', '3d', '--intent', 'draws'],
  controlPending: [
    'CheckButton', '2d/ui', '--base', 'control', '--intent', 'pending', ],
  unknownType: ['Widget3D', '3d', '--intent', 'pending'],
  inheritsSkippingEmpty: [
    'AspectRatioContainer', '2d/ui', '--base', 'control', '--intent', 'pending',
    '--linter',
  ],
  inheritsFromImmediateParent: [
    'CheckButton', '2d/ui', '--base', 'control', '--intent', 'pending', '--linter',
  ],
  // A category dir no real slice occupies. The scaffold falls back from `shared/` to a type-named
  // dir when `shared/` is taken, so a real family would make the assertions depend on its state.
  tierValidatorsOnly: ['SpriteBase3D', '3d/scaffoldcheck', '--tier'],
  tierWithRule: ['SpriteBase3D', '3d/scaffoldcheck', '--tier', '--rule'],
  tierInstantiable: ['PinJoint2D', 'physics/2d', '--tier'],
  tierUnknown: ['Jiont2D', 'physics/2d', '--tier'],
  tierWithLeafFlag: ['SpriteBase3D', '3d/scaffoldcheck', '--tier', '--intent', 'pending'],
  tierWithBaseFlag: ['SpriteBase3D', '3d/scaffoldcheck', '--tier', '--base', 'node2d'],
  ruleWithoutTier: ['ShapeCast3D', '3d', '--intent', 'pending', '--rule'],
};

/**
 * Every case names a real Godot type, since the parent comes from ClassDB, and a real type can be
 * scaffolded at any time. So the dry-run check compares before and after, not `not.toExist`.
 */
const PROGRESSBAR_SLICE = join(REPO_ROOT, 'packages/textscene-core/src/nodes/2d/ui/progressbar');
const existedBefore = existsSync(PROGRESSBAR_SLICE);

const keys = Object.keys(INVOCATIONS);
const results = Object.fromEntries(
  (await Promise.all(keys.map((k) => dry(INVOCATIONS[k])))).map((r, i) => [keys[i], r])
);

describe('new-node-slice tier chaining', () => {
  it('chains a validators-only tier to the registration above it', () => {
    // Without its parent's linterParser import a tier fails baseChainImport's reachability check,
    // and the cheapest wrong fix imports any sibling that silences it.
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

  it('refuses a type name Godot does not know', () => {
    // An invented or misspelled type gets no base entry and so, silently, no inherited validator.
    // `Widget3D` is plausible and absent from ClassDB.
    expect(results.unknownType.ok).toBe(false);
    expect(results.unknownType.out).toMatch(/Widget3D is not in .*node-catalog\.json/);
  });

  it('inherits from the nearest ancestor that registers, not the --base flag', () => {
    // `Container` sits between AspectRatioContainer and Control and registers nothing (Godot binds
    // it no properties), so the immediate parent alone would skip Control's whole set.
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

  it('rejects the removed --transform-only flag instead of silently ignoring it', () => {
    expect(results.removedFlag.ok).toBe(false);
    expect(results.removedFlag.out).toMatch(/--transform-only is gone/);
  });

  it('refuses a rendering Control, which needs the overlay registry it cannot wire', () => {
    // The scaffold emits nodeComponentRegistry and r3f/nodes/index.ts, but a Control that draws
    // belongs to controlComponentRegistry, r3f/controls/index.ts and TWO_D_UI_TYPES (ADR-0003).
    expect(results.controlRendering.ok).toBe(false);
    expect(results.controlRendering.out).toMatch(/--base control supports only --intent pending/);
  });
});

describe('new-node-slice tier mode', () => {
  it('scaffolds a validators-only tier with no barrel entry', () => {
    // A leaf that imports its linterParser pulls in a validators-only tier, so a barrel entry is
    // redundant.
    const { ok, out } = results.tierValidatorsOnly;
    expect(ok).toBe(true);
    expect(out).toMatch(/create {2}nodes\/3d\/scaffoldcheck\/shared\/linterParser\.ts/);
    expect(out).not.toMatch(/linter\/index\.ts/);
    expect(out).toMatch(/validators-only tier: no barrel entry/);
  });

  it('wires the barrel only when the tier carries a rule', () => {
    // A rule has no leaf importer, so without the barrel entry ruleCoverage reports it as never
    // registered.
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
    expect(results.tierWithLeafFlag.out).toMatch(/--intent does not apply to --tier/);
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
    // It proves the slice's own self-registration through both entry points and registries. It
    // cannot see a dropped aggregation import, which `parserBarrelCompleteness` checks.
    expect(results.draws.out).toMatch(/create {2}nodes\/3d\/shapecast3d\/shapecast3d\.test\.ts/);

    const emitted = drawsFiles({
      typeName: 'ShapeCast3D',
      lower: 'shapecast3d',
      camel: 'shapeCast3D',
      base: BASES.node3d,
      toSrc: '../../../',
      toBase: '../../base/node3d',
      reusedParser: {
        fn: 'parseNode3D',
        importPath: '../../base/node3d/parser',
        propsType: 'Node3DProperties',
        typesPath: '../../base/node3d/types',
      },
    });
    const test = emitted.get('shapecast3d.test.ts');
    expect(test).toContain("import './index';");
    expect(test).toContain("import './index.r3f';");
    expect(test).toContain("nodeRegistry.getRegistration('ShapeCast3D')");
    expect(test).toContain("nodeComponentRegistry.get('ShapeCast3D')");
    // The import above registers the slice, so a spy for this warning could never fire.
    expect(test).not.toContain('Unsupported node type');
  });

  it('points a `draws` slice at the nearest typed ancestor, not the --base flag', () => {
    // With `parseNode3D`, a SoftBody3D slice would validate `mesh`, `skin` and the material
    // overrides and then discard them. The plan settles the resolution, and the template renders
    // directly for the call and the props alias, which `--dry-run` does not print.
    const { ok, out } = results.drawsUnderTypedAncestor;
    expect(ok).toBe(true);
    expect(out).toMatch(/parser {2}parseMeshInstance3D from \.\.\/meshinstance3d\/parser/);

    const emitted = drawsFiles({
      typeName: 'SoftBody3D',
      lower: 'softbody3d',
      camel: 'softBody3D',
      base: BASES.node3d,
      toSrc: '../../../',
      toBase: '../../base/node3d',
      reusedParser: {
        fn: 'parseMeshInstance3D',
        importPath: '../meshinstance3d/parser',
        propsType: 'MeshInstance3DProperties',
        typesPath: '../meshinstance3d/types',
      },
    });
    // An import of the ancestor parse beside a call of the base one compiles only while
    // slice.mjs pins the two equal.
    expect(emitted.get('parser.ts')).toContain('parseMeshInstance3D(heading, properties)');
    expect(emitted.get('parser.ts')).not.toContain('parseNode3D');
    expect(emitted.get('types.ts')).toContain(
      "import type { MeshInstance3DProperties } from '../meshinstance3d/types';"
    );
    expect(emitted.get('types.ts')).toContain(
      'export type SoftBody3DProperties = MeshInstance3DProperties;'
    );
  });

  it('accepts control as a base for a pending slice', () => {
    expect(results.controlPending.ok).toBe(true);
    expect(results.controlPending.out).toMatch(/base: control, intent: pending/);
  });

  it('marks a node2d slice canvasItem, so it lands in the 2D workspace', () => {
    // Without the flag the dispatcher renders the slice in the 3D viewport, which
    // `canvasItemRegistry.guard.test.ts` catches only once the slice is built. `--dry-run` prints
    // only names, so the template renders directly for the flag.
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
    // The flag is the base's, and the two templates emit it independently. Without it a node2d
    // slice fails canvasItemRegistry.guard, while a node slice drops `container` and its subtree
    // vanishes from the 2D canvas with no guard to notice.
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
        reusedParser: {
          fn: BASES[baseKey].parser,
          importPath: `../../${BASES[baseKey].dir}/parser`,
          propsType: BASES[baseKey].propsType,
          typesPath: `../../${BASES[baseKey].dir}/types`,
        },
      });
      expect(emitted.get('index.r3f.ts'), baseKey).toMatch(flag);
    }
  });

  it('mounts a `pending` slice on its base rather than dropping to the fallback', () => {
    // A gap still needs `visible` and the workspace split, which `GenericNodeFallback` lacks. The
    // badge reads `renderIntent: 'pending'`, not an absent registration.
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
    // The Node bases mount an invisible transform group, but a mounted `Control` swaps the
    // `display: contents` passthrough for positioned divs, which changes the render.
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
    // Asserted against the filesystem: the ProgressBar run prints a full plan, so a leaked write
    // would land here.
    expect(results.transformOnly.out).toMatch(/dry run — nothing written/);
    expect(existsSync(PROGRESSBAR_SLICE)).toBe(existedBefore);
  });
});
