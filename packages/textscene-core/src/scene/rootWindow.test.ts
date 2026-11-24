import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import { variant } from './variant';
import type { ResourceProvider } from '../resources/ResourceProvider';

const MAIN = 'res://main.tscn';

const LEVEL = `[gd_scene format=3]

[node name="Level" type="Node2D"]
`;

const SIZED_PROJECT = `config_version=5

[display]

window/size/viewport_width=800
window/size/viewport_height=600
window/size/window_width_override=1000
window/size/window_height_override=700
`;

const filesOf = (files: Record<string, string>): ResourceProvider => ({
  loadResource: async (path) => files[path] ?? null,
});

const rootWindowOf = (files: Record<string, string>) =>
  openScene({ source: LEVEL, provider: filesOf(files), rootScenePath: MAIN }).getNode('/root');

// Each answer is measured in Godot 4.6.3 on the root window of a project with these settings.
describe('the root window', () => {
  it('scales its content to the viewport size of the project, not the window override', async () => {
    const root = rootWindowOf({ 'res://project.godot': SIZED_PROJECT });
    await vi.waitFor(async () =>
      expect(await root.get('content_scale_size')).toEqual(variant('Vector2i(800, 600)'))
    );
  });

  it('scales its content to 1152 by 648 in a project that sets no size', async () => {
    const root = rootWindowOf({ 'res://project.godot': 'config_version=5\n' });
    expect(await root.get('content_scale_size')).toEqual(variant('Vector2i(1152, 648)'));
  });

  it('refuses a property this release does not port', async () => {
    await expect(rootWindowOf({}).get('size')).rejects.toThrow(
      'expected content_scale_size of the root window, got size: its other properties are not in this release'
    );
  });
});
