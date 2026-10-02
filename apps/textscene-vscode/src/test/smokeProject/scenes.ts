/**
 * The Godot project that the installed-package and web suites open. It imports only
 * plain data, so the web suite can bundle it for a browser worker.
 */

/** A scene Godot loads. */
export const CLEAN_SCENE = 'clean.tscn';

/** A scene with a reference Godot refuses, so the linter reports `dangling-resource-reference`. */
export const DANGLING_SCENE = 'dangling.tscn';

/** The content of each file of the project, by its path in the project. */
export const SMOKE_PROJECT_FILES: Record<string, string> = {
  'project.godot': 'config_version=5\n\n[application]\nconfig/name="smoke"\n',
  [CLEAN_SCENE]: [
    '[gd_scene format=3 uid="uid://textscene_smoke_clean"]',
    '',
    '[node name="Scene" type="Node3D"]',
    '',
  ].join('\n'),
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
