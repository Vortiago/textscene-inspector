/**
 * BoxContainer's native rect solve against literal inputs. Each expected rect is measured off
 * Godot 4.6.3 (a `SubViewport` + `get_rect()` probe) or hand-worked from the cited source, never
 * re-derived as the implementation does. Children use a synthetic `custom_minimum_size`, not a
 * Label, so a font-metric regression and a `_resort` regression never fail alike.
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
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

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

// unit-vbox-container.tscn and unit-hbox-container.tscn with synthetic minimum sizes, rects
// measured by the probe-project SubViewport + get_rect() oracle.

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

// Four cases neither fixture exercises, each measured on Godot 4.6.3 with the same SubViewport
// + get_rect() oracle in ad hoc scenes.

describe('resortBoxContainer — fractional-remainder carry + discard/refit eviction', () => {
  // Also the unit-hbox-container-stretch.tscn fixture's children, which the "reads the actual
  // fixture" integration test below reads.
  const children = [
    child({ minSize: { x: 100, y: 0 }, hSizeFlags: HORIZONTAL, stretchRatio: 1 }),
    child({ minSize: { x: 100, y: 0 }, hSizeFlags: HORIZONTAL, stretchRatio: 3 }),
    child({ minSize: { x: 600, y: 0 }, hSizeFlags: HORIZONTAL, stretchRatio: 2 }),
  ];

  it('evicts the oversized child, then carries the fractional remainder among the survivors', () => {
    // Pass 1 (ratio_total=6, stretch_avail=1130): A=188.3, B=565.0, C=376.7 < its 600 minimum, so
    // C is evicted: stretch_avail 530, ratio_total 4. Pass 2 (A:B=1:3): A=132.5 floors to 132 (error
    // 0.5), B=397.5 carries to 398. Godot 4.6.3 get_rect() (separation 11): Narrow=[0,0,132,648]
    // Wide=[143,0,398,648] Oversized=[552,0,600,648].
    const rects = resortBoxContainer(false, { width: 1152, height: 648 }, 11, 0, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 132, h: 648 },
      { x: 143, y: 0, w: 398, h: 648 },
      { x: 552, y: 0, w: 600, h: 648 },
    ]);
  });
});

describe('resortBoxContainer — float32 fractional-error accumulator (unit-vbox-container-pitch.tscn\'s ExpandColumn)', () => {
  it('three-way carry test lands on Green=213/Amber=451, not the float64 double-precision 214/452', () => {
    // Godot 4.6.3 `get_rect()`: Red [P:(0,0), S:(400,60)], Blue [P:(0,84), S:(400,106)], Green
    // [P:(0,214), S:(400,213)], Amber [P:(0,451), S:(400,90)]. Blue's 320/3 and Green's 640/3 sum in
    // float32 (box_container.cpp:114,121) to 0.9999923706054688, under the carry (:134), leaving 1px
    // free. A float64 port sums 1.0000000000000142, carries into Green (214) and shifts Amber down.
    const VERTICAL_EXPAND = 3; // Control.SIZE_FILL | SIZE_EXPAND
    const children = [
      child({ minSize: { x: 0, y: 60 } }),
      child({ minSize: { x: 0, y: 40 }, vSizeFlags: VERTICAL_EXPAND, stretchRatio: 1 }),
      child({ minSize: { x: 0, y: 40 }, vSizeFlags: VERTICAL_EXPAND, stretchRatio: 2 }),
      child({ minSize: { x: 0, y: 90 } }),
    ];
    const rects = resortBoxContainer(true, { width: 400, height: 542 }, 24, 0, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 400, h: 60 },
      { x: 0, y: 84, w: 400, h: 106 },
      { x: 0, y: 214, w: 400, h: 213 },
      { x: 0, y: 451, w: 400, h: 90 },
    ]);
  });
});

describe('resortBoxContainer — Size2i truncation of the container size and each child\'s minimum, ahead of the stretch arithmetic', () => {
  it('truncates the fractional container height AND both fractional child minimums before dividing the stretch range', () => {
    // Godot 4.6.3 `get_rect()`, VBox 400.9x541.3, separation 24, two FILL|EXPAND children with
    // minimums 60.6 and 40.4: A [P:(0,0), S:(400,258)], B [P:(0,282), S:(400,259)]. `Size2i` truncates
    // 541.3 to 541 (box_container.cpp:47) and the minimums to 60 and 40 (:60), so stretch_avail is
    // 517 and 258.5 each floors A to 258 and carries B to 259. Full precision gives other shares.
    const children = [
      child({ minSize: { x: 0, y: 60.6 }, vSizeFlags: 3, stretchRatio: 1 }),
      child({ minSize: { x: 0, y: 40.4 }, vSizeFlags: 3, stretchRatio: 1 }),
    ];
    const rects = resortBoxContainer(true, { width: 400.9, height: 541.3 }, 24, 0, false, children);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 400, h: 258 },
      { x: 0, y: 282, w: 400, h: 259 },
    ]);
  });
});

describe('resortBoxContainer — RTL ordering + BEGIN+RTL alignment', () => {
  it('reverses placement order and (BEGIN, rtl) pushes the offset to the far edge', () => {
    // No child expands: stretch_diff = (1152-2*15) - (50+80+120) = 872, and ALIGNMENT_BEGIN + rtl
    // gives ofs = stretch_diff (box_container.cpp:152-156). RTL places Third first, so First ends at
    // the right edge. Godot 4.6.3 get_rect() (RTL container): First=[1102,0,50,648]
    // Second=[1007,0,80,648] Third=[872,0,120,648].
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
    // Both EXPAND (ratio_total=2) reserve 1132*1/2=566.0 each. fit_child_in_rect shrinks the
    // EXPAND-only child to its 80px minimum at the band's start: a real clawback, not the FILL
    // no-op. Godot 4.6.3 get_rect(): ExpandOnly=[0,0,80,648] ExpandFill=[586,0,566,648].
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

describe('boxContainerMinimumSize', () => {
  it('main axis sums children + separation between them; cross axis is the largest child (horizontal)', () => {
    // Matches the unit-hbox-container-stretch.tscn fixture's container minimum,
    // measured by the same Godot oracle: MyHBoxContainer min=[822, 0].
    const sizes = [{ x: 100, y: 0 }, { x: 100, y: 0 }, { x: 600, y: 0 }];
    expect(boxContainerMinimumSize(false, 11, sizes)).toEqual({ x: 822, y: 0 });
  });

  it('main axis sums children + separation between them; cross axis is the largest child (vertical)', () => {
    // box_container.cpp:238-271, hand-worked: mainAxis = 23+23+16 = 62; crossAxis = max(29,58) = 58.
    const sizes = [{ x: 29, y: 23 }, { x: 58, y: 23 }];
    expect(boxContainerMinimumSize(true, 16, sizes)).toEqual({ x: 58, y: 62 });
  });

  it('TRUNCATES each child minimum before accumulating (Size2i, box_container.cpp)', () => {
    // `Size2i size = c->get_combined_minimum_size()` narrows before the sum, so
    // two 10.7px children come to 10 + 10 + separation, not 21.4 + separation.
    // Every real text minimum is fractional, so this is the common case.
    expect(boxContainerMinimumSize(true, 4, [{ x: 0, y: 10.7 }, { x: 0, y: 10.7 }])).toEqual({
      x: 0,
      y: 24,
    });
    // The cross axis narrows too: max(9.9, 3) truncates to 9, not 9.9.
    expect(boxContainerMinimumSize(true, 0, [{ x: 9.9, y: 0 }])).toEqual({ x: 9, y: 0 });
  });

  it('a single child needs no separation', () => {
    expect(boxContainerMinimumSize(false, 99, [{ x: 40, y: 12 }])).toEqual({ x: 40, y: 12 });
  });

  it('no children => zero', () => {
    expect(boxContainerMinimumSize(false, 10, [])).toEqual({ x: 0, y: 0 });
  });
});

function solveNode(path: string, type: string, properties: Record<string, unknown>, children: SolveNode[] = []): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type, children: [], properties: { name, ...properties } };
  // A local theme_override_constants/* reaches a solver through
  // `n.constants` (the walker folds it in unconditionally), not `node.properties`.
  const constants = (properties as { themeOverrideConstants?: SolveNode['constants'] }).themeOverrideConstants ?? {};
  return { ...emptySolveNode(), path, node: tscnNode, children, constants };
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

  it('never lays out a child promoted past a Node2D, nor counts it toward the container minimum', () => {
    // `Container::as_sortable_control` casts the direct child (container.cpp:143-155), and `_resort`
    // and `get_minimum_size` hand it only `get_child(i)` (box_container.cpp:58, :198). A Control
    // promoted past a Node2D is a grandchild the Container never sees, so it keeps its anchors
    // against the Node2D's zero anchorable rect (canvas_item.h:414).
    controlSolverRegistry.registerContainerLayout('HBoxContainer', makeBoxContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HBoxContainer', makeBoxContainerMinimumSize(false));

    const promoted: SolveNode = {
      ...solveNode('MyHBoxContainer/Holder/Promoted', 'Control', {
        layoutMode: 2,
        customMinimumSize: { x: 600, y: 0 },
        sizeFlagsHorizontal: HORIZONTAL,
        offsetLeft: 20,
        offsetTop: 30,
        offsetRight: 620,
        offsetBottom: 90,
      }),
      skippedAncestors: {
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        modulate: { r: 1, g: 1, b: 1, a: 1 },
        z: [],
      },
    };
    const root = solveNode('MyHBoxContainer', 'HBoxContainer', {
      layoutMode: 1,
      anchorsPreset: 15,
      anchorRight: 1,
      anchorBottom: 1,
      themeOverrideConstants: { separation: 11 },
    }, [
      solveNode('MyHBoxContainer/Direct', 'Control', {
        layoutMode: 2,
        customMinimumSize: { x: 100, y: 0 },
        sizeFlagsHorizontal: HORIZONTAL,
      }),
      promoted,
    ]);

    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([root], VIEWPORT, ctx);

    // One sortable child, so no separation and no 600 in the minimum.
    expect(solved.get('MyHBoxContainer')?.minSize).toEqual({ x: 100, y: 0 });
    expect(solved.get('MyHBoxContainer/Direct')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
    // Its own offsets against a zero parent rect, floored at its 600 minimum.
    expect(solved.get('MyHBoxContainer/Holder/Promoted')?.rect).toEqual({ x: 20, y: 30, w: 600, h: 60 });
  });

  it('a Label child keeps its own SHRINK_CENTER vertical default inside a registered VBoxContainer (rule 3)', () => {
    controlSolverRegistry.registerContainerLayout('VBoxContainer', makeBoxContainerLayout(true));
    controlSolverRegistry.registerMinimumSize('VBoxContainer', makeBoxContainerMinimumSize(true));

    // sizeFlagsVertical mimics what nodes/2d/ui/label/parser.ts already bakes in for an
    // unset Label (SIZE_SHRINK_CENTER): a synthetic input, not a Label parse, to keep font
    // metrics out of a `_resort` test.
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
        // A local theme_override_constants/* reaches a solver through
        // `n.constants` (the walker folds it in unconditionally), not `node.properties`.
        const constants =
          (n.properties as { themeOverrideConstants?: SolveNode['constants'] }).themeOverrideConstants ?? {};
        return { ...emptySolveNode(), path, node: n, children: toSolveTree(n.children, path), constants };
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

describe('makeBoxContainerLayout — the container\'s own layout direction reaches _resort', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('an RTL HBoxContainer mirrors its own rect and lays its children out from the far edge', () => {
    // `_resort` reads `is_layout_rtl()` once (`box_container.cpp:48`): ALIGNMENT_BEGIN takes the far
    // offset (`:154-155`) and placement walks back to front (`:187-195`). Children 60/120/180 at
    // separation 4 in 400: stretch_diff 32, so C, B, A place at 32, 216 and 340. The box mirrors
    // through `Control::_size_changed` (`control.cpp:1785-1787`): 1152 - 64 - 400 = 688.
    controlSolverRegistry.registerContainerLayout('HBoxContainer', makeBoxContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HBoxContainer', makeBoxContainerMinimumSize(false));

    const bar = (name: string, width: number): SolveNode => ({
      ...solveNode(`Rtl/${name}`, 'ColorRect', { customMinimumSize: { x: width, y: 0 } }),
      rtl: true,
    });
    const root: SolveNode = {
      ...solveNode(
        'Rtl',
        'HBoxContainer',
        { offsetLeft: 64, offsetTop: 176, offsetRight: 464, offsetBottom: 256 },
        [bar('A', 60), bar('B', 120), bar('C', 180)]
      ),
      rtl: true,
    };

    const solved = solveControlTree([root], VIEWPORT, createSolveContext(nativeTheme(1)));
    expect(solved.get('Rtl')?.rect).toEqual({ x: 688, y: 176, w: 400, h: 80 });
    expect(solved.get('Rtl/A')?.rect).toEqual({ x: 340, y: 0, w: 60, h: 80 });
    expect(solved.get('Rtl/B')?.rect).toEqual({ x: 216, y: 0, w: 120, h: 80 });
    expect(solved.get('Rtl/C')?.rect).toEqual({ x: 32, y: 0, w: 180, h: 80 });
  });

  it('the same box LTR keeps the authored order at the near edge', () => {
    controlSolverRegistry.registerContainerLayout('HBoxContainer', makeBoxContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HBoxContainer', makeBoxContainerMinimumSize(false));

    const bar = (name: string, width: number) =>
      solveNode(`Ltr/${name}`, 'ColorRect', { customMinimumSize: { x: width, y: 0 } });
    const root = solveNode(
      'Ltr',
      'HBoxContainer',
      { offsetLeft: 64, offsetTop: 48, offsetRight: 464, offsetBottom: 128 },
      [bar('A', 60), bar('B', 120), bar('C', 180)]
    );

    const solved = solveControlTree([root], VIEWPORT, createSolveContext(nativeTheme(1)));
    expect(solved.get('Ltr')?.rect).toEqual({ x: 64, y: 48, w: 400, h: 80 });
    expect(solved.get('Ltr/A')?.rect).toEqual({ x: 0, y: 0, w: 60, h: 80 });
    expect(solved.get('Ltr/B')?.rect).toEqual({ x: 64, y: 0, w: 120, h: 80 });
    expect(solved.get('Ltr/C')?.rect).toEqual({ x: 188, y: 0, w: 180, h: 80 });
  });
});
