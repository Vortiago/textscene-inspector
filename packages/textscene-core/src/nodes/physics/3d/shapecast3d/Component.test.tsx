/**
 * <ShapeCast3D> draws the editor sweep gizmo for every node (shape_cast_3d_gizmo_plugin.cpp:60-66),
 * the sweep line and offset wireframe ported from shape_cast_3d.cpp:498-515, the wireframe from
 * Shape3D::get_debug_mesh_lines. The node's own debug material never varies.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import { GizmoScene, lineMaterials, lineOpacities } from '../../../../r3f/testing/GizmoScene';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha } from '../../../../r3f/gizmo/gizmoVariant';
import { DEFAULT_COLLISION_DEBUG_COLOR, debugShapeColour } from '../../shared/debugColor';
import { describeGizmoToggle, type GizmoNodeCase } from '../../../../r3f/testing/gizmoContract';
import { ShapeCast3D } from './Component';
import { parseShapeCast3D } from './parser';
import { degToRad } from '../../../../godot/math/math.js';

const boxShape: TscnInternalResource = {
  id: 'BoxShape3D_1',
  type: 'BoxShape3D',
  data: { size: 'Vector3(1, 1, 1)' },
};
const sphereShape: TscnInternalResource = {
  id: 'SphereShape3D_1',
  type: 'SphereShape3D',
  data: { radius: '2' },
};
const cylinderShape: TscnInternalResource = {
  id: 'CylinderShape3D_1',
  type: 'CylinderShape3D',
  data: { radius: '1', height: '2' },
};
const capsuleShape: TscnInternalResource = {
  id: 'CapsuleShape3D_1',
  type: 'CapsuleShape3D',
  data: { radius: '1', height: '4' },
};
const concaveShape: TscnInternalResource = {
  id: 'ConcavePolygonShape3D_1',
  type: 'ConcavePolygonShape3D',
  data: { data: 'PackedVector3Array(-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0, 0.5)' },
};
const convexShape: TscnInternalResource = {
  id: 'ConvexPolygonShape3D_1',
  type: 'ConvexPolygonShape3D',
  data: {
    points:
      'PackedVector3Array(-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5)',
  },
};

/**
 * The gizmo imports three's ConvexHull lazily for a convex shape. Under CI load that import outlasts
 * the one timer tick of `settleLoads`, so the module lands late here on every run, and the hull test
 * waits for the wireframe itself.
 */
vi.mock('three/addons/math/ConvexHull.js', async (importOriginal) => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return importOriginal();
});

interface RenderOptions {
  selectedPath?: string | null;
  showGizmos?: boolean;
  instantiated?: boolean;
  shapes?: TscnInternalResource[];
}

function castNode(props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name: 'Cast',
    type: 'ShapeCast3D',
    children: [],
    properties: parseShapeCast3D(heading('ShapeCast3D', { name: 'Cast' }), {
      shape: 'SubResource("BoxShape3D_1")',
      ...props,
    }),
  } as TscnNode;
}

async function renderCast(
  selectedPath: string | null,
  props: Record<string, string> = {},
  { showGizmos = true, instantiated = false, shapes = [boxShape] }: RenderOptions = {}
) {
  const content: ReactNode = (
    <GizmoScene
      nodePath="Cast"
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      <ShapeCast3D node={castNode(props)}>
        <group name="Child" />
      </ShapeCast3D>
    </GizmoScene>
  );
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={shapes}>{content}</SceneResourcesProvider>
  );
}

/** The sweep line first, the shape wireframe after it, the order the plugin adds them in. */
async function castLines(
  props: Record<string, string> = {},
  options: RenderOptions = {}
): Promise<THREE.LineSegments[]> {
  const renderer = await renderCast(options.selectedPath ?? 'Cast', props, options);
  return renderer.scene.findAllByType('LineSegments').map((line) => line.instance as THREE.LineSegments);
}

function lineOf(lines: THREE.LineSegments[], vertexCount: number): number[] {
  const line = lines.find((l) => l.geometry.getAttribute('position').count === vertexCount);
  expect(line).toBeDefined();
  return Array.from(line!.geometry.getAttribute('position').array);
}

/** A segment's ends as text, so a test can pin a set of segments in any draw order. */
const segmentKey = (flat: number[]): string => flat.map((v) => v.toFixed(1)).join(' ');

