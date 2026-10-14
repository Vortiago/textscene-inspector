/** A CSG root draws its whole result as its own instance, so the result carries the root's `layers`. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import { clearEvaluationCache } from './csgEvaluationCache';
import '../nodes/index';
import { NodeTree } from '../testing/NodeTree';
import { settleCsgEvaluation } from './testing/settleCsgEvaluation';
import { instanceAs } from '../../nodes/3d/testing/reactThreeTestInstance';
import { visualLayersOf } from '../visualLayers';

const COMBINED = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Block" type="CSGCombiner3D" parent="."]
layers = 2

[node name="Left" type="CSGBox3D" parent="Block"]
layers = 4

[node name="Right" type="CSGBox3D" parent="Block"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
`;

describe('<CsgRootMesh> render layers', () => {
  it("carries the root's layers, not a contributor's, as Godot draws only the root", async () => {
    clearEvaluationCache();
    const parsed = new TscnParser().parse(COMBINED);
    const root = parsed.nodes[0]!.children[0]!;
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={parsed.internalResources}>
        <NodeTree node={root} path={`Root/${root.name}`} />
      </SceneResourcesProvider>
    );
    await settleCsgEvaluation(renderer);

    const drawn = renderer.scene
      .findAllByType('Mesh')
      .map((m) => instanceAs<THREE.Mesh>(m))
      .find((mesh) => mesh.visible)!;
    expect(visualLayersOf(drawn)).toBe(2);
  });
});
