/**
 * The terminal rung of the CSG degradation ladder: with the library unloadable, every contributor
 * un-prunes and draws itself. A file of its own, so the failed import and an empty evaluation
 * cache belong to this module graph alone.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import '../nodes/index';
import { NodeTree } from '../testing/NodeTree';
import { settleCsgEvaluation } from './testing/settleCsgEvaluation';

vi.mock('three-bvh-csg', () => {
  throw new Error('chunk failed to load');
});

const SUBTRACTION = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)

[node name="Hole" type="CSGSphere3D" parent="Block"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)
operation = 2
radius = 1.25
`;

describe('CSG boolean without its library', () => {
  it('degrades to base primitives when the CSG library cannot load', async () => {
    const scene = new TscnParser().parse(SUBTRACTION);
    const root = scene.nodes[0]!.children[0]!;
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={scene.internalResources}>
        <NodeTree node={root} path={`Root/${root.name}`} />
      </SceneResourcesProvider>
    );
    await settleCsgEvaluation(renderer);

    // Both solids drawn again rather than one merged result, or nothing at all.
    const drawn = renderer.scene.findAllByType('Mesh').filter((m) => (m.instance as THREE.Mesh).visible);
    expect(drawn).toHaveLength(2);
  });
});
