/**
 * `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`), so a CSG root honours its
 * `visibility_range_*` as a MeshInstance3D does, on the solid it draws alone and on the mesh a
 * boolean evaluates to. Driven by one scene render from 11 units.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CSG_BOUNDS_PROXY } from './CsgPrimitive';
import './csgbox3d/index.r3f';
import './csgsphere3d/index.r3f';
import { parseCSGBox3D } from './csgbox3d/parser';
import { heading } from '../../../parser/testing/parserKit';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { clearEvaluationCache } from '../../../r3f/csg/csgEvaluationCache';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { settleCsgEvaluation } from '../../../r3f/csg/testing/settleCsgEvaluation';
import { drawsColour } from '../../../r3f/testing/threePasses';
import { manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const CSGBox3D = registeredComponent('CSGBox3D');

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const CAMERA_AT_11 = { x: 0, y: 0, z: 11 };

function drawnMesh(renderer: Renderer): THREE.Mesh {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => m.userData?.tscnBoundsProxy !== CSG_BOUNDS_PROXY.tscnBoundsProxy)!;
}

async function loneBox(properties: Record<string, string>): Promise<THREE.Mesh> {
  const parsed = parseCSGBox3D(heading('CSGBox3D', { name: 'Box' }), properties);
  const node: TscnNode = {
    rawProperties: {},
    name: 'Box',
    type: 'CSGBox3D',
    children: [],
    properties: parsed,
  };
  const camera = manualCameraAt(CAMERA_AT_11);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[]}>
      <CSGBox3D node={node} />
    </SceneResourcesProvider>,
    { camera }
  );
  await renderScene(renderer, camera);
  return drawnMesh(renderer);
}

async function subtraction(rootProperties: string): Promise<THREE.Mesh> {
  clearEvaluationCache();
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n` +
      `[node name="Block" type="CSGBox3D" parent="."]\nsize = Vector3(2, 2, 2)\n${rootProperties}\n\n` +
      `[node name="Hole" type="CSGSphere3D" parent="Block"]\n` +
      `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)\noperation = 2\nradius = 1.25\n`
  );
  const root = scene.nodes[0]!.children[0]!;
  const camera = manualCameraAt(CAMERA_AT_11);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>,
    { camera }
  );
  await settleCsgEvaluation(renderer);
  await renderScene(renderer, camera);
  return drawnMesh(renderer);
}

describe('CSG visibility range', () => {
  it('draws a lone root inside its range', async () => {
    expect(drawsColour(await loneBox({ visibility_range_end: '20.0' }))).toBe(true);
  });

  it('draws nothing of a lone root past its end', async () => {
    expect(drawsColour(await loneBox({ visibility_range_end: '10.0' }))).toBe(false);
  });

  it("draws nothing of a boolean's evaluated mesh past the root's end", async () => {
    expect(drawsColour(await subtraction('visibility_range_end = 10.0'))).toBe(false);
  });
});
