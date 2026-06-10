import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CSGCylinder3D } from './Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnNode } from '../../../../parser/types';
import type { CSGCylinder3DProperties } from './types';

function makeNode(props: Partial<CSGCylinder3DProperties>): TscnNode {
  const properties: CSGCylinder3DProperties = {
    name: 'Cyl',
    radius: 0.25,
    height: 0.8,
    sides: 8,
    cone: false,
    ...props,
  };
  return { name: properties.name, type: 'CSGCylinder3D', children: [], properties };
}

async function geometryOf(node: TscnNode) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[]}>
      <CSGCylinder3D node={node} />
    </SceneResourcesProvider>
  );
  return renderer.scene.findByType('Mesh').instance.geometry as THREE.CylinderGeometry & {
    parameters: { radiusTop: number; radiusBottom: number; height: number; radialSegments: number };
  };
}

describe('<CSGCylinder3D>', () => {
  it('renders a CylinderGeometry with equal top/bottom radius and the right height/sides', async () => {
    const geom = await geometryOf(makeNode({ radius: 0.25, height: 0.8, sides: 8 }));
    expect(geom.parameters.radiusTop).toBe(0.25);
    expect(geom.parameters.radiusBottom).toBe(0.25);
    expect(geom.parameters.height).toBe(0.8);
    expect(geom.parameters.radialSegments).toBe(8);
  });

  it('collapses the top radius to 0 when cone=true', async () => {
    const geom = await geometryOf(makeNode({ radius: 0.5, cone: true }));
    expect(geom.parameters.radiusTop).toBe(0);
    expect(geom.parameters.radiusBottom).toBe(0.5);
  });
});
