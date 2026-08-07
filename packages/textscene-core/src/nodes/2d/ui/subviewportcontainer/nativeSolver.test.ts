/**
 * SubViewportContainer's native minimum size — the port of
 * `SubViewportContainer::get_minimum_size`
 * (`scene/gui/subviewport_container.cpp`).
 *
 * Two layers, deliberately:
 *
 * 1. The function in isolation, driven with hand-built `SolveNode`s whose RAW
 *    `node.children` carry the sub-viewports. That is the only place they
 *    exist — `buildSolveTree` strips a viewport boundary out of `SolveNode.
 *    children` — so a test that seeded `children` instead would pass against
 *    an implementation that reads the wrong list and measures nothing.
 * 2. The whole solve over `scenes/fixtures/unit-sub-viewport-container-
 *    centred.tscn`, asserting the absolute rect Godot 4.6.3 draws the surface
 *    at. A minimum size that never reaches a parent CONSUMING it is
 *    indistinguishable from no minimum size at all, and that consumption is
 *    the fault this whole slice exists to pin.
 *
 * Every expected number is either the Godot source formula (cited inline) or a
 * pixel measured off `pnpm ref:godot <fixture> --mode 2d`, never re-derived
 * the way the implementation derives it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderHook } from '@testing-library/react';
import type { TscnNode } from '../../../../parser/types';
import { TscnParser } from '../../../../parser/TscnParser';
import { fixturesDir } from '../../../../parser/testing/parserKit';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  createSolveContext,
  solveControlTree,
  type SolvedControl,
} from '../../../../r3f/controls/native/controlRectSolver';
import { useBuildSolveTree } from '../../../../r3f/controls/native/buildSolveTree';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SubViewportContainerProperties } from './types';
import { subViewportContainerMinimumSize } from './nativeSolver';

// Registers every Control painter AND every solver — the fixture solve below
// needs CenterContainer's layout as much as this slice's own minimum size.
import '../../../../r3f/controls/index';

function subViewport(name: string, size?: { x: number; y: number }): TscnNode {
  return {
    name,
    type: 'SubViewport',
    children: [],
    properties: size ? { name, size } : { name },
  };
}

function container(properties: Partial<SubViewportContainerProperties>, children: TscnNode[]): SolveNode {
  const node: TscnNode = {
    name: 'Booth',
    type: 'SubViewportContainer',
    children,
    properties: { name: 'Booth', ...properties } as TscnNode['properties'],
  };
  return { ...emptySolveNode(), path: 'Booth', node };
}

const ctx = () => createSolveContext(nativeTheme(1));

describe('subViewportContainerMinimumSize (scene/gui/subviewport_container.cpp::SubViewportContainer::get_minimum_size)', () => {
  it("takes the sub-viewport's own authored size", () => {
    const size = subViewportContainerMinimumSize(
      container({}, [subViewport('SubViewport', { x: 300, y: 180 })]),
      ctx()
    );
    expect(size).toEqual({ x: 300, y: 180 });
  });

  it('takes the componentwise max over several sub-viewports (`ms = ms.max(minsize)`)', () => {
    const size = subViewportContainerMinimumSize(
      container({}, [
        subViewport('Wide', { x: 400, y: 100 }),
        subViewport('Tall', { x: 120, y: 260 }),
      ]),
      ctx()
    );
    expect(size).toEqual({ x: 400, y: 260 });
  });

  it('returns (0, 0) with `stretch`, before looking at any child (the early return)', () => {
    const size = subViewportContainerMinimumSize(
      container({ stretch: true }, [subViewport('SubViewport', { x: 300, y: 180 })]),
      ctx()
    );
    expect(size).toEqual({ x: 0, y: 0 });
  });

  it("ignores stretch_shrink — it enters recalc_force_viewport_sizes, never get_minimum_size", () => {
    const size = subViewportContainerMinimumSize(
      container({ stretch_shrink: 4 }, [subViewport('SubViewport', { x: 300, y: 180 })]),
      ctx()
    );
    expect(size).toEqual({ x: 300, y: 180 });
  });

  it("falls back to Viewport's own default size when the sub-viewport authors none", () => {
    // `scene/main/viewport.h`: `Size2i size = Size2i(512, 512)`.
    const size = subViewportContainerMinimumSize(container({}, [subViewport('SubViewport')]), ctx());
    expect(size).toEqual({ x: 512, y: 512 });
  });

  it('skips children that are not SubViewports (`Object::cast_to<SubViewport>` returning null)', () => {
    const decoy: TscnNode = {
      name: 'Decoy',
      type: 'ColorRect',
      children: [],
      properties: { name: 'Decoy', size: { x: 900, y: 900 } },
    };
    const size = subViewportContainerMinimumSize(
      container({}, [decoy, subViewport('SubViewport', { x: 300, y: 180 })]),
      ctx()
    );
    expect(size).toEqual({ x: 300, y: 180 });
  });

  it('is (0, 0) with no children at all', () => {
    expect(subViewportContainerMinimumSize(container({}, []), ctx())).toEqual({ x: 0, y: 0 });
  });
});

/**
 * The minimum size reaching a rect, through the same `solveControlTree`
 * the walker runs.
 *
 * Expected pixels measured through Godot 4.6.3 on
 * `scenes/fixtures/unit-sub-viewport-container-centred.tscn` at the 1152x648
 * project viewport (`pnpm ref:godot … --mode 2d`): the orange surface spans
 * x 350..649, y 230..409, i.e. a 300x180 rect at (350, 230); the green mark at
 * the sub-viewport's right edge spans x 610..639, y 240..269.
 */
