/**
 * A CSG node with an empty brush, such as a CSGMesh3D with no `mesh` (`modules/csg/csg_shape.cpp:1126`)
 * or with an open one, which manifold packs as empty (`:431`), bounds to a point at its origin. Its
 * `node_aabb` stays the default empty box, which Godot merges as a point, so drawing nothing must
 * still leave that point to frame on.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { frameSceneBounds } from '../../../r3f/frameSceneBounds';
import './csgbox3d/index.r3f';
import './csgcombiner3d/index.r3f';
import './csgmesh3d/index.r3f';
import '../../base/node3d/index.r3f';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { drawnMeshes } from '../testing/reactThreeTestInstance';

const LONE_ROOT_SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Box" type="CSGBox3D" parent="."]

[node name="NoMesh" type="CSGMesh3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 4, 0)
`;

const CONTRIBUTOR_SCENE = `[gd_scene format=3]

[node name="Root" type="CSGCombiner3D"]

[node name="Box" type="CSGBox3D" parent="."]

[node name="NoMesh" type="CSGMesh3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0)
`;

/** A flat mesh is open, so its brush is empty. */
const QUAD_MESH = `[sub_resource type="QuadMesh" id="Quad"]
size = Vector2(1.5, 1.5)
`;

/** An open mesh at `offset` beside a unit box, under a root of `rootType`. */
const sceneWithOpenMesh = (rootType: string, offset: string) => `[gd_scene format=3]

${QUAD_MESH}
[node name="Root" type="${rootType}"]

[node name="Box" type="CSGBox3D" parent="."]

[node name="OpenMesh" type="CSGMesh3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${offset})
mesh = SubResource("Quad")
`;

const OPEN_LONE_ROOT_SCENE = sceneWithOpenMesh('Node3D', '0, 4, 0');
const OPEN_CONTRIBUTOR_SCENE = sceneWithOpenMesh('CSGCombiner3D', '8, 0, 0');

async function render(source: string) {
  const scene = new TscnParser().parse(source);
  const root = scene.nodes[0]!;
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={root.name} />
    </SceneResourcesProvider>
  );
}

async function framedTarget(source: string): Promise<THREE.Vector3> {
  const renderer = await render(source);
  const controls = { target: new THREE.Vector3(), update: () => {} };
  frameSceneBounds(renderer.scene.instance, new THREE.PerspectiveCamera(70, 1, 0.1, 4000), controls);
  return controls.target;
}

describe('a CSG node with an empty brush', () => {
  it('frames a point at the origin of a lone root', async () => {
    // `godot --emit-bounds`: position [-0.5,-0.5,-0.5], size [1,4.5,1], the unit box plus (0,4,0).
    const target = await framedTarget(LONE_ROOT_SCENE);

    expect(target.y).toBeCloseTo(1.75, 5);
  });

  it('frames a point at the origin of a contributor', async () => {
    // `godot --emit-bounds`: position [-0.5,-0.5,-0.5], size [8.5,1,1], the unit box plus (8,0,0).
    const target = await framedTarget(CONTRIBUTOR_SCENE);

    expect(target.x).toBeCloseTo(3.75, 5);
  });

  it('frames a point at the origin of an open lone root', async () => {
    // `godot --emit-bounds`: position [-0.5,-0.5,-0.5], size [1,4.5,1], the unit box plus (0,4,0).
    const target = await framedTarget(OPEN_LONE_ROOT_SCENE);

    expect(target.y).toBeCloseTo(1.75, 5);
  });

  it('frames a point at the origin of an open contributor', async () => {
    // `godot --emit-bounds`: position [-0.5,-0.5,-0.5], size [8.5,1,1], the unit box plus (8,0,0).
    const target = await framedTarget(OPEN_CONTRIBUTOR_SCENE);

    expect(target.x).toBeCloseTo(3.75, 5);
  });

  it('draws the box beside an open lone root, and nothing for the open mesh', async () => {
    const renderer = await render(OPEN_LONE_ROOT_SCENE);

    expect(drawnMeshes(renderer.scene)).toHaveLength(1);
  });
});
