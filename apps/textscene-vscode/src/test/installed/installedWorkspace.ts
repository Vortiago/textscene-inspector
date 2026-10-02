/**
 * The Godot project the installed-package suite opens. The launcher writes it before
 * VS Code starts, because a folder created later never becomes a workspace folder.
 */

import * as fs from 'fs';
import * as path from 'path';

/** A scene Godot loads. */
export const CLEAN_SCENE = 'clean.tscn';

/** A scene with a reference Godot refuses, so the linter reports `dangling-resource-reference`. */
export const DANGLING_SCENE = 'dangling.tscn';

const FILES: Record<string, string> = {
  'project.godot': 'config_version=5\n\n[application]\nconfig/name="installed"\n',
  [CLEAN_SCENE]: [
    '[gd_scene format=3 uid="uid://textscene_installed_clean"]',
    '',
    '[node name="Scene" type="Node3D"]',
    '',
  ].join('\n'),
  [DANGLING_SCENE]: [
    '[gd_scene format=3 uid="uid://textscene_installed_dangling"]',
    '',
    '[node name="Scene" type="Node3D"]',
    '',
    '[node name="Box" type="MeshInstance3D" parent="."]',
    'mesh = SubResource("Missing_1")',
    '',
  ].join('\n'),
};

/** Writes the project into `workspaceRoot`, which must not exist yet. */
export function writeInstalledWorkspace(workspaceRoot: string): void {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  for (const [name, content] of Object.entries(FILES)) {
    fs.writeFileSync(path.join(workspaceRoot, name), content);
  }
}
