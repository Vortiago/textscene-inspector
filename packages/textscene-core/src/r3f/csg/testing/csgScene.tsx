/**
 * Mounts a CSG subtree from `.tscn` node text through the real component tree, with only Node3D and
 * the CSG node types registered. Test-only: the build excludes the `testing/` directories under `src`.
 */
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeTree } from '../../testing/NodeTree';
import { instanceAs } from '../../../nodes/3d/testing/reactThreeTestInstance';
import { settleCsgEvaluation } from './settleCsgEvaluation';
import '../../../nodes/base/node3d/index.r3f';
import '../../../nodes/3d/csg/csgbox3d/index.r3f';
import '../../../nodes/3d/csg/csgcylinder3d/index.r3f';
import '../../../nodes/3d/csg/csgsphere3d/index.r3f';
import '../../../nodes/3d/csg/csgtorus3d/index.r3f';
import '../../../nodes/3d/csg/csgcombiner3d/index.r3f';
import '../../../nodes/3d/csg/csgmesh3d/index.r3f';
import '../../../nodes/3d/csg/csgpolygon3d/index.r3f';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** A 2-unit box with a sphere subtracted from one corner. */
export const SUBTRACTION = `[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)

[node name="Hole" type="CSGSphere3D" parent="Block"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)
operation = 2
radius = 1.25
`;

/**
 * Mounts the first child of the root node in `body` and waits until its evaluated result lands.
 * The root itself is never mounted, so its type needs no registration.
 */
export async function renderCsgScene(body: string): Promise<Renderer> {
  const scene = new TscnParser().parse(`[gd_scene format=3]\n\n${body}\n`);
  const root = scene.nodes[0]!.children[0]!;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );
  await settleCsgEvaluation(renderer);
  return renderer;
}

/** Every mesh the renderer draws: the contributors' bounds proxies are invisible. */
export function drawnMeshes(renderer: Renderer) {
  return renderer.scene.findAllByType('Mesh').filter((m) => instanceAs<THREE.Mesh>(m).visible);
}
