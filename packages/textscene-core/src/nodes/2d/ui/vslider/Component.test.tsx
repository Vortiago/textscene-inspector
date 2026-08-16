/**
 * `<VSlider>` — the axis-swapped twin of `hslider/Component.test.tsx`
 * (read its own doc first): same part count/order, but the grabber travels
 * BOTTOM→TOP and ticks draw the `vslider_tick` icon.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { VSlider } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { SLIDER_TICK_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

function solveNode(properties: Record<string, unknown>): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'S',
    node: { name: 'S', type: 'VSlider', children: [], properties: { name: 'S', ...properties } } as TscnNode,
  };
}

const RECT = { x: 0, y: 0, w: 40, h: 300 };

describe('<VSlider>', () => {
  it('draws exactly three meshes (track, fill, grabber) with no tick_count', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VSlider {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(3);
  });

  it('puts the grabber flush BOTTOM at value=min_value — bottom edge === rect height (axis swap)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VSlider {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = groups[groups.length - 1]!;
    // x is NOT flipped (only y is, group position = [x, -y, 0]): x = trunc(40/2) - trunc(16/2) = 12.
    // y = 300 - 0*areasize - 16 = 284; -y (three space) = -284; 284 + 16 = 300 = RECT.h.
    expect(grabberGroup.instance.position.x).toBeCloseTo(12);
    expect(grabberGroup.instance.position.y).toBeCloseTo(-284);
  });

  it('puts the grabber flush TOP at value=max_value', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VSlider {...painterEnv()} solveNode={solveNode({ value: 100 })} rect={RECT} renderOrder={0} />
    );
    const groups = renderer.scene.findAllByType('Group');
    const grabberGroup = groups[groups.length - 1]!;
    // areasize = 300 - 16 = 284; y = 300 - 1*284 - 16 = 0.
    expect(grabberGroup.instance.position.y).toBeCloseTo(0);
  });

  it('wears the vslider_tick icon (8x4), not hslider_tick (4x8)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VSlider
        {...painterEnv()}
        solveNode={solveNode({ tickCount: 3, ticksOnBorders: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // meshes: [track, fill, tick0, tick1, tick2, grabber] — pick a tick mesh (index 2).
    const tickMesh = meshes[2]!.instance as THREE.Mesh;
    const geometry = tickMesh.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(8);
    expect(geometry.parameters.height).toBe(4);
    const material = tickMesh.material as THREE.MeshBasicMaterial;
    expect((material.map!.image as HTMLImageElement).src).toBe(SLIDER_TICK_ICONS.vslider);
  });

  it('forwards renderOrder to every mesh it draws', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VSlider {...painterEnv()} solveNode={solveNode({ tickCount: 3, ticksOnBorders: true })} rect={RECT} renderOrder={9} />
    );
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      expect(mesh.instance.renderOrder).toBe(9);
    }
  });

  it('draws every part through the walker-composed tint', async () => {
    const untinted = await ReactThreeTestRenderer.create(
      <VSlider {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const tinted = await ReactThreeTestRenderer.create(
      <VSlider
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    );
    // The StyleBox parts compose in sRGB, so halving the tint halves the
    // vertex attribute the fragment shader decodes.
    const trackChannel = (r: typeof untinted) =>
      (((r.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry)
        .attributes.color as THREE.BufferAttribute).getX(0);
    expect(trackChannel(untinted)).toBeGreaterThan(0);
    expect(trackChannel(tinted)).toBeCloseTo(trackChannel(untinted) * 0.5, 6);

    // The grabber icon has no theme colour of its own, so it takes the
    // already-linear tint directly.
    const grabberChannel = (r: typeof untinted) => {
      const meshes = r.scene.findAllByType('Mesh');
      return ((meshes[meshes.length - 1]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color.r;
    };
    expect(grabberChannel(untinted)).toBeCloseTo(1, 6);
    expect(grabberChannel(tinted)).toBeCloseTo(
      new THREE.Color().setRGB(0.5, 0.5, 0.5, THREE.SRGBColorSpace).r,
      6
    );
  });
});
