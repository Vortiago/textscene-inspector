import { describe, expect, it } from 'vitest';
import { parseProjectSettings } from '../../parser/projectSettingsParser';
import { ROOT_VIEWPORT_PATH, rootViewportNode } from './rootViewportNode';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types';
import type { TscnNode } from '../../parser/types';
import { SubViewportUpdateMode } from '../../godot/scene/viewport';

const SCENE_ROOT: TscnNode = {
  rawProperties: {},
  name: 'Main',
  type: 'Node3D',
  children: [],
  properties: {},
};

function propertiesOf(node: TscnNode): SubViewportProperties {
  return node.properties as SubViewportProperties;
}

describe('rootViewportNode', () => {
  it("holds the scene's root as its one child, at the empty path", () => {
    const root = rootViewportNode(null, [SCENE_ROOT]);
    expect([root.name, root.children]).toEqual([ROOT_VIEWPORT_PATH, [SCENE_ROOT]]);
  });

  it("takes Godot's default window size with no project", () => {
    expect(propertiesOf(rootViewportNode(null, [])).size).toEqual({ x: 1152, y: 648 });
  });

  it("takes the project's window size, so a full-rect Control covers the window", () => {
    const settings = parseProjectSettings(
      ['[display]', 'window/size/viewport_width=640', 'window/size/viewport_height=360'].join('\n')
    );
    expect(propertiesOf(rootViewportNode(settings, [])).size).toEqual({ x: 640, y: 360 });
  });

  it('owns its World3D and draws every frame', () => {
    expect(propertiesOf(rootViewportNode(null, []))).toMatchObject({
      own_world_3d: true,
      render_target_update_mode: SubViewportUpdateMode.ALWAYS,
    });
  });

  it("takes the project's transparent background", () => {
    const settings = parseProjectSettings(['[rendering]', 'viewport/transparent_background=true'].join('\n'));
    expect(propertiesOf(rootViewportNode(settings, [])).transparent_bg).toBe(true);
  });
});
