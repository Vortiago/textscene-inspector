/**
 * The scene of `unit-mesh-instance-3d-skinned-ribbon.tscn` as text: a ribbon mesh bound to a
 * Skeleton3D of six chained bones, for the tests that read how the skeleton skins it.
 */

export const RIBBON_BONE_Y = [0.5, -0.2, -0.2, -0.2, -0.2, -0.2];

/** The turn about Z that bone 2 carries in the file: 60 degrees. */
const RIBBON_TURN = 'Quaternion(0, 0, 0.5, 0.866025)';

const NO_TURN = 'Quaternion(0, 0, 0, 1)';

/** The bone `extraRoot` puts before the chain: a root at the origin that no bind of the ribbon addresses. */
const EXTRA_ROOT = `bones/0/name = "extra"
bones/0/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
bones/0/position = Vector3(0, 0, 0)
`;

/**
 * The `bones/*` keys of the first `count` bones of the chain. Bone 2 turns 60 degrees, and
 * `rotations` replaces the rotation of the bones it names. With `extraRoot`, a bone `extra` takes
 * index 0 and the chain `b0` to `b5` follows at indices 1 to 6, so the bone `b<i>` sits at index `i + 1`.
 */
export function ribbonBonesText(
  count = RIBBON_BONE_Y.length,
  rotations: Record<number, string> = {},
  { extraRoot = false } = {}
): string {
  const offset = extraRoot ? 1 : 0;
  const chain = RIBBON_BONE_Y.slice(0, count)
    .map((y, i) => {
      const rotation = rotations[i] ?? (i === 2 ? RIBBON_TURN : NO_TURN);
      const at = i + offset;
      const parent = i > 0 ? `bones/${at}/parent = ${at - 1}\n` : '';
      return `bones/${at}/name = "b${i}"
${parent}bones/${at}/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${y}, 0)
bones/${at}/position = Vector3(0, ${y}, 0)
bones/${at}/rotation = ${rotation}
`;
    })
    .join('');
  return extraRoot ? EXTRA_ROOT + chain : chain;
}

/**
 * The `bind/*` keys of a Skin with one bind for each of the first `count` bones of the chain.
 * `address` writes how bind `i` finds its bone: by name, or by `bone = i + 1` for a chain behind an
 * extra root. Each bind pose is the inverse of the rest of its bone, so a Skin on the right bones
 * moves nothing at the rest.
 */
export function ribbonSkinText(address: 'name' | 'index', count = RIBBON_BONE_Y.length): string {
  const binds = RIBBON_BONE_Y.slice(0, count).map((_y, i) => {
    const restY = RIBBON_BONE_Y.slice(0, i + 1).reduce((sum, y) => sum + y, 0);
    const bone = address === 'name' ? `bind/${i}/name = &"b${i}"` : `bind/${i}/bone = ${i + 1}`;
    return `${bone}\nbind/${i}/pose = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${-restY}, 0)\n`;
  });
  return `bind_count = ${count}\n${binds.join('')}`;
}

const ribbonSubResources = (skinLines: string) => `[sub_resource type="StandardMaterial3D" id="Red"]
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
${skinLines}`;

/**
 * A scene whose MeshInstance3D `Mesh` draws `mesh` and writes `meshLines`, beside a Skeleton3D of
 * `bones`, with `skinLines` in the sub-resource `Skin_1`, `extra` between the sub-resources and the
 * nodes, and `extraNodes` after them.
 */
export function ribbonScene({
  mesh = 'Ribbon',
  meshLines = 'skeleton = NodePath("../Skeleton3D")',
  bones = ribbonBonesText(),
  skinLines = '',
  extra = '',
  extraNodes = '',
} = {}): string {
  return `[gd_scene format=3]
${ribbonSubResources(skinLines)}${extra}
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${bones}
[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("${mesh}")
${meshLines}
${extraNodes}`;
}
