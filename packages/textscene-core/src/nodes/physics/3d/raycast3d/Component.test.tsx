/**
 * <RayCast3D> draws the editor ray gizmo for every node (`ray_cast_3d_gizmo_plugin.cpp:61-67`): the
 * origin→target_position line plus the truncated pyramid of a `debug_shape_thickness` above 1,
 * ported from ray_cast_3d.cpp:403-425 (`_update_debug_shape_vertices`). The plugin passes the
 * node's own debug material, which no selected, unselected or instantiated variant replaces
 * (ray_cast_3d.cpp:531-551); a disabled node draws in the grey `shape_material_disabled` fetches.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { GizmoScene, lineOpacities } from '../../../../r3f/testing/GizmoScene';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha } from '../../../../r3f/gizmo/gizmoVariant';
import { DEFAULT_COLLISION_DEBUG_COLOR, debugShapeColour } from '../../shared/debugColor';
import { describeGizmoToggle, type GizmoNodeCase } from '../../../../r3f/testing/gizmoContract';
import { RayCast3D } from './Component';
import { parseRayCast3D } from './parser';

function rayNode(props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name: 'Ray',
    type: 'RayCast3D',
    children: [],
    properties: parseRayCast3D(heading('RayCast3D', { name: 'Ray' }), props),
  } as TscnNode;
}

async function renderRay(
  selectedPath: string | null,
  props: Record<string, string> = {},
  showGizmos = true,
  instantiated = false
) {
  return ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath="Ray"
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      <RayCast3D node={rayNode(props)}>
        <group name="Child" />
      </RayCast3D>
    </GizmoScene>
  );
}

async function gizmos(props: Record<string, string>, selectedPath: string | null = 'Ray') {
  const renderer = await renderRay(selectedPath, props);
  return {
    renderer,
    lines: renderer.scene.findAllByType('LineSegments'),
    fills: renderer.scene.findAllByType('Mesh'),
  };
}

async function gizmoLine(
  props: Record<string, string> = {},
  selectedPath: string | null = 'Ray'
): Promise<THREE.LineSegments> {
  const { lines } = await gizmos(props, selectedPath);
  expect(lines).toHaveLength(1);
  return lines[0]!.instance as THREE.LineSegments;
}

async function linePositions(props: Record<string, string>): Promise<number[]> {
  const line = await gizmoLine(props);
  return Array.from(line.geometry.getAttribute('position').array);
}

function fillOf(renderer: Awaited<ReturnType<typeof renderRay>>): THREE.Mesh {
  const fills = renderer.scene.findAllByType('Mesh');
  expect(fills).toHaveLength(1);
  return fills[0]!.instance as THREE.Mesh;
}

/** The fill's opacity and linear colour, the two halves of the look a material carries. */
function fillLook(renderer: Awaited<ReturnType<typeof renderRay>>): [number, number[]] {
  const material = fillOf(renderer).material as THREE.MeshBasicMaterial;
  return [material.opacity, material.color.toArray()];
}

describe('<RayCast3D> gizmo state', () => {
  it('draws the ray line at the alpha of the collision colour, 0.42, when the node is selected', async () => {
    expect(lineOpacities(await renderRay('Ray'))).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a]);
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('keeps that alpha when %s, as the plugin draws its own material', async (_label, selectedPath) => {
    expect(lineOpacities(await renderRay(selectedPath))).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a]);
  });

  it('keeps its children in the Node3D transform space, selected or not', async () => {
    for (const selected of [null, 'Ray']) {
      const renderer = await renderRay(selected);
      const group = renderer.scene.findByProps({ name: 'Ray' });
      expect(group.children.map((c) => c.props.name)).toContain('Child');
    }
  });
});

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'Ray',
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    renderRay(selectedPath, {}, showGizmos, instantiated),
};
describeGizmoToggle('<RayCast3D>', GIZMO_CASE);

