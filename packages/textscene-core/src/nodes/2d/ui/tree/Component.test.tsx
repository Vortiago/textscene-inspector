/**
 * `<Tree>` render contract: the panel StyleBox, and blank-titled header cells when
 * `column_titles_visible`. Structure only: pixels are `pnpm ref:godot`'s job.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { Tree } from './Component';
import type { TreeProperties } from './types';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

function solveNode(properties: Partial<TreeProperties> = {}, rtl = false): SolveNode {
  const node: TscnNode = {
    name: 'MyTree',
    type: 'Tree',
    children: [],
    properties: { name: 'MyTree', ...properties } as TreeProperties,
  };
  return { ...emptySolveNode(), path: 'MyTree', node, rtl };
}

function findFillColor(mesh: THREE.Mesh): { r: number; g: number; b: number; a: number } {
  const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < color.count; i++) {
    if (color.getX(i) > 0.0001) {
      return { r: color.getX(i), g: color.getY(i), b: color.getZ(i), a: color.getW(i) };
    }
  }
  throw new Error('no fill vertex found');
}

describe('<Tree> — panel', () => {
  it('draws exactly one chrome mesh for a Tree with column_titles_visible unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes).toHaveLength(1);
    const fill = findFillColor(meshes[0]!);
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6).
    expect(fill.r).toBeCloseTo(0.1, 5);
    expect(fill.a).toBeCloseTo(0.6, 5);
  });

  it('forwards renderOrder to the panel mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={6} />
    );
    expect((renderer.scene.findByType('Mesh').instance as THREE.Mesh).renderOrder).toBe(6);
  });

  it('applies the walker-composed tint to the panel fill', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    );
    const fill = findFillColor(renderer.scene.findByType('Mesh').instance as THREE.Mesh);
    expect(fill.r).toBeCloseTo(0.05, 4);
  });
});

describe('<Tree> — column header row', () => {
  it('draws no header cells when column_titles_visible is unset, whatever columns says', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree {...painterEnv()} solveNode={solveNode({ columns: 4 })} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws one header cell per column once column_titles_visible is set (default columns = 1)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree {...painterEnv()} solveNode={solveNode({ columnTitlesVisible: true })} rect={RECT} renderOrder={0} />
    );
    // 1 panel mesh + 1 header cell.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('draws N header cells for columns=N', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree
        {...painterEnv()}
        solveNode={solveNode({ columns: 3, columnTitlesVisible: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(4);
  });

  it('places each header cell at a distinct, increasing x offset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree
        {...painterEnv()}
        solveNode={solveNode({ columns: 3, columnTitlesVisible: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const xs = renderer.scene
      .findAllByType('Group')
      .map((g) => g.instance.position.x)
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThanOrEqual(3);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
  });

  it('draws no header cells for columns=0 (an invalid, below-floor value clamped to 1 elsewhere)', async () => {
    // The painter floors columns at 1 even for an unvalidated value, so a Tree
    // with column_titles_visible=true shows at least one header cell.
    const renderer = await ReactThreeTestRenderer.create(
      <Tree {...painterEnv()} solveNode={solveNode({ columns: 0, columnTitlesVisible: true })} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });
});

describe('<Tree> — RTL header row', () => {
  // tree.cpp:5154-5160 with rect.w 300, panel margin 4/4 and
  // `treeColumnWidthPx(292, 3, …) === 97`: LTR 4/101/198, each mirrored to
  // `300 - 97 - x`.
  async function headerXs(rtl: boolean): Promise<number[]> {
    const renderer = await ReactThreeTestRenderer.create(
      <Tree
        {...painterEnv()}
        solveNode={solveNode({ columns: 3, columnTitlesVisible: true }, rtl)}
        rect={RECT}
        renderOrder={0}
      />
    );
    return renderer.scene
      .findAllByType('Group')
      .map((g) => g.instance.position.x)
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .sort((a, b) => a - b);
  }

  // The leading 0 is the painter's own outer `<CanvasItemGroup>`, not a cell.
  it('walks the header cells from the panel left margin under LTR', async () => {
    expect(await headerXs(false)).toEqual([0, 4, 101, 198]);
  });

  it('mirrors every header cell inside the Tree own width under RTL', async () => {
    expect(await headerXs(true)).toEqual([0, 5, 102, 199]);
  });
});
