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
    expect(props.playback_process_mode).toBe(AnimationProcessMode.IDLE);
    expect(props.method_call_mode).toBe(MethodCallMode.DEFERRED);
    expect(props.playback_active).toBe(true);
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

  it('parses playback_process_mode enum — PHYSICS', () => {
    const props = parseAnimationPlayer(HEADING, { playback_process_mode: '0' });
    expect(props.playback_process_mode).toBe(AnimationProcessMode.PHYSICS);
  });

  it('parses playback_process_mode enum — MANUAL', () => {
    const props = parseAnimationPlayer(HEADING, { playback_process_mode: '2' });
    expect(props.playback_process_mode).toBe(AnimationProcessMode.MANUAL);
  });

  it('clamps out-of-range playback_process_mode to IDLE default', () => {
    const props = parseAnimationPlayer(HEADING, { playback_process_mode: '9' });
    expect(props.playback_process_mode).toBe(AnimationProcessMode.IDLE);
  });

  it('parses method_call_mode — IMMEDIATE', () => {
    const props = parseAnimationPlayer(HEADING, { method_call_mode: '1' });
    expect(props.method_call_mode).toBe(MethodCallMode.IMMEDIATE);
  });

  it('parses playback_active = false', () => {
    const props = parseAnimationPlayer(HEADING, { playback_active: 'false' });
    expect(props.playback_active).toBe(false);
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

  it('handles NaN gracefully — falls back to numeric defaults', () => {
    const props = parseAnimationPlayer(HEADING, {
      speed_scale: 'not-a-number',
      playback_default_blend_time: 'nan',
    });
    expect(props.speed_scale).toBe(1.0);
    expect(props.playback_default_blend_time).toBe(0.0);
  });
});
