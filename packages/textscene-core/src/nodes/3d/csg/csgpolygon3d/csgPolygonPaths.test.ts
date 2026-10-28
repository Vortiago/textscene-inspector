/**
 * The `path_node` pass has to handle both shapes the corpus actually writes, and they
 * point in opposite directions: `csg.tscn`'s Road names a SIBLING (`../Path3D`) while
 * `racetrack_csg.tscn` names a CHILD (`Path3D`). A resolver that assumed either one
 * would silently drop the other's geometry.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TscnParser } from '../../../../parser/TscnParser';
import { liveTreeOf } from '../../../../r3f/liveSceneTree';
import { contextOver } from '../../../../r3f/liveSceneTree.testkit';
import type { NodePatches } from '../../../../r3f/nodePatch';
import { resolveCsgPolygonPaths } from './csgPolygonPaths';
import * as logger from '../../../../logger';
import type { CSGPolygon3DResolvedPath } from './types';

const CURVE = `[sub_resource type="Curve3D" id="Curve3D_road"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4, 0, 0, 0, 0, 0, 0, 3, 0, -6),
"tilts": PackedFloat32Array(0, 0, 0)
}
point_count = 3`;

/** `body` as a scene file that holds {@link CURVE}. */
const sceneFile = (body: string, curve = CURVE) =>
  `[gd_scene load_steps=2 format=3]\n\n${curve}\n\n${body}\n`;

/** What the pass binds in the live tree of `content`, with each scene of `scenes` loaded, after `placed` moved nodes. */
function patchesOf(
  content: string,
  scenes: Readonly<Record<string, string>> = {},
  placed: NodePatches = new Map()
): NodePatches {
  const parse = (text: string) => new TscnParser().parse(text);
  const main = parse(content);
  const loaded = Object.fromEntries(Object.entries(scenes).map(([path, text]) => [path, parse(text)]));
  return resolveCsgPolygonPaths(liveTreeOf(main.nodes, contextOver(main, loaded)), placed);
}

/** The path the pass resolves for the polygon at the live path `path`. */
function resolvedAt(patches: NodePatches, path: string): CSGPolygon3DResolvedPath | undefined {
  return patches.get(path)?.resolvedPath as CSGPolygon3DResolvedPath | undefined;
}

const parse = (body: string) => patchesOf(sceneFile(body));

/** The Road shape: a CSGPolygon3D and its Path3D as siblings under a holder. */
const SIBLING_SCENE = `[node name="Root" type="Node3D"]

[node name="Road" type="Node3D" parent="."]

[node name="RoadTop" type="CSGPolygon3D" parent="Road"]
mode = 2
path_node = NodePath("../Path3D")
path_local = true

[node name="Path3D" type="Path3D" parent="Road"]
curve = SubResource("Curve3D_road")`;

/** The racetrack shape: the Path3D is a CHILD of the polygon. */
const CHILD_SCENE = `[node name="Root" type="Node3D"]

[node name="Racetrack" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("Path3D")
path_local = true

[node name="Path3D" type="Path3D" parent="Racetrack"]
curve = SubResource("Curve3D_road")`;

