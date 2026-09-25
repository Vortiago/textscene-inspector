/**
 * The animated reference and the still one are the same capture at different times, so they
 * must light a scene the same way: they emit one preview-lighting program, not two texts. Any
 * difference, such as a sun coupled to the environment or a dropped light_color, lands in a
 * compare-docs report as the previewer being wrong.
 */

import { describe, expect, it } from 'vitest';
import { PREVIEW_LIGHTING_GD } from '../../godot-ref/bootstrap.mjs';
import { godotBootstrap, godotBootstrap2D } from './godotBootstrap.mjs';

const script3D = godotBootstrap('res://x.tscn', '/tmp/frames');
const script2D = godotBootstrap2D('res://x.tscn', '/tmp/frames');

/** One top-level GDScript function's body, header included. */
function gdFunction(script, name) {
  const start = script.indexOf(`func ${name}`);
  expect(start).toBeGreaterThan(-1);
  const rest = script.slice(start);
  const end = rest.indexOf('\nfunc ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the animated 3D reference lights a scene as the still one does', () => {
  it('emits the still capture’s preview-lighting block verbatim', () => {
    expect(script3D).toContain(PREVIEW_LIGHTING_GD);
  });

  /**
   * `Node3DEditor::_update_preview_environment` derives `disable_light` from
   * `directional_light_count` and `disable_env` from `world_env_count`, each alone
   * (`editor/scene/3d/node_3d_editor_plugin.cpp:9528`), so a scene with its own WorldEnvironment
   * and no DirectionalLight3D still gets the preview sun. One early return over both swallows it.
   */
  it('gates the sun and the environment on two independent checks', () => {
    const body = gdFunction(script3D, '_apply_preview_lighting');
    expect(
      body
        .split('\n')
        .filter((line) => /^\tif /.test(line))
        .map((line) => line.trim())
    ).toEqual(['if not _contains(target, true):', 'if not _contains(target, false):']);
    expect(body).not.toMatch(/^\t+return\b/m);
  });

  // Godot's 3D editor owns the preview sun and environment; 2D lighting is the
  // scene's own, which is the rule `_render_2d` follows.
  it('leaves the 2D reference unlit', () => {
    expect(script2D).not.toContain('_apply_preview_lighting');
    expect(script2D).not.toContain('DirectionalLight3D');
  });
});

describe('interpolated paths reach GDScript as string literals', () => {
  // A quote or a backslash in a path is a syntax error that never compiles the
  // bootstrap, and the harness reports it as a scene that produced no frames.
  const nastyScene = String.raw`res://a"b\c.tscn`;
  const nastyDir = String.raw`/tmp/d"e\f`;

  it.each([
    ['3D', godotBootstrap],
    ['2D', godotBootstrap2D],
  ])('escapes the scene path and the frames directory (%s)', (_mode, build) => {
    const gd = build(nastyScene, nastyDir);
    expect(gd).toContain(String.raw`load("res://a\"b\\c.tscn")`);
    expect(gd).toContain(String.raw`"/tmp/d\"e\\f/frame_%02d.png"`);
  });
});

describe('no second copy of the shared block survives', () => {
  // Dead GDScript is text inside a template literal, so eslint cannot see it.
  it.each([
    ['3D', script3D],
    ['2D', script2D],
  ])('drops the local presence walkers (%s)', (_mode, script) => {
    expect(script).not.toContain('_has_world_environment');
    expect(script).not.toContain('_has_directional_light');
  });
});
