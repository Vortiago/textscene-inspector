import { describe, it, expect } from 'vitest';
import { formatAnimationPlayerProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, sectionTitled, valueOf } from '../../testing/inspectedScene';

function sections(properties: Record<string, string> = {}) {
  return sectionsOf(formatAnimationPlayerProperties, 'AnimationPlayer', properties, {
    sub: { Lib_default: 'AnimationLibrary', Lib_combat: 'AnimationLibrary' },
  });
}

describe('formatAnimationPlayerProperties', () => {
  it('lists a Playback and an Animation Libraries section', async () => {
    const titles = (await sections()).map((s) => s.title);
    expect(titles).toContain('Playback');
    expect(titles).toContain('Animation Libraries');
  });

  it('lists the speed scale the file sets', async () => {
    expect(valueOf(await sections({ speed_scale: '2.5' }), 'Speed Scale')).toBe('2.500');
  });

  it('lists the autoplay name the file sets', async () => {
    expect(valueOf(await sections({ autoplay: '&"idle"' }), 'Autoplay')).toBe('idle');
  });

  it('names an empty autoplay as none', async () => {
    expect(valueOf(await sections(), 'Autoplay')).toBe('(none)');
  });

  it('lists each library by name with its path', async () => {
    const set = await sections({
      libraries: '{\n&"": SubResource("Lib_default"),\n&"combat": SubResource("Lib_combat")\n}',
    });
    const libraries = set.find((s) => s.title.startsWith('Animation Libraries'));
    expect(libraries?.title).toBe('Animation Libraries (2)');
    expect(libraries?.items).toEqual([
      { label: '(default)', value: `${SCENE_PATH}::Lib_default` },
      { label: 'combat', value: `${SCENE_PATH}::Lib_combat` },
    ]);
  });

  it('says no library is defined when the player holds none', async () => {
    expect(sectionTitled(await sections(), 'Animation Libraries')?.items[0]?.value).toMatch(/no libraries/);
  });

  it('names the process mode', async () => {
    expect(valueOf(await sections({ callback_mode_process: '0' }), 'Process Mode')).toBe('Physics');
  });

  it('lists an inactive player as active false', async () => {
    expect(valueOf(await sections({ active: 'false' }), 'Active')).toBe('false');
  });
});
