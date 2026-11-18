import type { TscnNode } from '../../parser/types.js';
import type { ProjectSettings } from '../../parser/projectSettingsParser.js';
import { projectViewportSize } from '../../parser/projectSettingsParser.js';
import { parseSubViewport } from '../../nodes/viewport/subviewport/parser.js';
import { SubViewportUpdateMode } from '../../godot/scene/viewport.js';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';

const ROOT_TYPE = 'SubViewport';

/** The project settings the root takes as Viewport properties, by the property each sets. */
const ROOT_PROPERTY_SETTINGS: Readonly<Record<string, string>> = {
  msaa_2d: 'rendering/anti_aliasing/quality/msaa_2d',
  msaa_3d: 'rendering/anti_aliasing/quality/msaa_3d',
  transparent_bg: 'rendering/viewport/transparent_background',
  use_hdr_2d: 'rendering/viewport/hdr_2d',
  use_debanding: 'rendering/anti_aliasing/quality/use_debanding',
  canvas_item_default_texture_filter: 'rendering/textures/canvas_textures/default_texture_filter',
  canvas_item_default_texture_repeat: 'rendering/textures/canvas_textures/default_texture_repeat',
};

/** The root viewport over `sceneRoots`, sized and set as `settings` give it. */
export function rootViewportNode(settings: ProjectSettings | null, sceneRoots: TscnNode[]): TscnNode {
  const { width, height } = projectViewportSize(settings);
  const raw: Record<string, string> = {
    size: `Vector2i(${width}, ${height})`,
    // The root owns its World3D, and it draws every frame.
    own_world_3d: 'true',
    render_target_update_mode: String(SubViewportUpdateMode.ALWAYS),
  };
  for (const [property, setting] of Object.entries(ROOT_PROPERTY_SETTINGS)) {
    const value = settings?.[setting];
    if (value !== undefined) raw[property] = value;
  }
  const heading = { type: 'node', attributes: { name: ROOT_VIEWPORT_PATH, type: ROOT_TYPE } };
  return {
    name: ROOT_VIEWPORT_PATH,
    type: ROOT_TYPE,
    children: sceneRoots,
    rawProperties: raw,
    properties: parseSubViewport(heading, raw),
  };
}
