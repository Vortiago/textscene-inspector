/**
 * A CSG root whose contributor reads its mesh from a `.tres`: the boolean waits for the file, so
 * the root draws only its own solid until then, and the result then carries the file's surfaces.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import { parseTresFile } from '../../parser/parsedResource';
import { fixturesDir } from '../../parser/testing/parserKit';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import { instanceAs } from '../../nodes/3d/testing/reactThreeTestInstance';
import { clearEvaluationCache } from './csgEvaluationCache';
import '../nodes/index';
import { NodeTree } from '../testing/NodeTree';
import { settleCsgEvaluation } from './testing/settleCsgEvaluation';

const MESH_PATH = 'res://two-boxes.tres';

const SCENE = `[gd_scene format=3]

[ext_resource type="ArrayMesh" path="${MESH_PATH}" id="1"]

[node name="Root" type="Node3D"]

[node name="Slab" type="CSGBox3D" parent="."]
size = Vector3(1.4, 0.3, 0.9)

[node name="Boxes" type="CSGMesh3D" parent="Slab"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.3, 0)
mesh = ExtResource("1")
`;

/** The root's drawn mesh: the one mesh that is not a contributor's invisible bounds proxy. */
function drawnMesh(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Mesh {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => instanceAs<THREE.Mesh>(m))
    .find((mesh) => mesh.visible)!;
}

async function renderScene(fake: FakeResourceLoader) {
  clearEvaluationCache();
  const scene = new TscnParser().parse(SCENE);
  const root = scene.nodes[0]!.children[0]!;
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={scene.externalResources}>
        <NodeTree node={root} path={`Root/${root.name}`} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('CSG boolean over a mesh .tres', () => {
  it('draws the root’s own solid while the file loads, then the boolean with its surfaces', async () => {
    const fake = createFakeResourceLoader();
    const renderer = await renderScene(fake);
    await settleCsgEvaluation(renderer);
    expect(Array.isArray(drawnMesh(renderer).material)).toBe(false);

    const tres = readFileSync(join(fixturesDir(), 'unit-csg-mesh-sources-two-boxes.tres'), 'utf8');
    await ReactThreeTestRenderer.act(async () => fake.resources._resolve(MESH_PATH, parseTresFile(tres)));
    await settleCsgEvaluation(renderer);
    // The slab's default surface and the file's red and green ones.
    expect((drawnMesh(renderer).material as THREE.Material[]).length).toBe(3);
  });

  it('loads the file once, through the root, not again through the contributor', async () => {
    const fake = createFakeResourceLoader();
    await settleCsgEvaluation(await renderScene(fake));
    expect(fake.resources.pinCounts.get(MESH_PATH)).toBe(1);
  });
});
