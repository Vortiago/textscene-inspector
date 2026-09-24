/**
 * `<HScrollBar>` draws the `scroll` track and the `grabber`
 * (`scene/gui/scroll_bar.cpp`): exactly two meshes, the grabber at its `Range`'s
 * rect. `shared/scrollBarSolver.test.ts` owns the exact numbers.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { HScrollBar } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

function solveNode(properties: Record<string, unknown>): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'S',
    node: { name: 'S', type: 'HScrollBar', children: [], properties: { name: 'S', ...properties } } as TscnNode,
  };
}

const RECT = { x: 0, y: 0, w: 300, h: 40 };
const AREA_SIZE = 300 - 8; // 292: barLength minus the grabber's along-axis minimum (2*contentMargin at scale 1).
// `styleBoxFlatGeometry.ts` grows the drawn quad by `aaSize/2` (0.5px) past
// each edge for the anti-aliasing feather ring, so a mesh's raw bounding box
// reads 1px wider/taller than the logical rect on every axis it spans.
const AA_FEATHER = 1;

/** A `<StyleBoxQuad>`'s own outer `CanvasItemGroup`: its mesh sits inside a second, inner flip-`<group>` of `StyleBoxQuad`'s own (`scale={[1,-1,1]}`, no position), so the group carrying this part's offset is the one before its own trailing flip-group. */
function chromePartGroup(groups: readonly { instance: THREE.Object3D }[], fromEnd: number): THREE.Object3D {
  return groups[groups.length - 1 - fromEnd]!.instance;
}

/** A `<StyleBoxQuad>` mesh's own local geometry width/height, minus the AA feather (see `AA_FEATHER`). */
function meshSize(mesh: THREE.Mesh): { w: number; h: number } {
  const geom = mesh.geometry as THREE.BufferGeometry;
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  return { w: box.max.x - box.min.x - AA_FEATHER, h: box.max.y - box.min.y - AA_FEATHER };
}

describe('<HScrollBar>', () => {
  it('draws exactly two meshes (track, grabber)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('puts the grabber flush LEFT at value=min_value (default properties), sized to its own minimum (page=0)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = chromePartGroup(groups, 1);
    expect(grabberGroup.position.x).toBeCloseTo(0);

    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    const size = meshSize(grabberMesh);
    expect(size.w).toBeCloseTo(8, 6);
    expect(size.h).toBeCloseTo(40, 6);
  });

  it('offsets the grabber to the far end at value=max_value — right edge === rect width', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({ value: 100 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = chromePartGroup(groups, 1);
    expect(grabberGroup.position.x).toBeCloseTo(AREA_SIZE);
  });

  it('offsets the grabber to the midpoint at value=50 (of the default 0..100 range)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({ value: 50 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = chromePartGroup(groups, 1);
    expect(grabberGroup.position.x).toBeCloseTo(AREA_SIZE * 0.5);
  });

  it('fills the whole bar when page covers the whole range (page = max_value - min_value)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({ page: 100 })} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    expect(meshSize(grabberMesh).w).toBeCloseTo(300, 6);
  });

  it('shrinks to the grabber minimum when page=0 (the default)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    expect(meshSize(grabberMesh).w).toBeCloseTo(8, 6);
  });

  it('forwards renderOrder to every mesh it draws', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={7} />
    );
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      expect(mesh.instance.renderOrder).toBe(7);
    }
  });

  it('draws both parts through the walker-composed tint', async () => {
    const untinted = await ReactThreeTestRenderer.create(
      <HScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const tinted = await ReactThreeTestRenderer.create(
      <HScrollBar
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    );
    const trackChannel = (r: typeof untinted) =>
      (((r.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry)
        .attributes.color as THREE.BufferAttribute).getX(0);
    expect(trackChannel(untinted)).toBeGreaterThan(0);
    expect(trackChannel(tinted)).toBeCloseTo(trackChannel(untinted) * 0.5, 6);
  });
});
