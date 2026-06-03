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
    expect(props.clips).toEqual([]);
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

  it('strips quotes from current_animation', () => {
    const props = parseAnimationPlayer(HEADING, { current_animation: '"walk"' });
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

describe('parseAnimationPlayer clip extraction', () => {
  it('extracts clip names from anims/* keys', () => {
    const props = parseAnimationPlayer(HEADING, {
      'anims/idle': 'SubResource("Animation_idle")',
      'anims/walk': 'SubResource("Animation_walk")',
      'anims/run': 'SubResource("Animation_run")',
    });
    expect(props.clips).toHaveLength(3);
    const names = props.clips.map((c) => c.name);
    expect(names).toContain('idle');
    expect(names).toContain('walk');
    expect(names).toContain('run');
  });

  it('returns empty clips array when no anims/* properties exist', () => {
    const props = parseAnimationPlayer(HEADING, { libraries: 'SubResource("1")' });
    expect(props.clips).toEqual([]);
  });

  it('ignores non-anims/* keys while extracting clips', () => {
    const props = parseAnimationPlayer(HEADING, {
      'anims/idle': 'SubResource("Animation_idle")',
      autoplay: '"idle"',
      speed_scale: '1.0',
    });
    expect(props.clips).toHaveLength(1);
    expect(props.clips[0]?.name).toBe('idle');
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