describe('resolveCsgPolygonPaths', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A polygon addressing its Path3D by unique name from an unrelated branch. */
  const UNIQUE_SCENE = `[node name="Root" type="Node3D"]

[node name="Holder" type="Node3D" parent="."]

[node name="Racetrack" type="CSGPolygon3D" parent="Holder"]
mode = 2
path_node = NodePath("%Track")
path_local = true

[node name="Elsewhere" type="Node3D" parent="."]

[node name="Path3D" type="Path3D" parent="Elsewhere"]
unique_name_in_owner = true
curve = SubResource("Curve3D_road")`;

  it('resolves a %UniqueName path_node', () => {
    const scene = UNIQUE_SCENE.replace('name="Path3D" type="Path3D"', 'name="Track" type="Path3D"');
    const resolved = resolvedAt(parse(scene), 'Root/Holder/Racetrack');
    expect(resolved).toBeDefined();
    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('warns with the literal when no node claims the unique name', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    resolvedAt(parse(UNIQUE_SCENE), 'Root/Holder/Racetrack');
    expect(warn).toHaveBeenCalledTimes(1);
    // The literal as written: a resolved path would be a name no node can hold.
    expect(warn.mock.calls[0]![0]).toContain('%Track');
    expect(warn.mock.calls[0]![0]).not.toContain('Holder/Racetrack/%Track');
  });

  it('resolves a SIBLING path_node (csg.tscn:365, the Road)', () => {
    const resolved = resolvedAt(parse(SIBLING_SCENE), 'Root/Road/RoadTop');
    expect(resolved).toBeDefined();
    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('resolves a CHILD path_node (racetrack_csg.tscn:60)', () => {
    const resolved = resolvedAt(parse(CHILD_SCENE), 'Root/Racetrack');
    expect(resolved).toBeDefined();
    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('leaves baseTransform null when path_local is on', () => {
    expect(resolvedAt(parse(SIBLING_SCENE), 'Root/Road/RoadTop')!.baseTransform).toBeNull();
  });

  /** The Road under a holder at x 10, with a Path3D raised by 5, and `pathLocal` off. */
  const OFFSET_ROAD = `[node name="Root" type="Node3D"]

[node name="Road" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)

[node name="RoadTop" type="CSGPolygon3D" parent="Road"]
mode = 2
path_node = NodePath("../Path3D")
path_local = false

[node name="Path3D" type="Path3D" parent="Road"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)
curve = SubResource("Curve3D_road")`;

  it('supplies the Path3D’s GLOBAL transform when path_local is off', () => {
    // Godot uses the path's global frame as the sweep's base. The holder's translation
    // must therefore compose into the result, not just the Path3D's own.
    const base = resolvedAt(parse(OFFSET_ROAD), 'Root/Road/RoadTop')!.baseTransform;
    expect(base).not.toBeNull();
    expect(base!.origin.x).toBeCloseTo(10, 5);
    expect(base!.origin.y).toBeCloseTo(5, 5);
  });

  it('reads the transform a RemoteTransform moved the Path3D to, since paths run after transforms', () => {
    const moved = new Map([
      [
        'Root/Road/Path3D',
        {
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 0, y: 8, z: 0 },
          },
        },
      ],
    ]);
    const base = resolvedAt(patchesOf(sceneFile(OFFSET_ROAD), {}, moved), 'Root/Road/RoadTop')!.baseTransform;
    expect(base!.origin.y).toBeCloseTo(8, 5);
  });

  it('ignores a path_node that points at something other than a Path3D', () => {
    const scene = `[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Decoy")

[node name="Decoy" type="Node3D" parent="."]`;
    expect(resolvedAt(parse(scene), 'Root/Poly')).toBeUndefined();
  });

  it('ignores an unresolvable path_node', () => {
    const scene = `[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Nowhere")`;
    expect(resolvedAt(parse(scene), 'Root/Poly')).toBeUndefined();
  });

  it('ignores a Path3D whose curve has fewer than two points', () => {
    const stub = `[sub_resource type="Curve3D" id="Curve3D_road"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0),
"tilts": PackedFloat32Array(0)
}
point_count = 1`;
    expect(resolvedAt(patchesOf(sceneFile(CHILD_SCENE, stub)), 'Root/Racetrack')).toBeUndefined();
  });

  // `Curve3D::set_point_count` drops the tail after `_data` loads (curve.cpp:1455-1456),
  // so the sweep follows two points, not the three `_data` lists.
  it('sweeps only the points point_count keeps', () => {
    const truncated = CURVE.replace('point_count = 3', 'point_count = 2');
    const patches = patchesOf(sceneFile(CHILD_SCENE, truncated));
    expect(resolvedAt(patches, 'Root/Racetrack')!.curvePoints).toHaveLength(2);
  });

  // `Curve3D::_set_data` refuses a `_data` without "tilts" (curve.cpp:2280), and
  // `point_count = 3` then appends three origin points to the empty list
  // (curve.cpp:1459-1460): the sweep follows no authored point.
  it('sweeps only origin points when the curve has no "tilts"', () => {
    const noTilts = CURVE.replace(',\n"tilts": PackedFloat32Array(0, 0, 0)', '');
    const positions = resolvedAt(
      patchesOf(sceneFile(CHILD_SCENE, noTilts)),
      'Root/Racetrack'
    )!.curvePoints.map((p) => p.position);
    expect(positions).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ]);
  });

  it('does not touch polygons that are not in PATH mode', () => {
    const scene = `[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
path_node = NodePath("Path3D")

[node name="Path3D" type="Path3D" parent="Poly"]
curve = SubResource("Curve3D_road")`;
    expect(resolvedAt(parse(scene), 'Root/Poly')).toBeUndefined();
  });
});