describe('<ShapeCast3D> gizmo state', () => {
  it('draws the sweep line and wireframe at the alpha of the collision colour, 0.42, when selected', async () => {
    expect(lineOpacities(await renderCast('Cast'))).toEqual([
      DEFAULT_COLLISION_DEBUG_COLOR.a,
      DEFAULT_COLLISION_DEBUG_COLOR.a,
    ]);
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('keeps that alpha when %s, as the plugin draws its own material', async (_label, selectedPath) => {
    const opacities = lineOpacities(await renderCast(selectedPath));
    expect(opacities).toEqual([DEFAULT_COLLISION_DEBUG_COLOR.a, DEFAULT_COLLISION_DEBUG_COLOR.a]);
  });

  it('keeps its children in the Node3D transform space, selected or not', async () => {
    for (const selected of [null, 'Cast']) {
      const renderer = await renderCast(selected);
      const group = renderer.scene.findByProps({ name: 'Cast' });
      expect(group.children.map((c) => c.props.name)).toContain('Child');
    }
  });
});

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'Cast',
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    renderCast(selectedPath, {}, { showGizmos, instantiated }),
};
describeGizmoToggle('<ShapeCast3D>', GIZMO_CASE);

// No describeInstantiatedGizmo: the plugin passes the node's own debug material, which no variant
// replaces, so the gizmo keeps its colour inside a locked instance too, as Marker3D's cross does.
describe('<ShapeCast3D> instantiated gizmo', () => {
  it('draws both parts in their own colour inside a locked instance, selected or not', async () => {
    for (const selectedPath of [null, 'Cast']) {
      const renderer = await renderCast(selectedPath, {}, { instantiated: true });
      const expected = godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray();
      for (const material of lineMaterials(renderer)) {
        expect(material.opacity).toBe(DEFAULT_COLLISION_DEBUG_COLOR.a);
        expect(material.color.toArray()).toEqual(expected);
      }
    }
  });
});

describe('<ShapeCast3D> disabled gizmo', () => {
  it('draws both parts in the grey Godot fetches alone while disabled, selected and unselected', async () => {
    for (const selectedPath of [null, 'Cast']) {
      const renderer = await renderCast(selectedPath, { enabled: 'false' });
      const expected = godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray();
      const disabledOpacity = gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a);
      for (const material of lineMaterials(renderer)) {
        expect(material.color.toArray()).toEqual(expected);
        expect(material.opacity).toBe(disabledOpacity);
      }
    }
  });
});

describe('<ShapeCast3D> sweep line', () => {
  it.each([
    ['the authored target', { target_position: 'Vector3(0, -2, 0)' }, [0, 0, 0, 0, -2, 0]],
    ["Godot's default when the key is absent", {}, [0, 0, 0, 0, -1, 0]],
    ["Godot's default when the key is unreadable", { target_position: 'long' }, [0, 0, 0, 0, -1, 0]],
    ['an off-axis target', { target_position: 'Vector3(2, 0, -3)' }, [0, 0, 0, 2, 0, -3]],
  ])('runs from the origin to target_position for %s', async (_label, props, expected) => {
    expect(await lineOf(await castLines(props), 2)).toEqual(expected);
  });

  it('draws the sweep line alone when no shape is authored, as the plugin adds both parts regardless', async () => {
    const lines = await castLines({ shape: '' });
    expect(lines).toHaveLength(1);
    expect(await lineOf(lines, 2)).toEqual([0, 0, 0, 0, -1, 0]);
  });

  it('draws the sweep line alone when the shape SubResource is missing', async () => {
    const lines = await castLines({ shape: 'SubResource("BoxShape3D_ghost")' });
    expect(lines).toHaveLength(1);
    expect(await lineOf(lines, 2)).toEqual([0, 0, 0, 0, -1, 0]);
  });

  // `_update_debug_shape_vertices` returns before the line vertices when the target is Vector3(),
  // but the shape wireframe is offset before that guard, so it still draws at the origin
  // (shape_cast_3d.cpp:502-510).
  it('draws the wireframe alone for a zero target, without the line', async () => {
    const lines = await castLines({ target_position: 'Vector3(0, 0, 0)' });
    expect(lines).toHaveLength(1);
    expect(await lineOf(lines, 24)).toHaveLength(72);
  });
});

