/**
 * An invisible CSG contributor bounds to a point, not to its solid. `_get_brush()` skips it
 * (`modules/csg/csg_shape.cpp:469`), so its `node_aabb` stays the default empty box, which the
 * editor merges as a point at its origin. Bounds ignore `visible`, as Godot's `get_aabb()` does for
 * an invisible MeshInstance3D, so drawing nothing is not enough.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { frameSceneBounds } from '../../../r3f/frameSceneBounds';
import type { TscnNode } from '../../../parser/types';
import './csgbox3d/index.r3f';
import './csgcombiner3d/index.r3f';
import './csgsphere3d/index.r3f';

const SCENE = `[gd_scene format=3]

[node name="Root" type="CSGCombiner3D"]

[node name="Kept" type="CSGBox3D" parent="."]
size = Vector3(1, 1, 1)

[node name="Hidden" type="CSGBox3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0)
visible = false
size = Vector3(4, 4, 4)
`;

function Tree({ node, path }: { node: TscnNode; path: string }) {
  const Component = nodeComponentRegistry.get(node.type)!;
  return (
    <NodePathProvider path={path}>
      <Component node={node}>
        {node.children.map((child) => (
          <Tree key={child.name} node={child} path={`${path}/${child.name}`} />
        ))}
      </Component>
    </NodePathProvider>
  );
}

/**
 * Two visible contributions, so the root evaluates a boolean and publishes the skipped set
 * through `CsgRootMesh`, not the lone-root branch. The bounds match either way: a boolean result
 * is a subset of the union of its contributions.
 */
const COMBINING_SCENE = `[gd_scene format=3]

[node name="Root" type="CSGCombiner3D"]

[node name="Kept" type="CSGBox3D" parent="."]
size = Vector3(1, 1, 1)

[node name="Cut" type="CSGSphere3D" parent="."]
operation = 2
radius = 0.25

[node name="Hidden" type="CSGBox3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0)
visible = false
size = Vector3(4, 4, 4)
`;

async function renderScene(source: string = SCENE): Promise<THREE.Object3D> {
  const scene = new TscnParser().parse(source);
  const root = scene.nodes[0]!;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <Tree node={root} path={root.name} />
    </SceneResourcesProvider>
  );
  return renderer.scene.instance;
}

describe('an invisible CSG contributor', () => {
  it('frames the box Godot reports, not the hidden solid', async () => {
    const controls = { target: new THREE.Vector3(), update: () => {} };
    frameSceneBounds(await renderScene(), new THREE.PerspectiveCamera(70, 1, 0.1, 4000), controls);

    // `godot --emit-bounds` on this scene: position [-0.5,-0.5,-0.5], size [8.5,1,1],
    // the visible unit box plus a point at (8,0,0). Counting the hidden 4-unit solid
    // instead puts the centre at 4.75.
    expect(controls.target.x).toBeCloseTo(3.75, 5);
    expect(controls.target.y).toBeCloseTo(0, 5);
    expect(controls.target.z).toBeCloseTo(0, 5);
  });

  it('frames the same box when the root is a COMBINING one', async () => {
    // The skipped set reaches the node through CsgRootMesh's context, a separate publisher from
    // the lone root's that no other case renders.
    const controls = { target: new THREE.Vector3(), update: () => {} };
    frameSceneBounds(
      await renderScene(COMBINING_SCENE),
      new THREE.PerspectiveCamera(70, 1, 0.1, 4000),
      controls
    );

    expect(controls.target.x).toBeCloseTo(3.75, 5);
  });

  it('draws no solid for it', async () => {
    const hidden = (await renderScene()).getObjectByName('Hidden')!;

    const boxes = [] as number[];
    hidden.traverse((child) => {
      const geometry = (child as THREE.Mesh).geometry;
      if (!geometry) return;
      geometry.computeBoundingBox();
      boxes.push(geometry.boundingBox!.getSize(new THREE.Vector3()).length());
    });
    expect(boxes).toEqual([0]);
  });
});
