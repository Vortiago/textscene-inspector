/**
 * `<VScrollBar>`: pins that the painter draws the `scroll` track and the `grabber` of
 * `ScrollBar::_notification(NOTIFICATION_DRAW)` (`scene/gui/scroll_bar.cpp`), two meshes, with the
 * grabber placed by its own `Range` along Y. `shared/scrollBarSolver.test.ts` proves the numbers.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { VScrollBar } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

function solveNode(properties: Record<string, unknown>): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'S',
    node: { name: 'S', type: 'VScrollBar', children: [], properties: { name: 'S', ...properties } } as TscnNode,
  };
}

const RECT = { x: 0, y: 0, w: 40, h: 300 };
const AREA_SIZE = 300 - 8; // barLength minus the grabber's minimum length (2*contentMargin at scale 1).
// `styleBoxFlatGeometry.ts` grows the drawn quad by `aaSize/2` (0.5px) past each edge
// for the anti-aliasing feather, so a raw bounding box is 1px larger on each axis.
const AA_FEATHER = 1;

/**
 * A `<StyleBoxQuad>`'s outer `CanvasItemGroup`. Its mesh sits in an inner flip-`<group>`
 * (`scale={[1,-1,1]}`, no position), so the group carrying the offset is the one before it.
 */
function chromePartGroup(groups: readonly { instance: THREE.Object3D }[], fromEnd: number): THREE.Object3D {
  return groups[groups.length - 1 - fromEnd]!.instance;
}

/** A `<StyleBoxQuad>` mesh's own LOCAL geometry width/height, minus the AA feather (see `AA_FEATHER`). */
function meshSize(mesh: THREE.Mesh): { w: number; h: number } {
  const geom = mesh.geometry as THREE.BufferGeometry;
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  return { w: box.max.x - box.min.x - AA_FEATHER, h: box.max.y - box.min.y - AA_FEATHER };
}

describe('<VScrollBar>', () => {
  it('draws exactly two meshes (track, grabber)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('puts the grabber flush TOP at value=min_value (default properties), sized to its own minimum (page=0)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = chromePartGroup(groups, 1);
    expect(grabberGroup.position.y).toBeCloseTo(0);

    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    const size = meshSize(grabberMesh);
    expect(size.w).toBeCloseTo(40, 6);
    expect(size.h).toBeCloseTo(8, 6);
  });

  it('offsets the grabber to the far end at value=max_value — bottom edge === rect height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({ value: 100 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = chromePartGroup(groups, 1);
    // Godot Y grows down, and the walker converts to three's +Y-up with `-y`, so a
    // grabber offset by AREA_SIZE downward lands at world y = -AREA_SIZE.
    expect(grabberGroup.position.y).toBeCloseTo(-AREA_SIZE);
  });

  it('offsets the grabber to the midpoint at value=50 (of the default 0..100 range)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({ value: 50 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = chromePartGroup(groups, 1);
    expect(grabberGroup.position.y).toBeCloseTo(-AREA_SIZE * 0.5);
  });

  it('fills the whole bar when page covers the whole range (page = max_value - min_value)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({ page: 100 })} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    expect(meshSize(grabberMesh).h).toBeCloseTo(300, 6);
  });

  it('shrinks to the grabber minimum when page=0 (the default)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    expect(meshSize(grabberMesh).h).toBeCloseTo(8, 6);
  });

  it('forwards renderOrder to every mesh it draws', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={7} />
    );
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      expect(mesh.instance.renderOrder).toBe(7);
    }
  });

  it('draws both parts through the walker-composed tint', async () => {
    const untinted = await ReactThreeTestRenderer.create(
      <VScrollBar {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const tinted = await ReactThreeTestRenderer.create(
      <VScrollBar
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
