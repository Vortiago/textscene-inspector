/**
 * The seven GPU particles collision and attractor nodes draw Godot's editor gizmo for every node,
 * faint while unselected (`gpu_particles_collision_3d_gizmo_plugin.cpp:150-306`, ADR-0056): the 12
 * edges of a box, the three great circles of a sphere, or a box with the cell grid of the SDF type.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import type { TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { GizmoScene } from '../../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../../r3f/testing/gizmoContract';
import '../attractors/gpuparticlesattractorbox3d/index';
import '../attractors/gpuparticlesattractorbox3d/index.r3f';
import '../attractors/gpuparticlesattractorsphere3d/index';
import '../attractors/gpuparticlesattractorsphere3d/index.r3f';
import '../attractors/gpuparticlesattractorvectorfield3d/index';
import '../attractors/gpuparticlesattractorvectorfield3d/index.r3f';
import '../collisions/gpuparticlescollisionbox3d/index';
import '../collisions/gpuparticlescollisionbox3d/index.r3f';
import '../collisions/gpuparticlescollisionheightfield3d/index';
import '../collisions/gpuparticlescollisionheightfield3d/index.r3f';
import '../collisions/gpuparticlescollisionsdf3d/index';
import '../collisions/gpuparticlescollisionsdf3d/index.r3f';
import '../collisions/gpuparticlescollisionsphere3d/index';
import '../collisions/gpuparticlescollisionsphere3d/index.r3f';

const COLLISION_COLOR = godotColorToLinear({ r: 0.5, g: 0.7, b: 1 });
const ATTRACTOR_COLOR = godotColorToLinear({ r: 1, g: 0.7, b: 0.5 });

const COLLISION_BOXES = ['GPUParticlesCollisionBox3D', 'GPUParticlesCollisionHeightField3D'];
const ATTRACTOR_BOXES = ['GPUParticlesAttractorBox3D', 'GPUParticlesAttractorVectorField3D'];
const SPHERES = ['GPUParticlesCollisionSphere3D', 'GPUParticlesAttractorSphere3D'];
const SDF = 'GPUParticlesCollisionSDF3D';

function node(type: string, props: Record<string, string>): TscnNode {
  const parser = nodeRegistry.getRegistration(type)!.parser;
  return {
    rawProperties: {},
    name: 'Volume',
    type,
    children: [],
    properties: parser(heading(type, { name: 'Volume' }), props),
  } as TscnNode;
}

async function render(
  type: string,
  props: Record<string, string> = {},
  selectedPath: string | null = 'Volume',
  showGizmos = true,
  instantiated = false
) {
  const Volume = nodeComponentRegistry.get(type)!;
  return ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath="Volume"
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      <Volume node={node(type, props)}>
        <group name="Child" />
      </Volume>
    </GizmoScene>
  );
}

/** Each gizmo line object's vertices, colour and opacity, in draw order. */
async function gizmoLines(type: string, props: Record<string, string> = {}, selectedPath = 'Volume') {
  const renderer = await render(type, props, selectedPath);
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

describe.each([...COLLISION_BOXES, ...ATTRACTOR_BOXES, ...SPHERES, SDF])('<%s> gizmo gate', (type) => {
  const gizmoCase: GizmoNodeCase = {
    nodePath: 'Volume',
    drawnFor: 'every-node',
    mount: ({ selectedPath, showGizmos, instantiated }) =>
      render(type, {}, selectedPath, showGizmos, instantiated),
  };
  describeGizmoToggle(`<${type}>`, gizmoCase);
  describeInstantiatedGizmo(`<${type}>`, gizmoCase);

  it('keeps its children in the node transform, selected or not', async () => {
    for (const selected of [null, 'Volume']) {
      const renderer = await render(type, {}, selected);
      const group = renderer.scene.findByProps({ name: 'Volume' });
      expect(group.children.map((child) => child.props.name)).toContain('Child');
    }
  });
});

describe('box gizmos', () => {
  it.each([...COLLISION_BOXES, ...ATTRACTOR_BOXES])(
    '<%s> draws the 12 edges of the default box, from -1 to 1',
    async (type) => {
      const [box, ...others] = await gizmoLines(type);
      expect(others).toEqual([]);
      expect(box!.positions).toHaveLength(72);
      expect(box!.positions.slice(0, 6)).toEqual([1, -1, -1, -1, -1, -1]);
    }
  );

  it('draws the edges of an authored size, centred on the node', async () => {
    const [box] = await gizmoLines('GPUParticlesCollisionBox3D', { size: 'Vector3(3, 1.5, 3)' });
    expect(box!.positions.slice(0, 6)).toEqual([1.5, -0.75, -1.5, -1.5, -0.75, -1.5]);
  });

  it('draws a box of size 0 as Godot computes it, with no setter clamp (edge case)', async () => {
    const [box] = await gizmoLines('GPUParticlesAttractorBox3D', { size: 'Vector3(0, 0, 0)' });
    expect(box!.positions.every((value) => value === 0)).toBe(true);
  });

  it('draws a height field the same for each resolution', async () => {
    const draw = (resolution: string) => gizmoLines('GPUParticlesCollisionHeightField3D', { resolution });
    expect(await draw('0')).toEqual(await draw('5'));
  });
});

describe('sphere gizmos', () => {
  it.each(SPHERES)('<%s> draws 384 segments of radius 1 by default', async (type) => {
    const [circles, ...others] = await gizmoLines(type);
    expect(others).toEqual([]);
    expect(circles!.positions).toHaveLength(384 * 6);
    expect(circles!.positions.slice(0, 3)).toEqual([1, 0, 0]);
  });

  it('draws the circles at an authored radius', async () => {
    const [circles] = await gizmoLines('GPUParticlesAttractorSphere3D', { radius: '2.5' });
    expect(circles!.positions.slice(0, 3)).toEqual([2.5, 0, 0]);
  });
});

describe('colours', () => {
  it.each([...COLLISION_BOXES, SPHERES[0]!, SDF])(
    '<%s> draws in the collision colour (0.5, 0.7, 1)',
    async (type) => {
      const [first] = await gizmoLines(type);
      expect(first!.color.toArray()).toEqual(COLLISION_COLOR.toArray());
    }
  );

  it.each([...ATTRACTOR_BOXES, SPHERES[1]!])(
    '<%s> draws in the attractor colour (1, 0.7, 0.5)',
    async (type) => {
      const [first] = await gizmoLines(type);
      expect(first!.color.toArray()).toEqual(ATTRACTOR_COLOR.toArray());
    }
  );
});

describe('<GPUParticlesCollisionSDF3D> cell grid', () => {
  it('draws the box, then 63 x 3 x 4 = 756 grid segments for the default 64 cells', async () => {
    const [box, grid] = await gizmoLines(SDF);
    expect(box!.positions).toHaveLength(72);
    expect(grid!.positions).toHaveLength(756 * 6);
  });

  it.each([
    ['size (4, 2, 4), resolution 2', { size: 'Vector3(4, 2, 4)', resolution: '2' }, 632],
    ['size (3, 1.5, 3), resolution 0', { size: 'Vector3(3, 1.5, 3)', resolution: '0' }, 152],
    ['size (1, 1, 10), resolution 5', { size: 'Vector3(1, 1, 10)', resolution: '5' }, 2452],
  ])('draws the segments of %s', async (_label, props, segments) => {
    const [, grid] = await gizmoLines(SDF, props);
    expect(grid!.positions).toHaveLength(segments * 6);
  });

  it('draws the grid in the collision colour at opacity 0.15 selected and 0.045 unselected', async () => {
    const [, selected] = await gizmoLines(SDF);
    const [, unselected] = await gizmoLines(SDF, {}, 'Other');
    expect([selected!.opacity, unselected!.opacity]).toEqual([0.15, expect.closeTo(0.045, 10)]);
    expect(selected!.color.toArray()).toEqual(COLLISION_COLOR.toArray());
  });

  it('draws the box at full opacity selected and 0.3 unselected', async () => {
    const [selected] = await gizmoLines(SDF);
    const [unselected] = await gizmoLines(SDF, {}, 'Other');
    expect([selected!.opacity, unselected!.opacity]).toEqual([1, 0.3]);
  });
});