// No describeInstantiatedGizmo: the plugin passes the node's own debug material, which no variant
// replaces, so the gizmo keeps its colour inside a locked instance too, as Marker3D's cross does.
describe('<RayCast3D> instantiated gizmo', () => {
  it('draws the line and the fill in their own colour inside a locked instance, selected or not', async () => {
    for (const selectedPath of [null, 'Ray']) {
      const renderer = await renderRay(selectedPath, {}, true, true);
      const material = (renderer.scene.findAllByType('LineSegments')[0]!.instance as THREE.LineSegments)
        .material as THREE.LineBasicMaterial;
      const selected = godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray();
      expect(material.opacity).toBe(DEFAULT_COLLISION_DEBUG_COLOR.a);
      expect(material.color.toArray()).toEqual(selected);
      expect(fillLook(renderer)).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a, selected]);
    }
  });
});

describe('<RayCast3D> ray line', () => {
  it.each([
    ['the authored target', { target_position: 'Vector3(0, -3, 0)' }, [0, 0, 0, 0, -3, 0]],
    ['an off-axis target', { target_position: 'Vector3(2, 0, -3)' }, [0, 0, 0, 2, 0, -3]],
    ["Godot's default when the key is absent", {}, [0, 0, 0, 0, -1, 0]],
    ["Godot's default when the key is unreadable", { target_position: 'long' }, [0, 0, 0, 0, -1, 0]],
  ])('runs from the origin to target_position for %s', async (_label, props, expected) => {
    expect(await linePositions(props)).toEqual(expected);
  });

  // `_update_debug_shape_vertices` returns before any vertex when the target is Vector3(),
  // so a zero target draws nothing, unlike the SpringArm3D zero length (ray_cast_3d.cpp:407).
  it('draws nothing for an authored zero target', async () => {
    const { renderer } = await gizmos({ target_position: 'Vector3(0, 0, 0)' });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});

describe('<RayCast3D> pyramid fill', () => {
  it.each([
    ['the authored target', { target_position: 'Vector3(0, -3, 0)' }],
    ["Godot's default when the key is absent", {}],
  ])('draws when %s, at the default thickness of 2 that Godot stores', async (_label, props) => {
    const renderer = await renderRay('Ray', props);
    const fill = fillOf(renderer);
    // Godot pushes the 14 strip vertices; three draws them as the strip's consecutive triples.
    expect(fill.geometry.getAttribute('position').count).toBe(14);
    expect(Array.from(fill.geometry.getIndex()!.array)).toEqual([
      0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5, 4, 5, 6, 5, 6, 7, 6, 7, 8, 7, 8, 9, 8, 9, 10, 9, 10, 11, 10, 11, 12,
      11, 12, 13,
    ]);
  });

  it('keeps the fill at that alpha for an unselected node too, as the plugin gates neither part', async () => {
    const renderer = await renderRay(null);
    expect(fillLook(renderer)).toEqual([
      DEFAULT_COLLISION_DEBUG_COLOR.a,
      godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray(),
    ]);
    expect(lineOpacities(renderer)).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a]);
  });

  it('draws no fill at a thickness of 1', async () => {
    const renderer = await renderRay('Ray', { debug_shape_thickness: '1' });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws no fill and no line for a zero target, as Godot returns before any vertex', async () => {
    const { renderer } = await gizmos({ target_position: 'Vector3(0, 0, 0)' });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws in the grey Godot fetches alone when the ray is disabled', async () => {
    const renderer = await renderRay('Ray', { enabled: 'false' });
    expect(lineOpacities(renderer)).toEqual([gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a)]);
    expect(fillLook(renderer)).toEqual([
      gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a),
      godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray(),
    ]);
  });

  // The strip buffer in Godot's push order: the first slot is a tip vertex, a third of a base
  // ring `thickness / 100` m across at the origin, each swung a quarter turn step about the ray
  // (ray_cast_3d.cpp:422-424).
  it('builds the base ring at radius thickness/100 and the tip at a third of it', async () => {
    const renderer = await renderRay('Ray', { target_position: 'Vector3(0, -3, 0)' });
    const positions = Array.from(fillOf(renderer).geometry.getAttribute('position').array);
    const ring = Math.PI / 4;
    expect(positions[0]).toBeCloseTo((0.02 / 3) * Math.cos(ring), 6);
    expect(positions[1]).toBeCloseTo(-3, 6);
    expect(positions[2]).toBeCloseTo((0.02 / 3) * Math.sin(ring), 6);
    expect(positions[6]).toBeCloseTo(0.02 * Math.cos(ring), 6);
    expect(positions[7]).toBe(0);
    expect(positions[8]).toBeCloseTo(0.02 * Math.sin(ring), 6);
  });

  it('swings the ring about an off-axis ray', async () => {
    const renderer = await renderRay('Ray', { target_position: 'Vector3(3, 0, 0)' });
    const positions = Array.from(fillOf(renderer).geometry.getAttribute('position').array);
    const ring = Math.PI / 4;
    expect(positions[6]).toBeCloseTo(0, 6);
    expect(positions[7]).toBeCloseTo(0.02 * Math.cos(ring), 6);
    expect(positions[8]).toBeCloseTo(0.02 * Math.sin(ring), 6);
  });

  it('picks the cross-axis branch for a ray along Z, where x and y are level', async () => {
    const renderer = await renderRay('Ray', { target_position: 'Vector3(0, 0, 3)' });
    const positions = Array.from(fillOf(renderer).geometry.getAttribute('position').array);
    const ring = Math.PI / 4;
    expect(positions[6]).toBeCloseTo(0.02 * Math.sin(ring), 6);
    expect(positions[7]).toBeCloseTo(-0.02 * Math.cos(ring), 6);
    expect(positions[8]).toBeCloseTo(0, 6);
  });
});

