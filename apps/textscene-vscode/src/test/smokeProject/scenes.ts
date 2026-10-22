/**
 * The Godot project that the installed-package and web suites open. It imports only
 * plain data, so the web suite can bundle it for a browser worker.
 */

/** A scene Godot loads. */
export const CLEAN_SCENE = 'clean.tscn';

/** A scene with a reference Godot refuses, so the linter reports `dangling-resource-reference`. */
export const DANGLING_SCENE = 'dangling.tscn';

/** A resource that two scenes name, for the Find All References test. */
export const MATERIAL_FILE = 'material.tres';

/** The scenes that name {@link MATERIAL_FILE}. */
export const MATERIAL_USER_SCENES = ['table.tscn', 'chair.tscn'];

/** A scene that names {@link MATERIAL_FILE} for its mesh. */
function materialUserScene(uid: string): string {
  return [
    `[gd_scene load_steps=2 format=3 uid="uid://textscene_smoke_${uid}"]`,
    '',
    `[ext_resource type="Material" path="res://${MATERIAL_FILE}" id="1_material"]`,
    '',
    '[node name="Scene" type="Node3D"]',
    '',
  ].join('\n');
}

/** The content of each file of the project, by its path in the project. */
export const SMOKE_PROJECT_FILES: Record<string, string> = {
  'project.godot': 'config_version=5\n\n[application]\nconfig/name="smoke"\n',
  [CLEAN_SCENE]: [
    '[gd_scene format=3 uid="uid://textscene_smoke_clean"]',
    '',
    '[node name="Scene" type="Node3D"]',
    '',
  ].join('\n'),
  [MATERIAL_FILE]: '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n',
  ...Object.fromEntries(
    MATERIAL_USER_SCENES.map((scene) => [scene, materialUserScene(scene.replace('.tscn', ''))])
  ),
  [DANGLING_SCENE]: [
    '[gd_scene format=3 uid="uid://textscene_smoke_dangling"]',
    '',
    '[node name="Scene" type="Node3D"]',
    '',
    '[node name="Box" type="MeshInstance3D" parent="."]',
    'mesh = SubResource("Missing_1")',
    '',
  ].join('\n'),
};
