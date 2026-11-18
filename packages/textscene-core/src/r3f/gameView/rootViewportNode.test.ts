import { describe, expect, it } from 'vitest';
import { parseProjectSettings } from '../../parser/projectSettingsParser';
import { rootViewportNode } from './rootViewportNode';
import { rootWindow } from './rootWindow';
import type { ProjectSettings } from '../../parser/projectSettingsParser';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext';
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

/** The root over `roots` at the project's own window. */
function nodeFor(settings: ProjectSettings | null, roots: TscnNode[]): TscnNode {
  return rootViewportNode(settings, rootWindow(settings), roots);
}

describe('rootViewportNode', () => {
  it("holds the scene's root as its one child, at the empty path", () => {
    const root = nodeFor(null, [SCENE_ROOT]);
    expect([root.name, root.children]).toEqual([ROOT_VIEWPORT_PATH, [SCENE_ROOT]]);
  });

  it("takes Godot's default window size with no project", () => {
    expect(propertiesOf(nodeFor(null, [])).size).toEqual({ x: 1152, y: 648 });
  });

  it("takes the project's window size, so a full-rect Control covers the window", () => {
    const settings = parseProjectSettings(
      ['[display]', 'window/size/viewport_width=640', 'window/size/viewport_height=360'].join('\n')
    );
    expect(propertiesOf(nodeFor(settings, [])).size).toEqual({ x: 640, y: 360 });
  });

  it('renders at the stretched target and lays its canvas out in the 2D override', () => {
    const settings = parseProjectSettings(
      [
        '[display]',
        'window/size/window_width_override=800',
        'window/size/window_height_override=800',
        'window/stretch/mode="canvas_items"',
      ].join('\n')
    );
    expect(propertiesOf(nodeFor(settings, []))).toMatchObject({
      size: { x: 800, y: 450 },
      size_2d_override: { x: 1152, y: 648 },
      size_2d_override_stretch: true,
    });
  });

  it('writes the 2D override in its raw properties too, so a re-parse lays out the same', () => {
    const settings = parseProjectSettings(
      ['[display]', 'window/size/window_width_override=800', 'window/stretch/mode="canvas_items"'].join('\n')
    );
    expect(nodeFor(settings, []).rawProperties.size_2d_override).toBe('Vector2(1152, 648)');
  });

  it('owns its World3D and draws every frame', () => {
    expect(propertiesOf(nodeFor(null, []))).toMatchObject({
      own_world_3d: true,
      render_target_update_mode: SubViewportUpdateMode.ALWAYS,
    });
  });

  it("takes the project's transparent background", () => {
    const settings = parseProjectSettings(['[rendering]', 'viewport/transparent_background=true'].join('\n'));
    expect(propertiesOf(nodeFor(settings, [])).transparent_bg).toBe(true);
  });
});
