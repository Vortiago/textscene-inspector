/**
 * `<GraphEdit>` render contract — background panel + grid. Structure/tint
 * assertions only (pixels are a golden-image concern via `pnpm ref:godot`,
 * not this suite).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { GraphEdit } from './Component';
import type { GraphEditProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 100, h: 100 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function graphEdit(properties: Partial<GraphEditProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'G',
    type: 'GraphEdit',
    children: [],
    properties: { name: 'G', ...properties } as GraphEditProperties,
  };
  return { ...emptySolveNode(), path: 'G', node };
}

function chromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** Every mesh a `<ControlQuad>` (line/dot) draws — no `color` attribute, unlike a `StyleBoxQuad`. */
function quadMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color === undefined);
}

describe('<GraphEdit> (isolated painter contract)', () => {
  it('draws one chrome mesh — the background panel', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ showGrid: false })} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws grid line quads at the default LINES pattern (show_grid defaults true)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit()} rect={RECT} renderOrder={0} />
    );
    // snapping_distance defaults 20 over a 100px rect: 6 vertical + 6 horizontal lines.
    expect(quadMeshes(renderer.scene)).toHaveLength(12);
  });

  it('draws no grid quads when show_grid is false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ showGrid: false })} rect={RECT} renderOrder={0} />
    );
    expect(quadMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws dot quads (not lines) at the DOTS pattern', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphEdit {...painterEnv()} solveNode={graphEdit({ gridPattern: 1 })} rect={RECT} renderOrder={0} />
    );
    // 6x6=36 cells; i,j in {0,5} (4 pairs) are major-only, so 32 minor + 4 major = 36 dots.
    expect(quadMeshes(renderer.scene)).toHaveLength(36);
  });
});
