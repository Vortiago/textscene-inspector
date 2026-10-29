/**
 * The scene of `unit-mesh-instance-3d-skinned-ribbon.tscn` as text: a ribbon mesh bound to a
 * Skeleton3D of six chained bones, for the tests that read how the skeleton skins it.
 */

export const RIBBON_BONE_Y = [0.5, -0.2, -0.2, -0.2, -0.2, -0.2];

/** The turn about Z that bone 2 carries in the file: 60 degrees. */
const RIBBON_TURN = 'Quaternion(0, 0, 0.5, 0.866025)';

const NO_TURN = 'Quaternion(0, 0, 0, 1)';

/**
 * The `bones/*` keys of the first `count` bones of the chain. Bone 2 turns 60 degrees, and
 * `rotations` replaces the rotation of the bones it names.
 */
export function ribbonBonesText(
  count = RIBBON_BONE_Y.length,
  rotations: Record<number, string> = {}
): string {
  return RIBBON_BONE_Y.slice(0, count)
    .map((y, i) => {
      const rotation = rotations[i] ?? (i === 2 ? RIBBON_TURN : NO_TURN);
      const parent = i > 0 ? `bones/${i}/parent = ${i - 1}\n` : '';
      return `bones/${i}/name = "b${i}"
${parent}bones/${i}/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${y}, 0)
bones/${i}/position = Vector3(0, ${y}, 0)
bones/${i}/rotation = ${rotation}
`;
    })
    .join('');
}

const RIBBON_SUB_RESOURCES = `[sub_resource type="StandardMaterial3D" id="Red"]
albedo_color = Color(1, 0, 0, 1)
[sub_resource type="StandardMaterial3D" id="Overlay"]
albedo_color = Color(0, 0, 1, 1)
[sub_resource type="RibbonTrailMesh" id="Ribbon"]
shape = 0
size = 0.4
material = SubResource("Red")
[sub_resource type="BoxMesh" id="Box"]
material = SubResource("Red")
[sub_resource type="Skin" id="Skin_1"]
`;

/**
 * A scene whose MeshInstance3D `Mesh` draws `mesh` and writes `meshLines`, beside a Skeleton3D of
 * `bones`, with `extra` between the sub-resources and the nodes, and `extraNodes` after them.
 */
export function ribbonScene({
  mesh = 'Ribbon',
  meshLines = 'skeleton = NodePath("../Skeleton3D")',
  bones = ribbonBonesText(),
  extra = '',
  extraNodes = '',
} = {}): string {
  return `[gd_scene format=3]
${RIBBON_SUB_RESOURCES}${extra}
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${bones}
[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("${mesh}")
${meshLines}
${extraNodes}`;
}
