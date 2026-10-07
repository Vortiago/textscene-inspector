/**
 * `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`), so a CSG root draws its
 * `transparency` as a MeshInstance3D does: on the solid it draws alone and on the mesh a boolean
 * evaluates to. A contributor's own is absorbed with its solid.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CsgPrimitive, CSG_BOUNDS_PROXY } from './CsgPrimitive';
import './csgbox3d/index.r3f';
import './csgsphere3d/index.r3f';
import { parseCSGBox3D } from './csgbox3d/parser';
import { heading } from '../../../parser/testing/parserKit';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { clearEvaluationCache } from '../../../r3f/csg/csgEvaluationCache';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';
import type { CSGBox3DProperties } from './csgbox3d/types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { NodeTree } from '../../../r3f/testing/NodeTree';
import { settleCsgEvaluation } from '../../../r3f/csg/testing/settleCsgEvaluation';

/** `instanceAlpha(0.5)`: 0.5 × 255 truncated to 127. */
const HALF_TRANSPARENT_ALPHA = 127 / 255;

function parseBox(properties: Record<string, string>): CSGBox3DProperties {
  return parseCSGBox3D(heading('CSGBox3D', { name: 'Box' }), properties);
}

async function loneBoxMaterial(properties: Record<string, string>): Promise<THREE.Material> {
  const parsed = parseBox(properties);
  const node: TscnNode = { name: 'Box', type: 'CSGBox3D', children: [], properties: parsed };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={[]}>
      <CsgPrimitive node={node} properties={parsed} />
    </SceneResourcesProvider>
  );
  return (findMesh(renderer.scene) as unknown as THREE.Mesh).material as THREE.Material;
}

async function subtractionMaterial(rootProperties: string, holeProperties = ''): Promise<THREE.Material> {
  clearEvaluationCache();
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n` +
      `[node name="Block" type="CSGBox3D" parent="."]\nsize = Vector3(2, 2, 2)\n${rootProperties}\n\n` +
      `[node name="Hole" type="CSGSphere3D" parent="Block"]\n` +
      `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)\noperation = 2\nradius = 1.25\n${holeProperties}\n`
  );
  const root = scene.nodes[0]!.children[0]!;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );
  await settleCsgEvaluation(renderer);
  const evaluated = renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => m.userData?.tscnBoundsProxy !== CSG_BOUNDS_PROXY.tscnBoundsProxy);
  return evaluated!.material as THREE.Material;
}

describe('CSG transparency', () => {
  it('parses transparency off every CSG shape', () => {
    expect(parseBox({ transparency: '0.5' }).transparency).toBe(0.5);
    expect(parseBox({}).transparency).toBe(0);
  });

  it('blends a lone root at the instance alpha', async () => {
    const material = await loneBoxMaterial({ transparency: '0.5' });
    expect(material).toMatchObject({ transparent: true, depthWrite: false, opacity: HALF_TRANSPARENT_ALPHA });
  });

  it("blends a boolean's evaluated mesh at the root's instance alpha", async () => {
    const material = await subtractionMaterial('transparency = 0.5');
    expect(material).toMatchObject({ transparent: true, opacity: HALF_TRANSPARENT_ALPHA });
  });

  it("ignores a contributor's own transparency", async () => {
    const material = await subtractionMaterial('', 'transparency = 0.5');
    expect(material).toMatchObject({ transparent: false, opacity: 1 });
  });
});