describe('<ShapeCast3D> shape wireframe', () => {
  it('draws the box edges beside the sweep line, each vertex offset by the whole target', async () => {
    const wire = await lineOf(await castLines({ target_position: 'Vector3(0, -1, 0)' }), 24);
    // Godot's AABB edge order (aabb.cpp:357-416), read from -size/2: e0 runs from the +x corner
    // backwards, and the top face edges (e4-e7) come before the rising edge pairs (e8-e11).
    expect(wire).toEqual([
      0.5, -1.5, -0.5, -0.5, -1.5, -0.5, 0.5, -1.5, 0.5, 0.5, -1.5, -0.5, -0.5, -1.5, 0.5, 0.5, -1.5, 0.5,
      -0.5, -1.5, -0.5, -0.5, -1.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
      0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -1.5, 0.5, -0.5, -0.5, 0.5,
      -0.5, -1.5, -0.5, -0.5, -0.5, -0.5, 0.5, -1.5, -0.5, 0.5, -0.5, -0.5, 0.5, -1.5, 0.5, 0.5, -0.5, 0.5,
    ]);
  });

  it('reads the default box size, Vector3(1, 1, 1), when the size is absent', async () => {
    const lines = await castLines({}, { shapes: [{ id: 'BoxShape3D_1', type: 'BoxShape3D', data: {} }] });
    expect(lines).toHaveLength(2);
    expect(await lineOf(lines, 24)).toHaveLength(72);
  });

  it('draws the sphere rings, one step of a degree apart, offset by the target', async () => {
    const wire = await lineOf(
      await castLines(
        { shape: 'SubResource("SphereShape3D_1")', target_position: 'Vector3(0, -1, 0)' },
        { shapes: [sphereShape] }
      ),
      361 * 3 * 2
    );
    // The equator ring's first segment start and end, both offset by the target.
    expect(wire[0]).toBeCloseTo(0, 6);
    expect(wire[1]).toBeCloseTo(-1, 6);
    expect(wire[2]).toBeCloseTo(2, 6);
    expect(wire[3]).toBeCloseTo(2 * Math.sin(degToRad(1)), 6);
    expect(wire[4]).toBeCloseTo(-1, 6);
    expect(wire[5]).toBeCloseTo(2 * Math.cos(degToRad(1)), 6);
  });

  it('draws the cylinder rings at ±half the height, and the rim ticks, offset by the target', async () => {
    const wire = await lineOf(
      await castLines(
        { shape: 'SubResource("CylinderShape3D_1")', target_position: 'Vector3(0, -1, 0)' },
        { shapes: [cylinderShape] }
      ),
      360 * 2 * 2 + 8
    );
    expect(wire[0]).toBeCloseTo(0, 6);
    expect(wire[1]).toBeCloseTo(0, 6);
    expect(wire[2]).toBeCloseTo(1, 6);
    expect(wire[3]).toBeCloseTo(Math.sin(degToRad(1)), 6);
  });

  it('draws the capsule rings and rim ticks, offset by the target', async () => {
    const wire = await lineOf(
      await castLines(
        { shape: 'SubResource("CapsuleShape3D_1")', target_position: 'Vector3(0, -1, 0)' },
        { shapes: [capsuleShape] }
      ),
      (360 * 4 + 4) * 2
    );
    expect(wire[0]).toBeCloseTo(0, 6);
    expect(wire[1]).toBeCloseTo(0, 6);
    expect(wire[2]).toBeCloseTo(1, 6);
  });

  it('draws one pair per triangle edge of a concave shape, a canonical-pair dedup', async () => {
    const wire = await lineOf(
      await castLines(
        { shape: 'SubResource("ConcavePolygonShape3D_1")', target_position: 'Vector3(0, -1, 0)' },
        { shapes: [concaveShape] }
      ),
      6
    );
    // Godot iterates a hash set, so the draw order of the three edges is not pinned: the set is,
    // in Godot's DrawEdge direction, the lexicographically larger vertex first.
    expect([wire.slice(0, 6), wire.slice(6, 12), wire.slice(12, 18)].map(segmentKey).sort()).toEqual(
      [
        segmentKey([0.5, -1, -0.5, -0.5, -1, -0.5]),
        segmentKey([0.5, -1, -0.5, 0, -1, 0.5]),
        segmentKey([0, -1, 0.5, -0.5, -1, -0.5]),
      ].sort()
    );
  });

  it('draws a shared edge once, its two triangles winding it opposite ways', async () => {
    // A second triangle flips the shared edge's winding, which Godot's canonical DrawEdge compares
    // equal, so five edges draw, not six (concave_polygon_shape_3d.h:54-59). Godot iterates a hash
    // set, so only the count and the edge set pin.
    const shared: TscnInternalResource = {
      ...concaveShape,
      data: {
        data: 'PackedVector3Array(-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 0, 1)',
      },
    };
    const wire = await lineOf(
      await castLines(
        { shape: 'SubResource("ConcavePolygonShape3D_1")', target_position: 'Vector3(0, -1, 0)' },
        { shapes: [shared] }
      ),
      10
    );
    expect(
      [wire.slice(0, 6), wire.slice(6, 12), wire.slice(12, 18), wire.slice(18, 24), wire.slice(24, 30)]
        .map(segmentKey)
        .sort()
    ).toEqual(
      [
        segmentKey([0.5, -1, -0.5, -0.5, -1, -0.5]),
        segmentKey([0.5, -1, -0.5, 0, -1, 0.5]),
        segmentKey([0, -1, 0.5, -0.5, -1, -0.5]),
        segmentKey([-0.5, -1, 1, -0.5, -1, -0.5]),
        segmentKey([0.5, -1, -0.5, -0.5, -1, 1]),
      ].sort()
    );
  });

  it('draws the triangulated hull edges of a convex shape, every corner offset by the target', async () => {
    const tree = (
      <SceneResourcesProvider internalResources={[convexShape]}>
        <GizmoScene nodePath="Cast" selectedPath="Cast">
          <ShapeCast3D
            node={castNode({
              shape: 'SubResource("ConvexPolygonShape3D_1")',
              target_position: 'Vector3(0, -1, 0)',
            })}
          />
        </GizmoScene>
      </SceneResourcesProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);
    const castLinesNow = () =>
      renderer.scene.findAllByType('LineSegments').map((line) => line.instance as THREE.LineSegments);
    // The hull draws once its lazy import lands, so each try re-flushes the fiber snapshot. It holds
    // the 12 boundary edges and the 6 face diagonals of the triangulated cube, which
    // ConvexHullComputer copies one per canonical a < b pair (convex_hull.cpp:2269-2278).
    const wire = await vi.waitFor(async () => {
      await settleLoads();
      await renderer.update(tree);
      return lineOf(castLinesNow(), 36);
    });
    for (let i = 0; i < wire.length; i += 3) {
      const [x, y, z] = [wire[i]!, wire[i + 1]!, wire[i + 2]!].map((v) => Number(v.toFixed(6))) as [
        number,
        number,
        number,
      ];
      const corner = [Math.abs(x), Math.abs(y + 1), Math.abs(z)];
      expect(corner).toEqual([0.5, 0.5, 0.5]);
    }
  });
});

