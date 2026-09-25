/**
 * AnimationPlayer parser tests.
 *
 * Covers defaults, all parsed properties, enum clamps, clip extraction,
 * and transform inheritance.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseAnimationPlayer } from './parser';
import { AnimationProcessMode, MethodCallMode } from './types';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'AnimationPlayer', type: 'AnimationPlayer' },
};

describe('parseAnimationPlayer defaults', () => {
  it('applies Godot defaults when only the heading is supplied', () => {
    const props = parseAnimationPlayer(HEADING, {});
    expect(props.speed_scale).toBe(1.0);
    expect(props.playback_default_blend_time).toBe(0.0);
    expect(props.callback_mode_process).toBe(AnimationProcessMode.IDLE);
    expect(props.callback_mode_method).toBe(MethodCallMode.DEFERRED);
    expect(props.active).toBe(true);
    expect(props.autoplay).toBe('');
    expect(props.current_animation).toBe('');
    expect(props.current_animation_length).toBe(0.0);
    expect(props.current_animation_position).toBe(0.0);
    expect(props.libraries).toEqual([]);
  });
});

describe('parseAnimationPlayer properties', () => {
  it('parses speed_scale as float', () => {
    const props = parseAnimationPlayer(HEADING, { speed_scale: '2.5' });
    expect(props.speed_scale).toBe(2.5);
  });

  it('parses negative speed_scale (reverse playback)', () => {
    const props = parseAnimationPlayer(HEADING, { speed_scale: '-1.0' });
    expect(props.speed_scale).toBe(-1.0);
  });

  it('parses playback_default_blend_time', () => {
    const props = parseAnimationPlayer(HEADING, { playback_default_blend_time: '0.3' });
    expect(props.playback_default_blend_time).toBe(0.3);
  });

  it('parses callback_mode_process enum — PHYSICS', () => {
    const props = parseAnimationPlayer(HEADING, { callback_mode_process: '0' });
    expect(props.callback_mode_process).toBe(AnimationProcessMode.PHYSICS);
  });

  it('parses callback_mode_process enum — MANUAL', () => {
    const props = parseAnimationPlayer(HEADING, { callback_mode_process: '2' });
    expect(props.callback_mode_process).toBe(AnimationProcessMode.MANUAL);
  });

  it('clamps out-of-range callback_mode_process to IDLE default', () => {
    const props = parseAnimationPlayer(HEADING, { callback_mode_process: '9' });
    expect(props.callback_mode_process).toBe(AnimationProcessMode.IDLE);
  });

  it('parses callback_mode_method — IMMEDIATE', () => {
    const props = parseAnimationPlayer(HEADING, { callback_mode_method: '1' });
    expect(props.callback_mode_method).toBe(MethodCallMode.IMMEDIATE);
  });

  it('parses active = false', () => {
    const props = parseAnimationPlayer(HEADING, { active: 'false' });
    expect(props.active).toBe(false);
  });

  // The three `#ifndef DISABLE_DEPRECATED` keys at animation_player.cpp:54-61
  // forward into the canonical setter, so each pair is one field. Godot never
  // writes the deprecated spelling, but a 3.x scene still carries it.
  it.each([
    ['playback_process_mode', '0', 'callback_mode_process', AnimationProcessMode.PHYSICS],
    ['method_call_mode', '1', 'callback_mode_method', MethodCallMode.IMMEDIATE],
    ['playback_active', 'false', 'active', false],
  ] as const)('reads the deprecated %s into %s', (deprecated, raw, canonical, expected) => {
    const props = parseAnimationPlayer(HEADING, { [deprecated]: raw });
    expect(props[canonical]).toBe(expected);
  });

  it.each([
    ['callback_mode_process', '2', 'playback_process_mode', '0', AnimationProcessMode.MANUAL],
    ['callback_mode_method', '1', 'method_call_mode', '0', MethodCallMode.IMMEDIATE],
    ['active', 'true', 'playback_active', 'false', true],
  ] as const)('prefers %s over the deprecated %s when a scene carries both', (
    canonical,
    canonicalRaw,
    deprecated,
    deprecatedRaw,
    expected
  ) => {
    const props = parseAnimationPlayer(HEADING, {
      [canonical]: canonicalRaw,
      [deprecated]: deprecatedRaw,
    });
    expect(props[canonical]).toBe(expected);
  });

  it('strips quotes from autoplay animation name', () => {
    const props = parseAnimationPlayer(HEADING, { autoplay: '"idle"' });
    expect(props.autoplay).toBe('idle');
  });

  it('strips the Godot 4 StringName prefix from autoplay (&"spin")', () => {
    const props = parseAnimationPlayer(HEADING, { autoplay: '&"spin"' });
    expect(props.autoplay).toBe('spin');
  });

  it('strips quotes from current_animation', () => {
    const props = parseAnimationPlayer(HEADING, { current_animation: '"walk"' });
    expect(props.current_animation).toBe('walk');
  });

  it('strips a StringName/NodePath prefix from current_animation (^"walk")', () => {
    const props = parseAnimationPlayer(HEADING, { current_animation: '^"walk"' });
    expect(props.current_animation).toBe('walk');
  });

  it('parses current_animation_length and _position as floats', () => {
    const props = parseAnimationPlayer(HEADING, {
      current_animation_length: '1.5',
      current_animation_position: '0.25',
    });
    expect(props.current_animation_length).toBe(1.5);
    expect(props.current_animation_position).toBe(0.25);
  });

  it('inherits Node3D transform from base parser', () => {
    const props = parseAnimationPlayer(HEADING, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)',
    });
    expect(props.transform?.origin).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('parseAnimationPlayer library extraction', () => {
  it('captures the default `libraries/` reference with an empty name', () => {
    const props = parseAnimationPlayer(HEADING, {
      'libraries/': 'SubResource("AnimationLibrary_7v453")',
    });
    expect(props.libraries).toEqual([{ name: '', subResourceId: 'AnimationLibrary_7v453' }]);
  });

  it('captures multiple named libraries', () => {
    const props = parseAnimationPlayer(HEADING, {
      'libraries/': 'SubResource("Lib_default")',
      'libraries/combat': 'SubResource("Lib_combat")',
    });
    expect(props.libraries).toContainEqual({ name: '', subResourceId: 'Lib_default' });
    expect(props.libraries).toContainEqual({ name: 'combat', subResourceId: 'Lib_combat' });
  });

  it('returns empty libraries array when no `libraries/` properties exist', () => {
    const props = parseAnimationPlayer(HEADING, { autoplay: '"idle"' });
    expect(props.libraries).toEqual([]);
  });

  it('ignores library refs with an unparseable SubResource value', () => {
    const props = parseAnimationPlayer(HEADING, { 'libraries/': 'null' });
    expect(props.libraries).toEqual([]);
  });

  // Godot 4 serialises libraries as a single Dictionary property, possibly multi-line:
  //   libraries = { "": SubResource("AnimationLibrary_x") }
  it('captures the default library from the Godot 4 dictionary form', () => {
    const props = parseAnimationPlayer(HEADING, {
      libraries: '{\n"": SubResource("AnimationLibrary_fggt1")\n}',
    });
    expect(props.libraries).toEqual([{ name: '', subResourceId: 'AnimationLibrary_fggt1' }]);
  });

  it('captures multiple named libraries from the dictionary form', () => {
    const props = parseAnimationPlayer(HEADING, {
      libraries: '{\n"": SubResource("Lib_default"),\n"combat": SubResource("Lib_combat")\n}',
    });
    expect(props.libraries).toContainEqual({ name: '', subResourceId: 'Lib_default' });
    expect(props.libraries).toContainEqual({ name: 'combat', subResourceId: 'Lib_combat' });
  });

  it('ignores ExtResource (external/binary) entries in the dictionary form', () => {
    // External `.res` libraries are binary and cannot be resolved. Only inline
    // SubResource libraries are captured.
    const props = parseAnimationPlayer(HEADING, {
      libraries: '{\n"": ExtResource("4_eruca")\n}',
    });
    expect(props.libraries).toEqual([]);
  });

  it('ignores ExtResource (external/binary) entries in the slash form', () => {
    // The slash-form regex only matches `SubResource("id")`; an
    // ExtResource-valued `libraries/` key is silently dropped, same as the
    // dictionary form above.
    const props = parseAnimationPlayer(HEADING, {
      'libraries/': 'ExtResource("1_lib")',
    });
    expect(props.libraries).toEqual([]);
  });

  it('handles NaN gracefully — falls back to numeric defaults', () => {
    const props = parseAnimationPlayer(HEADING, {
      speed_scale: 'not-a-number',
      playback_default_blend_time: 'nan',
    });
    expect(props.speed_scale).toBe(1.0);
    expect(props.playback_default_blend_time).toBe(0.0);
  });

  it('reads no Node3D field: an AnimationPlayer is a Node (node_3d.cpp:150)', () => {
    const props = parseAnimationPlayer(HEADING, { visible: 'false', position: 'Vector3(1, 2, 3)' });
    expect('visible' in props).toBe(false);
    expect('position' in props).toBe(false);
  });
});
