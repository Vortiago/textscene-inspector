/**
 * AnimationTree propertyFormatter tests.
 */

import { describe, it, expect } from 'vitest';
import { formatAnimationTreeProperties } from './propertyFormatter';
import type { AnimationTreeProperties } from './types';
import { AnimationTreeProcessMode, CallbackModeDiscrete, CallbackModeMethod } from './types';

function makeProps(overrides: Partial<AnimationTreeProperties> = {}): AnimationTreeProperties {
  return {
    name: 'AnimationTree',
    active: false,
    parameters: {},
    anim_player: 'NodePath("..")',
    process_callback: AnimationTreeProcessMode.IDLE,
    callback_mode_process: AnimationTreeProcessMode.IDLE,
    callback_mode_method: CallbackModeMethod.DEFERRED,
    callback_mode_discrete: CallbackModeDiscrete.DOMINANT,
    root_motion_track: 'NodePath("")',
    advance_expression_base_node: 'NodePath("..")',
    audio_max_polyphony: 32,
    root_node: 'NodePath("..")',
    deterministic: false,
    reset_on_save: true,
    root_motion_local: false,
    ...overrides,
  };
}

describe('formatAnimationTreeProperties', () => {
  it('returns sections with AnimationTree section', () => {
    const sections = formatAnimationTreeProperties(makeProps());
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('AnimationTree');
    expect(titles).toContain('Advanced');
  });

  it('shows active status', () => {
    const sections = formatAnimationTreeProperties(makeProps({ active: true }));
    const main = sections.find((s) => s.title === 'AnimationTree');
    const activeItem = main?.items.find((i) => i.label === 'Active');
    expect(activeItem?.value).toBe('true');
  });

  it('shows tree_root when set', () => {
    const sections = formatAnimationTreeProperties(
      makeProps({ tree_root: 'SubResource("AnimSM_1")' })
    );
    const main = sections.find((s) => s.title === 'AnimationTree');
    const rootItem = main?.items.find((i) => i.label === 'Tree Root');
    expect(rootItem?.value).toBe('SubResource("AnimSM_1")');
  });

  it('shows (none) for undefined tree_root', () => {
    const sections = formatAnimationTreeProperties(makeProps({ tree_root: undefined }));
    const main = sections.find((s) => s.title === 'AnimationTree');
    const rootItem = main?.items.find((i) => i.label === 'Tree Root');
    expect(rootItem?.value).toBe('(none)');
  });

  it('extracts NodePath value for AnimationPlayer display', () => {
    const sections = formatAnimationTreeProperties(
      makeProps({ anim_player: 'NodePath("../AnimationPlayer")' })
    );
    const main = sections.find((s) => s.title === 'AnimationTree');
    const playerItem = main?.items.find((i) => i.label === 'AnimationPlayer');
    expect(playerItem?.value).toBe('../AnimationPlayer');
  });

  it('shows Root Motion section when root_motion_track is non-empty', () => {
    const sections = formatAnimationTreeProperties(
      makeProps({ root_motion_track: 'NodePath("Skeleton3D:Root")' })
    );
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Root Motion');
    const rmSection = sections.find((s) => s.title === 'Root Motion');
    expect(rmSection?.items.find((i) => i.label === 'Track')?.value).toBe('Skeleton3D:Root');
  });

  it('omits Root Motion section when root_motion_track is empty NodePath', () => {
    const sections = formatAnimationTreeProperties(
      makeProps({ root_motion_track: 'NodePath("")' })
    );
    const titles = sections.map((s) => s.title);
    expect(titles).not.toContain('Root Motion');
  });

  it('shows audio_max_polyphony in Advanced section', () => {
    const sections = formatAnimationTreeProperties(makeProps({ audio_max_polyphony: 64 }));
    const adv = sections.find((s) => s.title === 'Advanced');
    const polyItem = adv?.items.find((i) => i.label === 'Audio Max Polyphony');
    expect(polyItem?.value).toBe('64');
  });

  it('shows process callback as human-readable string', () => {
    const sections = formatAnimationTreeProperties(
      makeProps({ process_callback: AnimationTreeProcessMode.PHYSICS })
    );
    const main = sections.find((s) => s.title === 'AnimationTree');
    const cbItem = main?.items.find((i) => i.label === 'Process Callback');
    expect(cbItem?.value).toBe('Physics');
  });
});