describe('<RayCast3D> debug colour', () => {
  it('draws in the project collision colour when no custom colour is authored', async () => {
    const line = await gizmoLine({});
    const material = line.material as THREE.LineBasicMaterial;
    const expected = godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR);
    expect(material.color.toArray()).toEqual(expected.toArray());
    expect(material.opacity).toBe(DEFAULT_COLLISION_DEBUG_COLOR.a);
  });

  it('draws in an authored custom colour at its alpha, unselected like selected', async () => {
    for (const selectedPath of [null, 'Ray']) {
      const line = await gizmoLine({ debug_shape_custom_color: 'Color(1, 0, 0, 1)' }, selectedPath);
      const material = line.material as THREE.LineBasicMaterial;
      const custom = debugShapeColour({ r: 1, g: 0, b: 0, a: 1 });
      expect(material.color.toArray()).toEqual(godotColorToLinear(custom).toArray());
      expect(material.opacity).toBe(1);
    }
  });

  // `color == Color(0, 0, 0)` compares all four channels with the default's alpha of 1
  // (color.h:80, ray_cast_3d.cpp:545), so an alpha-less black reads as the empty colour.
  it('reads an authored Color(0, 0, 0, 1) as empty, and puts on the collision colour', async () => {
    const line = await gizmoLine({ debug_shape_custom_color: 'Color(0, 0, 0, 1)' });
    const material = line.material as THREE.LineBasicMaterial;
    expect(material.color.toArray()).toEqual(godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray());
  });

  it('keeps a translucent black authored, whose alpha is not the empty default', async () => {
    const line = await gizmoLine({ debug_shape_custom_color: 'Color(0, 0, 0, 0.5)' });
    const material = line.material as THREE.LineBasicMaterial;
    const custom = debugShapeColour({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(material.color.toArray()).toEqual(godotColorToLinear(custom).toArray());
    expect(material.opacity).toBe(0.5);
  });

  it('disregards a custom colour while the ray is disabled, as the disabled material replaces the node colour', async () => {
    const line = await gizmoLine({ debug_shape_custom_color: 'Color(1, 0, 0, 1)', enabled: 'false' });
    const material = line.material as THREE.LineBasicMaterial;
    expect(material.color.toArray()).toEqual(godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray());
    expect(material.opacity).toBe(gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a));
  });
});
