import { describe, it, expect } from 'vitest';
import { formatAnimatedSprite2DProperties } from './propertyFormatter';
import { SCENE_PATH, sectionsOf, sectionTitled } from '../../testing/inspectedScene';

function sections(properties: Record<string, string> = {}) {
  return sectionsOf(formatAnimatedSprite2DProperties, 'AnimatedSprite2D', properties, {
    sub: { '1_frames': 'SpriteFrames' },
  });
}

describe('formatAnimatedSprite2DProperties', () => {
  it('lists the Animation section of a node that sets nothing', async () => {
    expect(sectionTitled(await sections(), 'Animation')!.items).toEqual([
      { label: 'Sprite Frames', value: '(none)' },
      { label: 'Animation', value: 'default' },
      { label: 'Frame', value: '0' },
    ]);
  });

  it('lists the SpriteFrames path, the animation name and the frame index', async () => {
    const set = await sections({ sprite_frames: 'SubResource("1_frames")', animation: '&"run"', frame: '2' });
    expect(sectionTitled(set, 'Animation')!.items).toEqual([
      { label: 'Sprite Frames', value: `${SCENE_PATH}::1_frames` },
      { label: 'Animation', value: 'run' },
      { label: 'Frame', value: '2' },
    ]);
  });

  it('lists a flip only where it is on', async () => {
    const set = await sections({ centered: 'false', offset: 'Vector2(4, -8)', flip_v: 'true' });
    expect(sectionTitled(set, 'Appearance')!.items).toEqual([
      { label: 'Centered', value: 'No' },
      { label: 'Offset', value: '(4, -8)' },
      { label: 'Flip V', value: 'Yes' },
    ]);
  });

  it('appends the Node2D transform sections', async () => {
    const set = await sections({ position: 'Vector2(8, 16)' });
    expect(sectionTitled(set, 'Position')!.items).toEqual([
      { label: 'X', value: '8.0' },
      { label: 'Y', value: '16.0' },
    ]);
    expect(sectionTitled(set, 'Rotation (degrees)')).toBeDefined();
    expect(sectionTitled(set, 'CanvasItem')).toBeDefined();
  });
});
