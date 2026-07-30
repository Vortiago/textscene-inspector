import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseParallaxLayer } from './parser';
import { ParallaxLayer } from './Component';

function layerNode(properties: Record<string, string> = {}): TscnNode {
  return {
    name: 'MyParallaxLayer',
    type: 'ParallaxLayer',
    children: [],
    properties: parseParallaxLayer(
      { type: 'node', attributes: { type: 'ParallaxLayer', name: 'MyParallaxLayer' } },
      properties
    ),
  };
}

const baseNode = layerNode();

describe('<ParallaxLayer>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ParallaxLayer node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParallaxLayer node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </ParallaxLayer>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('keeps its authored transform when no ParallaxBackground poses it', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParallaxLayer node={layerNode({ position: 'Vector2(40, 160)', scale: 'Vector2(2, 2)' })}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </ParallaxLayer>
    );
    const scene = renderer.scene.instance;
    scene.updateMatrixWorld(true);
    const world = new THREE.Vector3().setFromMatrixPosition(
      scene.getObjectByName('child')!.matrixWorld
    );
    expect(world.x).toBe(40);
    expect(world.y).toBe(-160);
  });

  it('draws one instance per mirrored offset, the un-mirrored copy last', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParallaxLayer node={layerNode({ motion_mirroring: 'Vector2(200, 0)' })}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </ParallaxLayer>
    );
    const scene = renderer.scene.instance;
    scene.updateMatrixWorld(true);
    const copies = scene.children
      .flatMap((child) => {
        const found: THREE.Object3D[] = [];
        child.traverse((object) => {
          if (object.name === 'child') found.push(object);
        });
        return found;
      })
      .map((object) => new THREE.Vector3().setFromMatrixPosition(object.matrixWorld).x);
    expect(copies).toEqual([200, 0]);
  });

  it('draws a single instance when motion_mirroring is zero', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ParallaxLayer node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </ParallaxLayer>
    );
    let count = 0;
    renderer.scene.instance.traverse((object) => {
      if (object.name === 'child') count++;
    });
    expect(count).toBe(1);
  });
});
