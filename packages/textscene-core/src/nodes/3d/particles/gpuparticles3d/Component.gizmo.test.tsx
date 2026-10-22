/**
 * <GPUParticles3D> draws Godot's editor gizmos only while it is selected (ADR-0018): the
 * `visibility_aabb` box (`gpu_particles_3d_gizmo_plugin.cpp:61-84`) and the emission shape of its
 * ParticleProcessMaterial (`particles_3d_emission_shape_gizmo_plugin.cpp:85-217`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { NodePathProvider } from '../../../../r3f/contexts/NodePathContext';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { SelectSeeder } from '../../../../r3f/testing/SelectSeeder';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import './index.r3f';
import { parseGPUParticles3D } from './parser';

/** The registered component, which the registry mounts inside the node's place in the scene cull. */
const GPUParticles3D = nodeComponentRegistry.get('GPUParticles3D')!;

const BOX_COLOR = godotColorToLinear({ r: 0.8, g: 0.7, b: 0.4 });
const EMISSION_COLOR = godotColorToLinear({ r: 0.5, g: 0.7, b: 1 });

const SPHERE_MATERIAL: TscnInternalResource = {
  id: 'Process_sphere',
  type: 'ParticleProcessMaterial',
  data: { emission_shape: '1', emission_sphere_radius: '0.5' },
};
const POINT_MATERIAL: TscnInternalResource = {
  id: 'Process_point',
  type: 'ParticleProcessMaterial',
  data: {},
};
const BOX_MATERIAL: TscnInternalResource = {
  id: 'Process_box',
  type: 'ParticleProcessMaterial',
  data: {
    emission_shape: '3',
    emission_shape_offset: 'Vector3(0, 1, 0)',
    emission_shape_scale: 'Vector3(2, 1, 1)',
  },
};
const SHADER_MATERIAL: TscnInternalResource = {
  id: 'Shader_material',
  type: 'ShaderMaterial',
  data: { emission_shape: '1' },
};
const RESOURCES = [SPHERE_MATERIAL, POINT_MATERIAL, BOX_MATERIAL, SHADER_MATERIAL];
const FILE_PATH = 'res://fx/ring.tres';
const EXTERNAL_RESOURCES: TscnExternalResource[] = [
  { id: '1_ring', type: 'ParticleProcessMaterial', path: FILE_PATH },
];

function emitter(props: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'Sparks',
    type: 'GPUParticles3D',
    children: [],
    properties: parseGPUParticles3D(heading('GPUParticles3D', { name: 'Sparks' }), props),
  } as TscnNode;
}

async function render(selectedPath: string | null, props: Record<string, string> = {}) {
  const fake = createFakeResourceLoader();
  fake.resources.seed(FILE_PATH, {
    resourceType: 'ParticleProcessMaterial',
    properties: { emission_shape: '6', emission_ring_height: '2.0' },
    extResources: [],
    subResources: [],
  });
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={RESOURCES} externalResources={EXTERNAL_RESOURCES}>
        <SelectionProvider>
          {selectedPath !== null && <SelectSeeder path={selectedPath} />}
          <NodePathProvider path="Sparks">
            <GPUParticles3D node={emitter(props)}>
              <group name="Child" />
            </GPUParticles3D>
          </NodePathProvider>
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

/** Each gizmo line object's vertices and colour, in draw order. */
async function gizmoLines(props: Record<string, string>) {
  const renderer = await render('Sparks', props);
  return renderer.scene.findAllByType('LineSegments').map((line) => {
    const object = line.instance as THREE.LineSegments;
    return {
      positions: Array.from(object.geometry.getAttribute('position').array),
      color: (object.material as THREE.LineBasicMaterial).color,
    };
  });
}

describe('<GPUParticles3D> gizmo gate', () => {
  it.each([
    ['the node is selected', 'Sparks', 1],
    ['nothing is selected', null, 0],
    ['another node is selected', 'Other', 0],
  ])('draws the box only when %s', async (_label, selectedPath, expected) => {
    const renderer = await render(selectedPath);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(expected);
  });

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Sparks']) {
      const renderer = await render(selected);
      const group = renderer.scene.findByProps({ name: 'Sparks' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('<GPUParticles3D> visibility box', () => {
  it("draws the 12 edges of the constructor's box, from -4 to 4", async () => {
    const [box] = await gizmoLines({});
    expect(box!.positions).toHaveLength(72);
    expect(box!.positions.slice(0, 6)).toEqual([4, -4, -4, -4, -4, -4]);
  });

  it('draws the 12 edges of an authored box, in the order of AABB::get_edge', async () => {
    const [box] = await gizmoLines({ visibility_aabb: 'AABB(-1, 0, -1, 2, 3, 2)' });
    expect(box!.positions.slice(0, 12)).toEqual([1, 0, -1, -1, 0, -1, 1, 0, 1, 1, 0, -1]);
  });

  it('draws the box in the particles gizmo colour (0.8, 0.7, 0.4)', async () => {
    const [box] = await gizmoLines({});
    expect(box!.color.toArray()).toEqual(BOX_COLOR.toArray());
  });

  it('draws an authored AABB() as 12 edges at the origin (edge case)', async () => {
    const [box] = await gizmoLines({ visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)' });
    expect(box!.positions).toEqual(new Array(72).fill(0));
  });
});

describe('<GPUParticles3D> emission shape', () => {
  it('draws nothing more for a process material with the Point shape', async () => {
    expect(await gizmoLines({ process_material: 'SubResource("Process_point")' })).toHaveLength(1);
  });

  it('draws the sphere of a sub-resource material in the emission colour', async () => {
    const [, emission] = await gizmoLines({ process_material: 'SubResource("Process_sphere")' });
    expect(emission!.positions).toHaveLength(726 * 3);
    expect(emission!.positions.slice(0, 3)).toEqual([0, 0, 0.5]);
    expect(emission!.color.toArray()).toEqual(EMISSION_COLOR.toArray());
  });

  it("scales and offsets the shape by the material's emission_shape_scale and emission_shape_offset", async () => {
    const [, emission] = await gizmoLines({ process_material: 'SubResource("Process_box")' });
    expect(emission!.positions.slice(0, 6)).toEqual([2, 0, -1, -2, 0, -1]);
  });

  it('draws the ring of a material in its own file', async () => {
    const [, emission] = await gizmoLines({ process_material: 'ExtResource("1_ring")' });
    expect(emission!.positions).toHaveLength(988 * 3);
  });

  it.each([
    ['a ShaderMaterial', 'SubResource("Shader_material")'],
    ['no material', 'null'],
    ['a reference that names nothing', 'SubResource("Missing")'],
  ])('draws no emission shape for %s', async (_label, reference) => {
    expect(await gizmoLines({ process_material: reference })).toHaveLength(1);
  });

  it('draws no emission shape for an emitter with no process_material key', async () => {
    expect(await gizmoLines({})).toHaveLength(1);
  });
});
