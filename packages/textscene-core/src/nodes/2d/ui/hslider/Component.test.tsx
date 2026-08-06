/**
 * `<HSlider>` — pins the four parts `Slider::_notification(NOTIFICATION_DRAW)`
 * paints (`scene/gui/slider.cpp`): the `slider` track, the `grabber_area`
 * fill, painted `tick`s, and the `grabber` icon last (drawn on top). Exact
 * numbers are proved once in `shared/sliderSolver.test.ts`; this pins that the
 * painter WIRES them up — draws the right COUNT of meshes, in the right
 * draw order, with the grabber texture the `editable` state selects.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { HSlider } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { SLIDER_GRABBER_ICONS } from '../../../../r3f/controls/native/themeIcons';

function solveNode(properties: Record<string, unknown>): SolveNode {
  return {
    path: 'S',
    node: { name: 'S', type: 'HSlider', children: [], properties: { name: 'S', ...properties } } as TscnNode,
    children: [],
    styleBoxes: {},
    textureSize: null,
    fontOverrides: {},
    themeChain: [],
    projectTheme: null,
  };
}

const RECT = { x: 0, y: 0, w: 300, h: 40 };

describe('<HSlider>', () => {
  it('draws exactly three meshes (track, fill, grabber) with no tick_count', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HSlider {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(3);
  });

  it('adds one mesh per painted tick — 3 of a 5-tick_count slider (borders skipped by default)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HSlider
        {...painterEnv()}
        solveNode={solveNode({ tickCount: 5 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    // 3 (track, fill, grabber) + 3 painted ticks (index 0 and 4 are borders, skipped).
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(6);
  });

  it('puts the grabber flush LEFT at value=min_value, using the NORMAL grabber icon', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HSlider {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = groups[groups.length - 1]!;
    expect(grabberGroup.instance.position.x).toBeCloseTo(0);
    expect(grabberGroup.instance.position.y).toBeCloseTo(-12); // -(40/2 - 16/2)

    const meshes = renderer.scene.findAllByType('Mesh');
    const grabberMesh = meshes[meshes.length - 1]!;
    const geometry = (grabberMesh.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(16);
    expect(geometry.parameters.height).toBe(16);
  });

  it('puts the grabber flush RIGHT at value=max_value — right edge === rect width', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HSlider {...painterEnv()} solveNode={solveNode({ value: 100 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = groups[groups.length - 1]!;
    // areasize = 300 - 16 = 284; x = 1 * 284 = 284; 284 + 16 = 300 = RECT.w.
    expect(grabberGroup.instance.position.x).toBeCloseTo(284);
  });

  it('wears the DISABLED grabber texture when editable is false', async () => {
    const enabled = await ReactThreeTestRenderer.create(
      <HSlider {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const disabled = await ReactThreeTestRenderer.create(
      <HSlider {...painterEnv()} solveNode={solveNode({ editable: false })} rect={RECT} renderOrder={0} />
    );
    const enabledMeshes = enabled.scene.findAllByType('Mesh');
    const disabledMeshes = disabled.scene.findAllByType('Mesh');
    const enabledMap = ((enabledMeshes[enabledMeshes.length - 1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).map;
    const disabledMap = ((disabledMeshes[disabledMeshes.length - 1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).map;
    expect(enabledMap).toBeInstanceOf(THREE.Texture);
    expect(disabledMap).toBeInstanceOf(THREE.Texture);
    expect((enabledMap!.image as HTMLImageElement).src).toBe(SLIDER_GRABBER_ICONS.grabber);
    expect((disabledMap!.image as HTMLImageElement).src).toBe(SLIDER_GRABBER_ICONS.grabberDisabled);
  });

  it('forwards renderOrder to every mesh it draws', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HSlider {...painterEnv()} solveNode={solveNode({ tickCount: 3, ticksOnBorders: true })} rect={RECT} renderOrder={7} />
    );
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      expect(mesh.instance.renderOrder).toBe(7);
    }
  });
});
