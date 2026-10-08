import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useMemo, useRef } from 'react';
import type { TscnNode } from '../../parser/types';
import type { NodeComponentProps } from '../NodeComponentRegistry';
import { manualCameraAt, renderScene } from '../testing/renderScene';
import { drawsColour } from '../testing/threePasses';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../../nodes/3d/geometryinstance3d/types';
import { NO_VISIBILITY_RANGE, type VisibilityRange } from '../../godot/visibilityRange';
import { useGeometryInstance, withGeometryInstance } from './geometryInstance';
import { boxPlacement } from './placements';

/** A drawer that places its instance at its mesh, a unit box 5 units along +Z, drawn through its hooks. */
function BoxDrawer({ children }: NodeComponentProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const placement = useMemo(() => boxPlacement(meshRef, UNIT_BOX), []);
  const shadow = useGeometryInstance(placement);
  return (
    <mesh
      ref={meshRef}
      name="drawn"
      position={[0, 0, 5]}
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
    >
      <boxGeometry />
      {children}
    </mesh>
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

async function drawnFrom(distance: number, range: Partial<VisibilityRange>): Promise<THREE.Mesh> {
  const camera = manualCameraAt({ x: 0, y: 0, z: distance });
  const renderer = await ReactThreeTestRenderer.create(<Box node={boxNode(range)} />, { camera });
  await renderScene(renderer, camera);
  return renderer.scene.findByProps({ name: 'drawn' }).instance as THREE.Mesh;
}

describe('withGeometryInstance', () => {
  it('culls its drawer past the node’s range', async () => {
    expect(drawsColour(await drawnFrom(16, { end: 10 }))).toBe(false);
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
    expect(drawsColour(await drawnFrom(11, { end: 10 }))).toBe(true);
  });

  it('throws outside withGeometryInstance (error case)', async () => {
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mount = ReactThreeTestRenderer.create(<BoxDrawer node={boxNode({})} />);
    await expect(mount).rejects.toThrow('expected a GeometryInstance3D drawer inside withGeometryInstance');
    onError.mockRestore();
  });

  it('draws the instance again once it is back in range (edge case)', async () => {
    const camera = manualCameraAt({ x: 0, y: 0, z: 16 });
    const renderer = await ReactThreeTestRenderer.create(<Box node={boxNode({ end: 10 })} />, { camera });
    await renderScene(renderer, camera);
    camera.position.set(0, 0, 14);
    camera.updateMatrixWorld(true);
    await renderScene(renderer, camera);
    expect(drawsColour(renderer.scene.findByProps({ name: 'drawn' }).instance as THREE.Mesh)).toBe(true);
  });
});
