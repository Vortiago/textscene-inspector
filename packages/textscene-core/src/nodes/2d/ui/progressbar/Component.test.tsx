/**
 * `<ProgressBar>` — pins that the painter WIRES up `background`/`fill`
 * StyleBoxes and the percentage label the way `progress_bar.cpp`'s
 * `NOTIFICATION_DRAW` does. Exact fill-rect numbers are proved once in
 * `nativeSolver.test.ts`; this pins draw COUNT, ORDER and gating
 * (indeterminate skips the percentage; a zero ratio skips the fill).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { ProgressBar } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

function solveNode(properties: Record<string, unknown>): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'P',
    node: { name: 'P', type: 'ProgressBar', children: [], properties: { name: 'P', ...properties } } as TscnNode,
  };
}

const RECT = { x: 0, y: 0, w: 100, h: 20 };

describe('<ProgressBar>', () => {
  it('draws only background + percent text at value=0 (ratio 0 skips the fill)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProgressBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2); // background + "0%"
  });

  it('draws background + fill + percent text once the ratio is positive', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProgressBar {...painterEnv()} solveNode={solveNode({ value: 50 })} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(3); // background + fill + "50%"
  });

  it('positions the fill CanvasItemGroup at progressBarFillRect\'s own (x, y) — FILL_BEGIN_TO_END grows from the left', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProgressBar {...painterEnv()} solveNode={solveNode({ value: 50 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    // background's StyleBoxQuad flip-group is first; the fill's own
    // CanvasItemGroup wrapper is the next one mounted.
    const fillGroup = groups[1]!;
    expect(fillGroup.instance.position.x).toBeCloseTo(0);
    expect(fillGroup.instance.position.y).toBeCloseTo(0);
  });

  it('show_percentage = false draws no text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProgressBar {...painterEnv()} solveNode={solveNode({ value: 50, showPercentage: false })} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2); // background + fill, no text
  });

  it('indeterminate draws background + the static centred fill, and NEVER the percentage (progress_bar.cpp:109)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProgressBar
        {...painterEnv()}
        solveNode={solveNode({ indeterminate: true, showPercentage: true })}
        rect={{ x: 0, y: 0, w: 100, h: 32 }}
        renderOrder={0}
      />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2); // background + the centred fill, no text
  });

  it('forwards renderOrder to every mesh it draws', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ProgressBar {...painterEnv()} solveNode={solveNode({ value: 50 })} rect={RECT} renderOrder={9} />
    );
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      expect(mesh.instance.renderOrder).toBe(9);
    }
  });

  it('composes the walker tint into the background fill, in sRGB', async () => {
    const untinted = await ReactThreeTestRenderer.create(
      <ProgressBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const tinted = await ReactThreeTestRenderer.create(
      <ProgressBar
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    );
    const bgChannel = (r: typeof untinted) =>
      (((r.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry)
        .attributes.color as THREE.BufferAttribute).getX(0);
    expect(bgChannel(untinted)).toBeGreaterThan(0);
    expect(bgChannel(tinted)).toBeCloseTo(bgChannel(untinted) * 0.5, 6);
  });
});
