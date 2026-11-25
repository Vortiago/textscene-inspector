import { describe, it, expect } from 'vitest';
import { formatAnimationTreeProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, sectionTitled, valueOf } from '../../testing/inspectedScene';

function sections(properties: Record<string, string> = {}) {
  return sectionsOf(formatAnimationTreeProperties, 'AnimationTree', properties, {
    sub: { AnimSM_1: 'AnimationNodeStateMachine' },
  });
}

describe('formatAnimationTreeProperties', () => {
  it('lists an AnimationTree and an Advanced section', async () => {
    const titles = (await sections()).map((s) => s.title);
    expect(titles).toContain('AnimationTree');
    expect(titles).toContain('Advanced');
  });

  it('lists whether the tree is active', async () => {
    expect(valueOf(await sections({ active: 'true' }), 'Active')).toBe('true');
  });

  it('lists the path of the tree root the file sets', async () => {
    expect(valueOf(await sections({ tree_root: 'SubResource("AnimSM_1")' }), 'Tree Root')).toBe(
      `${SCENE_PATH}::AnimSM_1`
    );
  });

  it('names an empty tree root as none', async () => {
    expect(valueOf(await sections(), 'Tree Root')).toBe('(none)');
  });

  it('lists the path the anim_player NodePath holds', async () => {
    expect(
      valueOf(await sections({ anim_player: 'NodePath("../AnimationPlayer")' }), 'AnimationPlayer')
    ).toBe('../AnimationPlayer');
  });

  it('lists a Root Motion section when root_motion_track names a track', async () => {
    const set = await sections({ root_motion_track: 'NodePath("Skeleton3D:Root")' });
    expect(sectionTitled(set, 'Root Motion')?.items.find((i) => i.label === 'Track')?.value).toBe(
      'Skeleton3D:Root'
    );
  });

  it('lists no Root Motion section when root_motion_track is empty', async () => {
    expect(sectionTitled(await sections(), 'Root Motion')).toBeUndefined();
  });

  it('lists the audio polyphony in the Advanced section', async () => {
    const set = await sections({ audio_max_polyphony: '64' });
    expect(sectionTitled(set, 'Advanced')?.items.find((i) => i.label === 'Audio Max Polyphony')?.value).toBe(
      '64'
    );
  });

  it('names the process callback', async () => {
    expect(valueOf(await sections({ callback_mode_process: '0' }), 'Process Callback')).toBe('Physics');
  });
});
