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
    active: true,
    autoplay: '',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    libraries: [],
    ...overrides,
  };
}

describe('formatAnimationPlayerProperties', () => {
  it('returns sections array with Playback and Animation Libraries sections', () => {
    const sections = formatAnimationPlayerProperties(makeProps());
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Playback');
    expect(titles.some((t) => t.startsWith('Animation Libraries'))).toBe(true);
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

  it('lists each library by name with its SubResource id', () => {
    const sections = formatAnimationPlayerProperties(
      makeProps({
        libraries: [
          { name: '', subResourceId: 'Lib_default' },
          { name: 'combat', subResourceId: 'Lib_combat' },
        ],
      })
    );
    const libSection = sections.find((s) => s.title.startsWith('Animation Libraries'));
    expect(libSection?.title).toBe('Animation Libraries (2)');
    const defaultItem = libSection?.items.find((i) => i.label === '(default)');
    expect(defaultItem?.value).toBe('SubResource("Lib_default")');
    const combatItem = libSection?.items.find((i) => i.label === 'combat');
    expect(combatItem?.value).toBe('SubResource("Lib_combat")');
  });

  it('shows "0 — no libraries defined" when libraries list is empty', () => {
    const sections = formatAnimationPlayerProperties(makeProps({ libraries: [] }));
    const libSection = sections.find((s) => s.title === 'Animation Libraries');
    expect(libSection?.items[0]?.value).toMatch(/no libraries/);
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
    const sections = formatAnimationPlayerProperties(makeProps({ active: false }));
    const playback = sections.find((s) => s.title === 'Playback');
    const activeItem = playback?.items.find((i) => i.label === 'Active');
    expect(activeItem?.value).toBe('false');
  });
});
