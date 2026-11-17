import { describe, expect, it } from 'vitest';
import { meshProjectFiles } from './godotMeshScenes.mjs';
import { MESH_SCENES } from './meshScenes.mjs';

describe('meshProjectFiles', () => {
  it('writes each scene and its shader file, which the scene names', () => {
    const files = meshProjectFiles(MESH_SCENES.slice(0, 1));
    const [scene] = JSON.parse(files['meshes.json']);
    expect(scene.shader).toBe('res://mesh_0.gdshader');
    expect(files['mesh_0.gdshader']).toBe(MESH_SCENES[0].source);
  });
});
