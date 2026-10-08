import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useMemo, useRef } from 'react';
import type { TscnNode } from '../../parser/types';
import type { NodeComponentProps } from '../NodeComponentRegistry';
import { isRendered, manualCameraAt, renderScene } from '../testing/renderScene';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../../nodes/3d/geometryinstance3d/types';
import { NO_VISIBILITY_RANGE, type VisibilityRange } from '../../godot/visibilityRange';
import { isGeometryInstanceComponent, useGeometryInstance, withGeometryInstance } from './geometryInstance';
import { boxPlacement } from './placements';

/** A drawer that places its instance at its group, a unit box 5 units along +Z, and hides the group when culled. */
function BoxDrawer({ children }: NodeComponentProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const placement = useMemo(() => boxPlacement(groupRef, UNIT_BOX), []);
  const { hideWhenCulled } = useGeometryInstance(placement);
  return (
    <group
      ref={(group) => {
        groupRef.current = group;
        hideWhenCulled(group);
      }}
      name="drawn"
      position={[0, 0, 5]}
    >
      {children}
    </group>
  );
}

const UNIT_BOX = { position: { x: -0.5, y: -0.5, z: -0.5 }, size: { x: 1, y: 1, z: 1 } };

const Box = withGeometryInstance(BoxDrawer);

function boxNode(range: Partial<VisibilityRange>): TscnNode {
  const properties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'Box',
    visibilityRange: { ...NO_VISIBILITY_RANGE, ...range },
  };
  return { name: 'Box', type: 'Label3D', rawProperties: {}, children: [], properties };
}

async function drawnFrom(distance: number, range: Partial<VisibilityRange>): Promise<THREE.Object3D> {
  const camera = manualCameraAt({ x: 0, y: 0, z: distance });
  const renderer = await ReactThreeTestRenderer.create(<Box node={boxNode(range)} />, { camera });
  await renderScene(renderer, camera);
  return renderer.scene.findByProps({ name: 'drawn' }).instance as THREE.Object3D;
}

describe('withGeometryInstance', () => {
  it('culls its drawer past the node’s range', async () => {
    expect(isRendered(await drawnFrom(16, { end: 10 }))).toBe(false);
  });

  it('leaves the scene cull once it unmounts (error case)', async () => {
    const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
    const renderer = await ReactThreeTestRenderer.create(<Box node={boxNode({ end: 10 })} />, { camera });
    const scene = renderer.scene.instance as THREE.Scene;
    await renderer.unmount();
    expect(scene.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
  });

  it('gives the nodes it renders as children no scope of its own (edge case)', async () => {
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Child = () => {
      useGeometryInstance(boxPlacement({ current: null }, null));
      return null;
    };
    const mount = ReactThreeTestRenderer.create(
      <Box node={boxNode({})}>
        <Child />
      </Box>
    );
    await expect(mount).rejects.toThrow('expected a GeometryInstance3D drawer inside withGeometryInstance');
    onError.mockRestore();
  });
});

describe('useGeometryInstance', () => {
  it('measures the instance where its drawer places it, not at the origin', async () => {
    expect(isRendered(await drawnFrom(11, { end: 10 }))).toBe(true);
  });

  it('throws outside withGeometryInstance (error case)', async () => {
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mount = ReactThreeTestRenderer.create(<BoxDrawer node={boxNode({})} />);
    await expect(mount).rejects.toThrow('expected a GeometryInstance3D drawer inside withGeometryInstance');
    onError.mockRestore();
  });

  it('shows a hidden object again once the instance is back in range (edge case)', async () => {
    const camera = manualCameraAt({ x: 0, y: 0, z: 16 });
    const renderer = await ReactThreeTestRenderer.create(<Box node={boxNode({ end: 10 })} />, { camera });
    await renderScene(renderer, camera);
    camera.position.set(0, 0, 14);
    camera.updateMatrixWorld(true);
    await renderScene(renderer, camera);
    expect(isRendered(renderer.scene.findByProps({ name: 'drawn' }).instance as THREE.Object3D)).toBe(true);
  });
});

describe('isGeometryInstanceComponent', () => {
  it('knows a component withGeometryInstance made', () => {
    expect(isGeometryInstanceComponent(Box)).toBe(true);
  });

  it('refuses the drawer it wraps (error case)', () => {
    expect(isGeometryInstanceComponent(BoxDrawer)).toBe(false);
  });

  it('tells two components of one drawer apart from the drawer (edge case)', () => {
    expect(isGeometryInstanceComponent(withGeometryInstance(BoxDrawer))).toBe(true);
  });
});