describe('a CenterContainer places a SubViewportContainer at its minimum size', () => {
  const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
  const BOOTH = 'Root/Centre/Booth';

  function solveFixture(): ReadonlyMap<string, SolvedControl> {
    const source = readFileSync(resolve(fixturesDir(), 'unit-sub-viewport-container-centred.tscn'), 'utf8');
    const scene = new TscnParser().parse(source);
    const { result } = renderHook(() =>
      useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources)
    );
    return solveControlTree(result.current.tree, VIEWPORT, createSolveContext(nativeTheme(1)));
  }

  it('puts the surface at (350, 230) 300x180, not at the container centre', () => {
    const solved = solveFixture();
    const centre = solved.get('Root/Centre')?.rect;
    const booth = solved.get(BOOTH)?.rect;

    expect(centre).toEqual({ x: 100, y: 80, w: 800, h: 480 });
    // Parent-relative: 350 - 100, 230 - 80. A zero minimum size would leave
    // (400, 240) here — the container's own half-extent, which is exactly the
    // half-of-the-sub-viewport displacement this fixture exists to catch.
    expect(booth).toEqual({ x: 250, y: 150, w: 300, h: 180 });
  });

  /**
   * The other side of the same coin, and the reason every pre-existing
   * SubViewportContainer fixture is blind to the minimum size: an anchored
   * Control's rect comes from `Control::_size_changed`'s edge solve, and the
   * minimum size only enters as a FLOOR (`if (minimum_size.width >
   * new_size_cache.width)`). An authored 300x200 already exceeds the 200x150
   * this container reports, so the floor is inert and the rect is the
   * authored one either way.
   */
  it('leaves an offset-pinned container exactly where its own offsets put it', () => {
    const source = readFileSync(resolve(fixturesDir(), 'unit-sub-viewport-container.tscn'), 'utf8');
    const scene = new TscnParser().parse(source);
    const { result } = renderHook(() =>
      useBuildSolveTree(scene.nodes, scene.externalResources, scene.internalResources)
    );
    const solved = solveControlTree(result.current.tree, VIEWPORT, createSolveContext(nativeTheme(1)));

    expect(solved.get('Root/Booth')?.rect).toEqual({ x: 100, y: 80, w: 300, h: 200 });
  });
});
