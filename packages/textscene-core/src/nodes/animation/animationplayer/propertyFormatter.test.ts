/**
 * AnimationPlayer propertyFormatter tests.
 */

import { describe, it, expect } from 'vitest';
import { formatAnimationPlayerProperties } from './propertyFormatter';
import type { AnimationPlayerProperties } from './types';
import { AnimationProcessMode, MethodCallMode } from './types';

function makeProps(overrides: Partial<AnimationPlayerProperties> = {}): AnimationPlayerProperties {
  return {
    name: 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    playback_process_mode: AnimationProcessMode.IDLE,
    method_call_mode: MethodCallMode.DEFERRED,
    playback_active: true,
    autoplay: '',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    clips: [],
    ...overrides,
  };
}

describe('formatAnimationPlayerProperties', () => {
  it('returns sections array with Playback and Clips sections', () => {
    const sections = formatAnimationPlayerProperties(makeProps());
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Playback');
    expect(titles.some((t) => t.startsWith('Clips'))).toBe(true);
  });

  it('shows speed_scale in Playback section', () => {
    const sections = formatAnimationPlayerProperties(makeProps({ speed_scale: 2.5 }));
    const playback = sections.find((s) => s.title === 'Playback');
    const speedItem = playback?.items.find((i) => i.label === 'Speed Scale');
    expect(speedItem?.value).toBe('2.500');
  });

  it('shows autoplay name when set', () => {
    const sections = formatAnimationPlayerProperties(makeProps({ autoplay: 'idle' }));
    const playback = sections.find((s) => s.title === 'Playback');
    const autoItem = playback?.items.find((i) => i.label === 'Autoplay');
    expect(autoItem?.value).toBe('idle');
  });

  it('shows (none) for empty autoplay', () => {
    const sections = formatAnimationPlayerProperties(makeProps({ autoplay: '' }));
    const playback = sections.find((s) => s.title === 'Playback');
    const autoItem = playback?.items.find((i) => i.label === 'Autoplay');
    expect(autoItem?.value).toBe('(none)');
  });

  it('lists each clip by name when clips are present', () => {
    const sections = formatAnimationPlayerProperties(
      makeProps({
        clips: [{ name: 'idle' }, { name: 'walk' }, { name: 'run' }],
      })
    );
    const clipsSection = sections.find((s) => s.title.startsWith('Clips'));
    expect(clipsSection?.title).toBe('Clips (3)');
    const values = clipsSection?.items.map((i) => i.value) ?? [];
    expect(values).toContain('idle');
    expect(values).toContain('walk');
    expect(values).toContain('run');
  });

  it('shows "0 — no animations defined" when clips list is empty', () => {
    const sections = formatAnimationPlayerProperties(makeProps({ clips: [] }));
    const clipsSection = sections.find((s) => s.title === 'Clips');
    expect(clipsSection?.items[0]?.value).toMatch(/no animations/);
  });

  it('shows process mode as human-readable string', () => {
    const sections = formatAnimationPlayerProperties(
      makeProps({ playback_process_mode: AnimationProcessMode.PHYSICS })
    );
    const playback = sections.find((s) => s.title === 'Playback');
    const modeItem = playback?.items.find((i) => i.label === 'Process Mode');
    expect(modeItem?.value).toBe('Physics');
  });

  it('shows active = false correctly', () => {
    const sections = formatAnimationPlayerProperties(makeProps({ playback_active: false }));
    const playback = sections.find((s) => s.title === 'Playback');
    const activeItem = playback?.items.find((i) => i.label === 'Active');
    expect(activeItem?.value).toBe('false');
  });
});
