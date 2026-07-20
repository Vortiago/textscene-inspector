/**
 * AnimationTree parser tests.
 *
 * Covers defaults, all parsed properties, enum clamps, and transform
 * inheritance.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseAnimationTree } from './parser';
import { AnimationTreeProcessMode, CallbackModeDiscrete, CallbackModeMethod } from './types';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'AnimationTree', type: 'AnimationTree' },
};

describe('parseAnimationTree defaults', () => {
  it('applies Godot defaults when only the heading is supplied', () => {
    const props = parseAnimationTree(HEADING, {});
    // AnimationMixer.active defaults to TRUE and is omitted at its default.
    expect(props.active).toBe(true);
    expect(props.tree_root).toBeUndefined();
    expect(props.process_callback).toBe(AnimationTreeProcessMode.IDLE);
    expect(props.callback_mode_process).toBe(AnimationTreeProcessMode.IDLE);
    expect(props.callback_mode_method).toBe(CallbackModeMethod.DEFERRED);
    // AnimationTree OVERRIDES two AnimationMixer defaults (its class XML marks
    // both `overrides="AnimationMixer"`): FORCE_CONTINUOUS instead of the
    // mixer's RECESSIVE, and deterministic true instead of false.
    expect(props.callback_mode_discrete).toBe(CallbackModeDiscrete.FORCE_CONTINUOUS);
    expect(props.audio_max_polyphony).toBe(32);
    expect(props.deterministic).toBe(true);
    expect(props.advance_expression_base_node).toBe('NodePath(".")');
    expect(props.reset_on_save).toBe(true);
    expect(props.root_motion_local).toBe(false);
  });
});

describe('parseAnimationTree properties', () => {
  it('parses active = true', () => {
    const props = parseAnimationTree(HEADING, { active: 'true' });
    expect(props.active).toBe(true);
  });

  it('preserves tree_root resource reference verbatim', () => {
    const props = parseAnimationTree(HEADING, {
      tree_root: 'SubResource("AnimationNodeStateMachine_1")',
    });
    expect(props.tree_root).toBe('SubResource("AnimationNodeStateMachine_1")');
  });

  it('leaves tree_root undefined when absent', () => {
    const props = parseAnimationTree(HEADING, {});
    expect(props.tree_root).toBeUndefined();
  });

  it('preserves anim_player NodePath verbatim', () => {
    const props = parseAnimationTree(HEADING, {
      anim_player: 'NodePath("../AnimationPlayer")',
    });
    expect(props.anim_player).toBe('NodePath("../AnimationPlayer")');
  });

  it('parses process_callback enum — PHYSICS', () => {
    const props = parseAnimationTree(HEADING, { process_callback: '0' });
    expect(props.process_callback).toBe(AnimationTreeProcessMode.PHYSICS);
  });

  it('parses process_callback enum — MANUAL', () => {
    const props = parseAnimationTree(HEADING, { process_callback: '2' });
    expect(props.process_callback).toBe(AnimationTreeProcessMode.MANUAL);
  });

  it('clamps out-of-range process_callback to IDLE default', () => {
    const props = parseAnimationTree(HEADING, { process_callback: '9' });
    expect(props.process_callback).toBe(AnimationTreeProcessMode.IDLE);
  });

  it('parses callback_mode_method — IMMEDIATE', () => {
    const props = parseAnimationTree(HEADING, { callback_mode_method: '1' });
    expect(props.callback_mode_method).toBe(CallbackModeMethod.IMMEDIATE);
  });

  it('parses callback_mode_discrete — FORCE_CONTINUOUS', () => {
    const props = parseAnimationTree(HEADING, { callback_mode_discrete: '2' });
    expect(props.callback_mode_discrete).toBe(CallbackModeDiscrete.FORCE_CONTINUOUS);
  });

  it('parses audio_max_polyphony as integer', () => {
    const props = parseAnimationTree(HEADING, { audio_max_polyphony: '64' });
    expect(props.audio_max_polyphony).toBe(64);
  });

  it('parses boolean flags', () => {
    const props = parseAnimationTree(HEADING, {
      deterministic: 'true',
      reset_on_save: 'false',
      root_motion_local: 'true',
    });
    expect(props.deterministic).toBe(true);
    expect(props.reset_on_save).toBe(false);
    expect(props.root_motion_local).toBe(true);
  });

  it('collects parameters/* into a parameters map keyed without the prefix', () => {
    const props = parseAnimationTree(HEADING, {
      'parameters/gun/blend_amount': '0.0',
      'parameters/scale/scale': '1.5',
      'parameters/state/current': '&"walk"',
      active: 'true',
    });
    expect(props.parameters).toEqual({
      'gun/blend_amount': '0.0',
      'scale/scale': '1.5',
      'state/current': '&"walk"',
    });
  });

  it('defaults parameters to an empty map when none are authored', () => {
    const props = parseAnimationTree(HEADING, {});
    expect(props.parameters).toEqual({});
  });

  it('inherits Node3D transform from base parser', () => {
    const props = parseAnimationTree(HEADING, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)',
    });
    expect(props.transform?.origin).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('handles NaN gracefully — falls back to integer default', () => {
    const props = parseAnimationTree(HEADING, { audio_max_polyphony: 'not-a-number' });
    expect(props.audio_max_polyphony).toBe(32);
  });
});
