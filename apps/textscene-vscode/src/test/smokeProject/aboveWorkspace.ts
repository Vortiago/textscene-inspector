import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SMOKE_PROJECT_FILES } from './scenes';

export const ABOVE_WORKSPACE_FOLDER_NAME = 'Scene subfolder';
export const ABOVE_WORKSPACE_SCENE = 'sprite.tscn';
export const ABOVE_WORKSPACE_TEXTURE = 'icon.png';

const GREEN_TEXTURE =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGMwuJ/xnxLMMGrAqAGjBgwXAwAEAXYflGaTUAAAAABJRU5ErkJggg==';

export function writeAboveWorkspaceSmokeProject(project: string) {
  const workspace = join(project, 'scenes');
  const scene = join(workspace, ABOVE_WORKSPACE_SCENE);
  const texture = join(project, ABOVE_WORKSPACE_TEXTURE);
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(project, 'project.godot'), SMOKE_PROJECT_FILES['project.godot']!);
  writeFileSync(texture, Buffer.from(GREEN_TEXTURE, 'base64'));
  writeFileSync(
    scene,
    [
      '[gd_scene load_steps=2 format=3]',
      '',
      `[ext_resource type="Texture2D" path="res://${ABOVE_WORKSPACE_TEXTURE}" id="1"]`,
      '',
      '[node name="Sprite" type="Sprite2D"]',
      'texture = ExtResource("1")',
      'scale = Vector2(8, 8)',
      '',
    ].join('\n')
  );
  return { workspace, scene, texture };
}
