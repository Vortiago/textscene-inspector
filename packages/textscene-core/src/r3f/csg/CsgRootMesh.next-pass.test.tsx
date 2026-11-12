/**
 * A CSG root whose contributor material carries a `next_pass` chain: the evaluated
 * surface draws its link as an extra mesh sharing the evaluation's geometry, in chain
 * order after the surface draw.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import '../nodes/index';
import { NodeTree } from '../testing/NodeTree';
import { settleCsgEvaluation } from './testing/settleCsgEvaluation';
import { instanceAs } from '../../nodes/3d/testing/reactThreeTestInstance';
import { nextPassRenderOrder } from '../materials/passOrder';

function scene(body: string) {
  const parsed = new TscnParser().parse(`[gd_scene format=3]\n\n${body}\n`);
  const root = parsed.nodes[0]!.children[0]!;
  return (
    <SceneResourcesProvider internalResources={parsed.internalResources}>
      <NodeTree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );
}

const CHAINED = `[sub_resource type="StandardMaterial3D" id="Red"]
albedo_color = Color(1, 0, 0, 1)
next_pass = SubResource("Blue")

[sub_resource type="StandardMaterial3D" id="Blue"]
albedo_color = Color(0, 0, 1, 1)
`;

/** Two contributors sharing the chained material: the evaluation holds one surface. */
function block(): string {
  return `[node name="Root" type="Node3D"]

[node name="Block" type="CSGCombiner3D" parent="."]

[node name="Left" type="CSGBox3D" parent="Block"]
material = SubResource("Red")

[node name="Right" type="CSGBox3D" parent="Block"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
material = SubResource("Red")
`;
}

/** The drawn meshes: the evaluated root and its chain draws, all visible. */
function drawnMeshes(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Mesh[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => instanceAs<THREE.Mesh>(m))
    .filter((mesh) => mesh.visible);
}

describe('<CsgRootMesh> next_pass chain', () => {
  it('draws the chain link of a contributor material as a second mesh of the evaluation', async () => {
    const renderer = await ReactThreeTestRenderer.create(scene(CHAINED + block()));
    await settleCsgEvaluation(renderer);

    const [own, link] = drawnMeshes(renderer);
    expect(drawnMeshes(renderer)).toHaveLength(2);
    expect(own!.geometry).toBe(link!.geometry);
    // Each link draws after its base, at its own ordinal.
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
    const linkMaterial = link!.material as THREE.MeshStandardMaterial;
    expect(linkMaterial.color.getHex()).toBe(0x0000ff);
  });
});