describe('<ShapeCast3D> debug colour', () => {
  it('draws both parts in the project collision colour when no custom colour is authored', async () => {
    const lines = await castLines({});
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const material = line.material as THREE.LineBasicMaterial;
      expect(material.color.toArray()).toEqual(godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray());
      expect(material.opacity).toBe(DEFAULT_COLLISION_DEBUG_COLOR.a);
    }
  });

  it('draws both parts in an authored custom colour at its alpha, unselected like selected', async () => {
    for (const selectedPath of [null, 'Cast']) {
      const lines = await castLines({ debug_shape_custom_color: 'Color(1, 0, 0, 1)' }, { selectedPath });
      const custom = debugShapeColour({ r: 1, g: 0, b: 0, a: 1 });
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        const material = line.material as THREE.LineBasicMaterial;
        expect(material.color.toArray()).toEqual(godotColorToLinear(custom).toArray());
        expect(material.opacity).toBe(1);
      }
    }
  });

  it('reads an authored Color(0, 0, 0, 1) as empty, and puts on the collision colour', async () => {
    const lines = await castLines({ debug_shape_custom_color: 'Color(0, 0, 0, 1)' });
    for (const line of lines) {
      const material = line.material as THREE.LineBasicMaterial;
      expect(material.color.toArray()).toEqual(godotColorToLinear(DEFAULT_COLLISION_DEBUG_COLOR).toArray());
    }
  });
});
