/**
 * <LightmapGI> draws the edges of its capture-probe tetrahedra only while it is selected and the
 * Gizmos toggle is on (`lightmap_gi_gizmo_plugin.cpp:83-124`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { GizmoScene } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { FOUR_POINTS, SH_OF_FOUR } from '../../../resources/testing/probeDataFixture';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import './index.r3f';
import '../../base/node3d/index.r3f';

const LightmapGI = nodeComponentRegistry.get('LightmapGI')!;

const GIZMO_COLOR = godotColorToLinear({ r: 0.5, g: 0.6, b: 1 });

/** A LightmapGIData whose `probe_data` is one tetrahedron over four points, or `lines` instead. */
const ONE_TETRAHEDRON =
  `probe_data = {\n"bounds": AABB(0, 0, 0, 1, 1, 1), "points": ${FOUR_POINTS}, "tetrahedra": PackedInt32Array(0, 1, 2, 3), ` +
  `"bsp": PackedInt32Array(), "sh": ${SH_OF_FOUR}, "interior": false, "baked_exposure": 1.0\n}\n`;

function lightmapScene(dataLines: string, lightmapLines = '') {
  return new TscnParser().parse(
    `[gd_scene format=3]\n\n[sub_resource type="LightmapGIData" id="Data_1"]\n${dataLines}\n` +
      `[node name="Lightmap" type="LightmapGI"]\nlight_data = SubResource("Data_1")\n${lightmapLines}`
  );
}

async function render(
  selectedPath: string | null,
  dataLines = ONE_TETRAHEDRON,
  showGizmos = true,
  instantiated = false,
  lightmapLines = ''
) {
  const parsed = lightmapScene(dataLines, lightmapLines);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed}>
      <GizmoScene
        nodePath="Lightmap"
        selectedPath={selectedPath}
        showGizmos={showGizmos}
        instantiated={instantiated}
      >
        <LightmapGI node={parsed.nodes[0]!}>
          <group name="Child" />
        </LightmapGI>
      </GizmoScene>
    </SceneStack>
  );
  await settleLoads();
  return renderer;
}

async function gizmoLines(dataLines = ONE_TETRAHEDRON, lightmapLines = '') {
  const renderer = await render('Lightmap', dataLines, true, false, lightmapLines);
  return renderer.scene.findAllByType('LineSegments').map((line) => {
    const object = line.instance as THREE.LineSegments;
    const material = object.material as THREE.LineBasicMaterial;
    return {
      positions: Array.from(object.geometry.getAttribute('position').array),
      color: material.color,
      opacity: material.opacity,
    };
  });
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'Lightmap',
  drawnFor: 'selected-only',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    render(selectedPath, ONE_TETRAHEDRON, showGizmos, instantiated),
};
describeGizmoToggle('<LightmapGI>', GIZMO_CASE);
describeInstantiatedGizmo('<LightmapGI>', GIZMO_CASE);

describe('<LightmapGI> probe gizmo gate', () => {
  it.each([
    ['the node is selected', 'Lightmap', 1],
    ['nothing is selected', null, 0],
    ['another node is selected', 'Other', 0],
  ])('draws the probe edges only when %s', async (_label, selectedPath, expected) => {
    const renderer = await render(selectedPath);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(expected);
  });

  it('draws nothing for inline data with no probe_data (edge case)', async () => {
    expect(await gizmoLines('lightmap_textures = []\n')).toEqual([]);
  });

  it('draws nothing for a LightmapGI with no light_data (edge case)', async () => {
    const parsed = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Lightmap" type="LightmapGI"]\n'
    );
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack loader={createFakeResourceLoader().loader} scene={parsed}>
        <GizmoScene nodePath="Lightmap" selectedPath="Lightmap">
          <LightmapGI node={parsed.nodes[0]!} />
        </GizmoScene>
      </SceneStack>
    );
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Lightmap']) {
      const renderer = await render(selected);
      const group = renderer.scene.findByProps({ name: 'Lightmap' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<LightmapGI> probe gizmo lines', () => {
  it('draws the six edges of one tetrahedron in one line object, in the cited colour at opacity 0.1', async () => {
    const [lines] = await gizmoLines();
    expect(lines!.positions).toEqual([
      0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,
      1,
    ]);
    expect(lines!.color.toArray()).toEqual(GIZMO_COLOR.toArray());
    expect(lines!.opacity).toBeCloseTo(0.1);
  });

  it('draws the lines under the node transform', async () => {
    const renderer = await render(
      'Lightmap',
      ONE_TETRAHEDRON,
      true,
      false,
      'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)\n'
    );
    renderer.scene.instance.updateMatrixWorld(true);
    const [line] = renderer.scene.findAllByType('LineSegments');
    const world = new THREE.Vector3().setFromMatrixPosition(
      (line!.instance as THREE.LineSegments).matrixWorld
    );
    expect(world.x).toBe(5);
  });
});

describe('<LightmapGI> probe spheres', () => {
  const spheres = async (selectedPath: string | null = 'Lightmap') =>
    (await render(selectedPath)).scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);

  it('draws one mesh of a sphere for each probe while selected, none otherwise', async () => {
    const [mesh] = await spheres();
    expect(mesh!.geometry.getAttribute('position').count).toBe(4 * 9 * 17);
    expect(await spheres(null)).toHaveLength(0);
  });

  it('colours each vertex from the SH of its probe, unlit, opaque and without fog', async () => {
    const [mesh] = await spheres();
    const material = mesh!.material as THREE.MeshBasicMaterial;
    expect(mesh!.geometry.getAttribute('color')).toBeDefined();
    expect(material).toMatchObject({ vertexColors: true, transparent: false, fog: false });
  });

  it('draws the spheres under the node transform, as a child of the same gate as the edges', async () => {
    const renderer = await render('Lightmap');
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });
});
