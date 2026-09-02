/**
 * StrictTscnParser on a deprecated spelling: the validator lookup falls back
 * to the pair the engine applies, so a value the canonical setter refuses is
 * reported under the key the file carries.
 */

import { describe, it, expect } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
// The barrel, so every slice has registered its validators.
import './index.js';

const lint = (body: string) =>
  new StrictTscnParser().parse(`[gd_scene format=3]\n\n${body}\n`).errors;

describe('a transforming arm with no validator of its own', () => {
  it('Decal extents outside the size floor draws the size error under the written key', () => {
    // decal.cpp:274-276 doubles into set_size, whose `maxf(0.001)` (:34) alters
    // a negative component. The scan sees size = Vector3(-2, 2, 2).
    const errors = lint('[node name="D" type="Decal"]\nextents = Vector3(-1, 1, 1)');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.severity).toBe('error');
    expect(errors[0]!.message).toContain("'extents'");
    expect(errors[0]!.message).toContain('size = Vector3(-2, 2, 2)');
    expect(errors[0]!.message).toContain('components must be >= 0.001');
    expect(errors[0]!.code).toBe('INVALID_SIZE_VALUE');
    // Anchored on the line and the value column of the key AS WRITTEN.
    expect(errors[0]!.line).toBe(4);
    expect(errors[0]!.column).toBe('extents'.length + 3);
  });

  it('a legal Decal extents draws nothing', () => {
    expect(lint('[node name="D" type="Decal"]\nextents = Vector3(1, 1, 1)')).toEqual([]);
  });
});

describe('a pure rename with no validator of its own', () => {
  it('TileMap cell_quadrant_size = 0 draws the rendering_quadrant_size floor (tile_map.cpp:224)', () => {
    const errors = lint('[node name="T" type="TileMap"]\ncell_quadrant_size = 0');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.severity).toBe('error');
    expect(errors[0]!.message).toContain("'cell_quadrant_size'");
    expect(errors[0]!.message).toContain('rendering_quadrant_size = 0');
    expect(errors[0]!.message).toContain('must be integer 1-128');
    expect(errors[0]!.column).toBe('cell_quadrant_size'.length + 3);
  });

  it('carries the canonical validator’s tiering: the hinted ceiling warns', () => {
    const errors = lint('[node name="T" type="TileMap"]\ncell_quadrant_size = 200');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.severity).toBe('warning');
  });

  it('a legal cell_quadrant_size draws nothing', () => {
    expect(lint('[node name="T" type="TileMap"]\ncell_quadrant_size = 32')).toEqual([]);
  });
});

describe('an old spelling the slice validates itself', () => {
  it('keeps the slice’s own message, which names the written key', () => {
    const errors = lint('[node name="L" type="Label"]\nalign = 5');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("'align'");
    expect(errors[0]!.message).toContain('must be 0-3');
  });
});

describe('a bool-gated enum arm', () => {
  it('forwards an in-range member and draws nothing', () => {
    expect(lint('[node name="T" type="TextureRect"]\nexpand = true')).toEqual([]);
    // Declared on GeometryInstance3D; the canonical lookup walks the base chain.
    expect(lint('[node name="M" type="MeshInstance3D"]\nuse_in_baked_light = true')).toEqual([]);
  });

  it('a refused value is not looked up under the canonical key', () => {
    expect(lint('[node name="T" type="TextureRect"]\nexpand = false')).toEqual([]);
  });
});

/**
 * Every pure rename the table carries validates through the same fallback, so
 * one wording serves all of them: the written key, the pair the engine
 * applies, then the canonical validator's own verdict.
 */
