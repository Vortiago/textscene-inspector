/**
 * MeshInstance3D hands its mesh and each `surface_material_override/N` to the surfaced mesh
 * drawer, which draws the `next_pass` chain of whichever material draws a surface. The chain
 * itself is the drawer's (`SurfacedMeshDrawer.test.tsx`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { nextPassRenderOrder } from '../../../r3f/materials/passOrder';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import { DispatchedScene } from '../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { parseTscnContent } from '../../../r3f/hooks/useParsedScene';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { ribbonScene } from '../testing/skinnedRibbon.testkit';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const MeshInstance3D = registeredComponent('MeshInstance3D');

const INTERNALS: TscnInternalResource[] = [
  { id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)', material: 'SubResource("Mat_mesh")' } },
  { id: 'Mat_mesh', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Mat_linkBlue', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
  {
    id: 'Mat_chained',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0, 0, 1)', next_pass: 'SubResource("Mat_linkBlue")' },
  },
];

function makeNode(properties: Partial<MeshInstance3DProperties>): TscnNode {
  const full: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'M',
    mesh: 'SubResource("Box_1")',
    surfaceMaterialOverrides: new Map(),
    materialOverride: undefined,
    ...properties,
  };
  return { rawProperties: {}, name: 'M', type: 'MeshInstance3D', children: [], properties: full };
}

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Every drawn THREE.Mesh, in scene-graph order. */
function meshes(renderer: Rendered): THREE.Mesh[] {
  return renderer.scene.findAllByType('Mesh').map((m) => instanceAs<THREE.Mesh>(m));
}

function albedo(mesh: THREE.Mesh): number {
  return (mesh.material as THREE.MeshStandardMaterial).color.getHex();
}

describe('MeshInstance3D next_pass', () => {
  it('draws the chain of a surface_material_override over the surface it stands on', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider internalResources={INTERNALS}>
        <MeshInstance3D
          node={makeNode({ surfaceMaterialOverrides: new Map([[0, 'SubResource("Mat_chained")']]) })}
        />
      </SceneResourcesProvider>
    );

    const [own, link] = meshes(renderer);
    expect(meshes(renderer).map(albedo)).toEqual([0xff0000, 0x0000ff]);
    expect(link!.geometry).toBe(own!.geometry);
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
  });

  /** A full scene through the dispatched harness, settled, for the file and skinned cases. */
  async function renderContent(content: string, files: Record<string, string> = {}) {
    const { sceneGraph: graph, error } = parseTscnContent(content, 'res://main.tscn');
    if (!graph) throw new Error(`expected a scene, got ${error}`);
    const renderer = await ReactThreeTestRenderer.create(
      <DispatchedScene sceneGraph={graph} loader={loaderServing(files)} />
    );
    await settleLoads();
    return renderer;
  }

  it('mounts a chain link from a file material when it lands, and shares the geometry', async () => {
    // A `.tres` surface override whose own `next_pass` is an inline sub-resource of
    // the file: the arrival mounts the link after the surface drew, then the walk
    // continues within the file's tables.
    const scene = `[gd_scene format=3]

[ext_resource type="StandardMaterial3D" path="res://chained.tres" id="1_link"]

[sub_resource type="BoxMesh" id="Box_1"]

[node name="Root" type="Node3D"]
[node name="M" type="MeshInstance3D" parent="."]
mesh = SubResource("Box_1")
surface_material_override/0 = ExtResource("1_link")
`;
    const file = `[gd_resource type="StandardMaterial3D" format=3]

[sub_resource type="StandardMaterial3D" id="Ink"]
albedo_color = Color(0, 0, 1, 1)

[resource]
albedo_color = Color(0, 1, 0, 1)
next_pass = SubResource("Ink")`;

    const renderer = await renderContent(scene, { 'res://chained.tres': file });

    const drawn = meshes(renderer);
    expect(drawn).toHaveLength(2);
    expect(albedo(drawn[1]!)).toBe(0x0000ff);
    expect(drawn[1]!.geometry).toBe(drawn[0]!.geometry);
  });

  it('skins a chain link by the same skeleton as its base draw', async () => {
    // The skinned ribbon's surface override chains an inverted-hull style pass:
    // the link must skin, not draw the bind pose beside the posed body.
    const ribbon = await renderContent(
      ribbonScene({
        extra: `[sub_resource type="StandardMaterial3D" id="Hull"]
albedo_color = Color(0, 0, 1, 1)

[sub_resource type="StandardMaterial3D" id="ChainedRed"]
albedo_color = Color(1, 0, 0, 1)
next_pass = SubResource("Hull")`,
        meshLines: `skeleton = NodePath("../Skeleton3D")
surface_material_override/0 = SubResource("ChainedRed")`,
      })
    );
    const skinned = ribbon.scene.findAllByType('SkinnedMesh').map((m) => instanceAs<THREE.SkinnedMesh>(m));

    expect(skinned).toHaveLength(2);
    expect(skinned[1]!.skeleton).toBe(skinned[0]!.skeleton);
    expect(albedo(skinned[1]!)).toBe(0x0000ff);
  });
});
