/**
 * BoxContainer's native rect solve, tested against literal inputs — no React,
 * no scene cache, no TscnParser (except the one integration test that reads
 * the actual committed fixture). Every expected rect is either:
 *  - measured directly off real Godot 4.6.3 via a `SubViewport` + `get_rect()`
 *    probe (the technique documented for this packet), reproduced here as a
 *    synthetic `custom_minimum_size` input rather than a Label, so a
 *    font-metric regression and a `_resort` regression can never present as
 *    the same failure, or
 *  - a hand-worked arithmetic example from the cited Godot source, shown in
 *    the comment.
 * None are re-derived the way the implementation derives them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TscnNode } from '../../../../parser/types';
import { TscnParser } from '../../../../parser/TscnParser';
import { fixturesDir } from '../../../../parser/testing/parserKit';
import { joinPath } from '../../../../utils/nodePath';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import {
  boxContainerMinimumSize,
  makeBoxContainerLayout,
  makeBoxContainerMinimumSize,
  resortBoxContainer,
  type BoxChildInput,
} from './boxContainerSolver';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const HORIZONTAL = 3; // Control.SIZE_FILL | SIZE_EXPAND
const FILL = 1;
const EXPAND = 2;
const SHRINK_CENTER = 4;

function child(overrides: Partial<BoxChildInput> = {}): BoxChildInput {
  return {
    minSize: { x: 0, y: 0 },
    hSizeFlags: FILL,
    vSizeFlags: FILL,
    stretchRatio: 1,
    ...overrides,
  };
}

// --- Both original fixtures, reproduced with synthetic minimum sizes -------
// (unit-vbox-container.tscn / unit-hbox-container.tscn; rects measured by the
// probe-project SubViewport + get_rect() oracle documented for this packet.)

describe('resortBoxContainer — unit-vbox-container.tscn, reproduced synthetically', () => {
  it('END alignment (no child expands): Top/Bottom land at y=586/625, height 23 each', () => {
    // box_container.cpp: stretch_min = 23+23 = 46; stretch_max = 648-16 = 632;
    // stretch_diff = 632-46 = 586; ratio_total = 0 (no EXPAND) => ofs = stretch_diff (END).
    const children = [
      child({ minSize: { x: 0, y: 23 }, vSizeFlags: SHRINK_CENTER }),
      child({ minSize: { x: 0, y: 23 }, vSizeFlags: SHRINK_CENTER }),
    ];
    const rects = resortBoxContainer(true, { width: 1152, height: 648 }, 16, 2, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 586, w: 1152, h: 23 },
      { x: 0, y: 625, w: 1152, h: 23 },
    ]);
  });
});

describe('resortBoxContainer — unit-hbox-container.tscn, reproduced synthetically', () => {
  const children = [
    child({ minSize: { x: 20, y: 23 }, hSizeFlags: HORIZONTAL, vSizeFlags: SHRINK_CENTER }),
    child({ minSize: { x: 25, y: 23 }, hSizeFlags: HORIZONTAL, vSizeFlags: SHRINK_CENTER }),
  ];

  it('two FILL|EXPAND children split the 1140px stretch range exactly 570/570', () => {
    // stretch_max = 1152-12 = 1140; ratio_total = 2 => 1140 * 1/2 = 570.0 exactly, no carry.
    const rects = resortBoxContainer(false, { width: 1152, height: 648 }, 12, 1, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 312, w: 570, h: 23 },
      { x: 582, y: 312, w: 570, h: 23 },
    ]);
  });

  it('rule 2 — alignment is dead the instant a child expands: 0/1/2 all produce the identical split', () => {
    const byAlignment = ([0, 1, 2] as const).map((alignment) =>
      resortBoxContainer(false, { width: 1152, height: 648 }, 12, alignment, false, children)
    );
    expect(byAlignment[1]).toEqual(byAlignment[0]);
    expect(byAlignment[2]).toEqual(byAlignment[0]);
  });
});

// --- The four cases neither original fixture exercises ---------------------
// Each is measured against real Godot 4.6.3 via the probe-project SubViewport
// + get_rect() oracle (same technique, ad hoc scenes, not committed).

describe('resortBoxContainer — fractional-remainder carry + discard/refit eviction', () => {
  // Also the new unit-hbox-container-stretch.tscn fixture's own children —
  // see the "reads the actual fixture" integration test below.
  const children = [
    child({ minSize: { x: 100, y: 0 }, hSizeFlags: HORIZONTAL, stretchRatio: 1 }),
    child({ minSize: { x: 100, y: 0 }, hSizeFlags: HORIZONTAL, stretchRatio: 3 }),
    child({ minSize: { x: 600, y: 0 }, hSizeFlags: HORIZONTAL, stretchRatio: 2 }),
  ];

  it('evicts the oversized child, then carries the fractional remainder among the survivors', () => {
    // Pass 1 (ratio_total=6, stretch_avail=1130): A=188.3(keep,188) B=565.0(keep,565)
    // C=376.7 < 600 (its own minimum) => EVICTED, stretch_avail becomes 530, ratio_total=4.
    // Pass 2 (A:B=1:3): A=530*1/4=132.5 (floor 132, error 0.5); B=530*3/4=397.5, error
    // reaches 1.0 => B gets the carried pixel: floor(397.5)+1=398.
    // Godot 4.6.3 SubViewport get_rect(): Narrow=[0,0,132,648] Wide=[143,0,398,648]
    // Oversized=[552,0,600,648] (theme_override_constants/separation = 11).
    const rects = resortBoxContainer(false, { width: 1152, height: 648 }, 11, 0, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 132, h: 648 },
      { x: 143, y: 0, w: 398, h: 648 },
      { x: 552, y: 0, w: 600, h: 648 },
    ]);
  });
});

describe('resortBoxContainer — RTL ordering + BEGIN+RTL alignment', () => {
  it('reverses placement order and (BEGIN, rtl) pushes the offset to the far edge', () => {
    // No child expands (stretch_ratio_total=0): stretch_diff = (1152-2*15) - (50+80+120) = 872.
    // ALIGNMENT_BEGIN + rtl => ofs = stretch_diff (box_container.cpp:152-156). RTL walks
    // children back-to-front: Third places first (at ofs=872), then Second, then First —
    // First (the LTR-first child) ends up at the RIGHT edge.
    // Godot 4.6.3 SubViewport get_rect() (layout_direction=RTL on the container):
    // First=[1102,0,50,648] Second=[1007,0,80,648] Third=[872,0,120,648].
    const children = [
      child({ minSize: { x: 50, y: 0 } }),
      child({ minSize: { x: 80, y: 0 } }),
      child({ minSize: { x: 120, y: 0 } }),
    ];
    const rects = resortBoxContainer(false, { width: 1152, height: 648 }, 15, 0, true, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 1102, y: 0, w: 50, h: 648 },
      { x: 1007, y: 0, w: 80, h: 648 },
      { x: 872, y: 0, w: 120, h: 648 },
    ]);
  });
});

describe('resortBoxContainer — rule 1: EXPAND without FILL claws its reserved stretch space back to its minimum', () => {
  it('an EXPAND-only child reserves stretch space in _resort, then fit_child_in_rect shrinks it to its minimum and left-positions it', () => {
    // Both EXPAND (ratio_total=2): each initially reserves 1132*1/2=566.0. The EXPAND|FILL
    // sibling keeps that width; the EXPAND-only child's fit_child_in_rect call then
    // overrides w back down to its own 80px minimum, x unchanged (no SHRINK_END/CENTER =>
    // begin-position, non-rtl => no offset) — a real clawback, not the FILL no-op case.
    // Godot 4.6.3 SubViewport get_rect(): ExpandOnly=[0,0,80,648] ExpandFill=[586,0,566,648].
    const children = [
      child({ minSize: { x: 80, y: 40 }, hSizeFlags: EXPAND, stretchRatio: 1 }),
      child({ minSize: { x: 80, y: 40 }, hSizeFlags: HORIZONTAL, stretchRatio: 1 }),
    ];
    const rects = resortBoxContainer(false, { width: 1152, height: 648 }, 20, 0, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 80, h: 648 },
      { x: 586, y: 0, w: 566, h: 648 },
    ]);
  });
});

describe('resortBoxContainer — edges', () => {
  it('returns an empty array for zero children', () => {
    expect(resortBoxContainer(false, { width: 1152, height: 648 }, 8, 0, false, [])).toEqual([]);
  });

  it('clamps a negative stretch_diff to zero when children overflow the container', () => {
    const children = [child({ minSize: { x: 700, y: 0 }, hSizeFlags: HORIZONTAL })];
    const rects = resortBoxContainer(false, { width: 500, height: 100 }, 0, 0, false, children);
    // stretch_max(500) - stretch_min(700) would be negative; clamped to 0, so the single
    // EXPAND child's whole stretch_avail is just its own minimum, and the "last one always
    // fits perfect" snap pins it to the full (undersized) container width regardless.
    expect(rects).toEqual<Rect2[]>([{ x: 0, y: 0, w: 500, h: 100 }]);
  });
});

// --- Registry adapters -------------------------------------------------------

describe('boxContainerMinimumSize', () => {
  it('main axis sums children + separation between them; cross axis is the largest child (horizontal)', () => {
    // Matches the new unit-hbox-container-stretch.tscn fixture's own container minimum,
    // measured by the same Godot oracle: MyHBoxContainer min=[822, 0].
    const sizes = [{ x: 100, y: 0 }, { x: 100, y: 0 }, { x: 600, y: 0 }];
    expect(boxContainerMinimumSize(false, 11, sizes)).toEqual({ x: 822, y: 0 });
  });

  it('main axis sums children + separation between them; cross axis is the largest child (vertical)', () => {
    // box_container.cpp:238-271, hand-worked: mainAxis = 23+23+16 = 62; crossAxis = max(29,58) = 58.
    const sizes = [{ x: 29, y: 23 }, { x: 58, y: 23 }];
    expect(boxContainerMinimumSize(true, 16, sizes)).toEqual({ x: 58, y: 62 });
  });

  it('a single child needs no separation', () => {
    expect(boxContainerMinimumSize(false, 99, [{ x: 40, y: 12 }])).toEqual({ x: 40, y: 12 });
  });

  it('no children => zero', () => {
    expect(boxContainerMinimumSize(false, 10, [])).toEqual({ x: 0, y: 0 });
  });
});

// --- End-to-end through the registry (ContainerLayoutFn/MinimumSizeFn wiring) ---

function solveNode(path: string, type: string, properties: Record<string, unknown>, children: SolveNode[] = []): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type, children: [], properties: { name, ...properties } };
  return { path, node: tscnNode, children, styleBoxes: {}, textureSize: null };
}

describe('makeBoxContainerLayout / makeBoxContainerMinimumSize — registered end-to-end via solveControlTree', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('HBoxContainer registration reproduces the stretch/carry/eviction fixture rects through the full solve', () => {
    controlSolverRegistry.registerContainerLayout('HBoxContainer', makeBoxContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HBoxContainer', makeBoxContainerMinimumSize(false));

    const root = solveNode('MyHBoxContainer', 'HBoxContainer', {
      layoutMode: 1,
      anchorsPreset: 15,
      anchorRight: 1,
      anchorBottom: 1,
      themeOverrideConstants: { separation: 11 },
    }, [
      solveNode('MyHBoxContainer/Narrow', 'Control', {
        layoutMode: 2,
        customMinimumSize: { x: 100, y: 0 },
        sizeFlagsHorizontal: HORIZONTAL,
        sizeFlagsStretchRatio: 1,
      }),
      solveNode('MyHBoxContainer/Wide', 'Control', {
        layoutMode: 2,
        customMinimumSize: { x: 100, y: 0 },
        sizeFlagsHorizontal: HORIZONTAL,
        sizeFlagsStretchRatio: 3,
      }),
      solveNode('MyHBoxContainer/Oversized', 'Control', {
        layoutMode: 2,
        customMinimumSize: { x: 600, y: 0 },
        sizeFlagsHorizontal: HORIZONTAL,
        sizeFlagsStretchRatio: 2,
      }),
    ]);

    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([root], VIEWPORT, ctx);

    expect(solved.get('MyHBoxContainer')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
    expect(solved.get('MyHBoxContainer')?.minSize).toEqual({ x: 822, y: 0 });
    expect(solved.get('MyHBoxContainer/Narrow')?.rect).toEqual({ x: 0, y: 0, w: 132, h: 648 });
    expect(solved.get('MyHBoxContainer/Wide')?.rect).toEqual({ x: 143, y: 0, w: 398, h: 648 });
    expect(solved.get('MyHBoxContainer/Oversized')?.rect).toEqual({ x: 552, y: 0, w: 600, h: 648 });
  });

  it('a Label child keeps its own SHRINK_CENTER vertical default inside a registered VBoxContainer (rule 3)', () => {
    controlSolverRegistry.registerContainerLayout('VBoxContainer', makeBoxContainerLayout(true));
    controlSolverRegistry.registerMinimumSize('VBoxContainer', makeBoxContainerMinimumSize(true));

    // sizeFlagsVertical mimics what nodes/2d/ui/label/parser.ts already bakes in for an
    // unset Label (SIZE_SHRINK_CENTER) — this test's own input, not a real Label parse,
    // per the module's font-metric/`_resort` decoupling rule.
    const root = solveNode('MyVBoxContainer', 'VBoxContainer', {
      layoutMode: 1,
      anchorsPreset: 15,
      anchorRight: 1,
      anchorBottom: 1,
      alignment: 2,
      themeOverrideConstants: { separation: 16 },
    }, [
      solveNode('MyVBoxContainer/Top', 'Label', {
        layoutMode: 2,
        customMinimumSize: { x: 0, y: 23 },
        sizeFlagsVertical: SHRINK_CENTER,
      }),
      solveNode('MyVBoxContainer/Bottom', 'Label', {
        layoutMode: 2,
        customMinimumSize: { x: 0, y: 23 },
        sizeFlagsVertical: SHRINK_CENTER,
      }),
    ]);

    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([root], VIEWPORT, ctx);

    expect(solved.get('MyVBoxContainer/Top')?.rect).toEqual({ x: 0, y: 586, w: 1152, h: 23 });
    expect(solved.get('MyVBoxContainer/Bottom')?.rect).toEqual({ x: 0, y: 625, w: 1152, h: 23 });
  });

  it('reads the actual committed unit-hbox-container-stretch.tscn fixture end-to-end', () => {
    controlSolverRegistry.registerContainerLayout('HBoxContainer', makeBoxContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HBoxContainer', makeBoxContainerMinimumSize(false));

    const content = readFileSync(resolve(fixturesDir(), 'unit-hbox-container-stretch.tscn'), 'utf8');
    const scene = new TscnParser().parse(content);

    function toSolveTree(nodes: readonly TscnNode[], parentPath: string): SolveNode[] {
      return nodes.map((n) => {
        const path = joinPath(parentPath, n.name);
        return { path, node: n, children: toSolveTree(n.children, path), styleBoxes: {}, textureSize: null };
      });
    }

    const [rootNode] = scene.nodes;
    const tree = toSolveTree(rootNode ? [rootNode] : [], '');
    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree(tree, VIEWPORT, ctx);

    expect(solved.get('Root/MyHBoxContainer/Narrow')?.rect).toEqual({ x: 0, y: 0, w: 132, h: 648 });
    expect(solved.get('Root/MyHBoxContainer/Wide')?.rect).toEqual({ x: 143, y: 0, w: 398, h: 648 });
    expect(solved.get('Root/MyHBoxContainer/Oversized')?.rect).toEqual({ x: 552, y: 0, w: 600, h: 648 });
  });
});