describe('a pure rename validated through the fallback', () => {
  const applied = (key: string, canonical: string, value: string) =>
    `Property '${key}' is applied as '${canonical} = ${value}'`;

  const ROWS: [string, string, string, string, 'error' | 'warning', string, string][] = [
    // [type, old key, canonical key, refused value, severity, legal value, cite]
    ['Label', 'align', 'horizontal_alignment', '5', 'error', '1', 'label.cpp:1005 → :1065'],
    ['Label', 'valign', 'vertical_alignment', '4', 'error', '1', 'label.cpp:1002 → :1085'],
    ['RichTextLabel', 'bbcode_text', 'text', 'bold', 'error', '"[b]bold[/b]"', 'rich_text_label.cpp:7563'],
    ['PointLight2D', 'mode', 'blend_mode', '9', 'warning', '1', 'light_2d.cpp:457 → :307 hint'],
    ['NavigationRegion2D', 'navpoly', 'navigation_polygon', 'res://nav.tres', 'error', 'null', 'navigation_region_2d.cpp:361'],
    ['NavigationRegion3D', 'navmesh', 'navigation_mesh', 'res://nav.tres', 'error', 'null', 'navigation_region_3d.cpp:312'],
    ['NavigationLink2D', 'start_location', 'start_position', 'Vector2(1)', 'error', 'Vector2(1, 2)', 'navigation_link_2d.cpp:84'],
    ['NavigationLink2D', 'end_location', 'end_position', 'Vector2(1)', 'error', 'Vector2(inf, nan)', 'navigation_link_2d.cpp:88'],
    ['NavigationLink3D', 'start_location', 'start_position', 'Vector3(1, 2)', 'error', 'Vector3(1, 2, 3)', 'navigation_link_3d.cpp:223'],
    ['NavigationLink3D', 'end_location', 'end_position', 'Vector3(1, 2)', 'error', 'Vector3(inf, -inf, nan)', 'navigation_link_3d.cpp:227'],
    ['NavigationAgent2D', 'target_location', 'target_position', 'Vector2(4)', 'error', 'Vector2(4, 5)', 'navigation_agent_2d.cpp:206'],
    ['NavigationAgent2D', 'time_horizon', 'time_horizon_agents', '-1', 'error', '0', 'navigation_agent_2d.cpp:202 → :602'],
    ['NavigationAgent3D', 'target_location', 'target_position', 'Vector3(4, 5)', 'error', 'Vector3(4, 5, 6)', 'navigation_agent_3d.cpp:217'],
    ['NavigationAgent3D', 'time_horizon', 'time_horizon_agents', '-1', 'error', '0', 'navigation_agent_3d.cpp:213 → :666'],
    ['NavigationAgent3D', 'agent_height_offset', 'path_height_offset', '-101', 'warning', '-100', 'navigation_agent_3d.cpp:221 → :157 hint'],
    ['AnimatedSprite2D', 'frames', 'sprite_frames', 'res://frames.tres', 'error', 'null', 'animated_sprite_2d.cpp:617'],
    ['AnimatedSprite3D', 'frames', 'sprite_frames', 'res://frames.tres', 'error', 'null', 'sprite_3d.cpp:1495'],
    ['Bone2D', 'default_length', 'length', '0.5', 'warning', '1', 'skeleton_2d.cpp:48-49 → :88 hint'],
  ];

  it.each(ROWS)('%s.%s validates as %s (%s → %s; legal %s; %s)', (type, key, canonical, refused, severity, legal) => {
    const errors = lint(`[node name="N" type="${type}"]\n${key} = ${refused}`);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.severity).toBe(severity);
    expect(errors[0]!.message).toContain(applied(key, canonical, refused));
    expect(errors[0]!.column).toBe(key.length + 3);
    expect(lint(`[node name="N" type="${type}"]\n${key} = ${legal}`)).toEqual([]);
  });

  it('a value the arm refuses is dropped by Godot and draws nothing', () => {
    // rich_text_label.cpp:7563 forwards only a non-empty string; light_2d.cpp:457
    // only a number. resource_format_text.cpp:693-695 hands the pair to
    // `Object::set` without checking the result, so the write is silently lost.
    expect(lint('[node name="R" type="RichTextLabel"]\nbbcode_text = ""')).toEqual([]);
    expect(lint('[node name="L" type="PointLight2D"]\nmode = "add"')).toEqual([]);
  });
});