const ROAD_FILE = 'res://road.tscn';

/** A sub-scene whose polygon sweeps along its own Path3D, whose curve is the sub-scene's own SubResource. */
const ROAD_SCENE = sceneFile(`[node name="Road" type="Node3D"]

[node name="RoadTop" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Path3D")
path_local = false

[node name="Path3D" type="Path3D" parent="."]
curve = SubResource("Curve3D_road")`);

/** A host that holds `curve`, instances {@link ROAD_FILE} as `Inst`, at x 10, and has `extra` nodes after it. */
const hostOf = (extra = '', curve = CURVE) => `[gd_scene load_steps=3 format=3]

[ext_resource type="PackedScene" path="${ROAD_FILE}" id="1_road"]

${curve}

[node name="Root" type="Node3D"]

[node name="Inst" parent="." instance=ExtResource("1_road")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)

${extra}`;

describe('resolveCsgPolygonPaths across an instance border', () => {
  it('draws the extrusion of a polygon and its Path3D that sit in an instanced scene', () => {
    const resolved = resolvedAt(patchesOf(hostOf(), { [ROAD_FILE]: ROAD_SCENE }), 'Root/Inst/RoadTop');

    expect(resolved!.curvePoints).toHaveLength(3);
    // The instance's own transform is part of the Path3D's global frame.
    expect(resolved!.baseTransform!.origin.x).toBeCloseTo(10, 5);
  });

  it('reads the curve in the scope of the file that wrote the Path3D, not the host’s', () => {
    const host = hostOf('', CURVE.replace('0, 0, -4,', '0, 0, -9,'));
    const resolved = resolvedAt(patchesOf(host, { [ROAD_FILE]: ROAD_SCENE }), 'Root/Inst/RoadTop');

    expect(resolved!.curvePoints[1]!.position.z).toBeCloseTo(-4, 5);
  });

  it('sweeps a host polygon along a Path3D inside an instance', () => {
    const polygon = `[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Inst/Path3D")
path_local = true`;
    const resolved = resolvedAt(patchesOf(hostOf(polygon), { [ROAD_FILE]: ROAD_SCENE }), 'Root/Poly');

    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('sweeps an instance’s polygon along a Path3D outside the instance', () => {
    const outside = `[node name="Path3D" type="Path3D" parent="."]
curve = SubResource("Curve3D_road")`;
    const road = ROAD_SCENE.replace('../Path3D', '../../Path3D');
    const resolved = resolvedAt(patchesOf(hostOf(outside), { [ROAD_FILE]: road }), 'Root/Inst/RoadTop');

    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('gives each instance of one sub-scene its own base transform', () => {
    const second = `[node name="Other" parent="." instance=ExtResource("1_road")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 30, 0, 0)`;
    const patches = patchesOf(hostOf(second), { [ROAD_FILE]: ROAD_SCENE });

    expect(resolvedAt(patches, 'Root/Inst/RoadTop')!.baseTransform!.origin.x).toBeCloseTo(10, 5);
    expect(resolvedAt(patches, 'Root/Other/RoadTop')!.baseTransform!.origin.x).toBeCloseTo(30, 5);
  });

  it('binds nothing while the sub-scene has not loaded', () => {
    expect(patchesOf(hostOf()).size).toBe(0);
  });
});
