/** AnimatedSprite2D property formatter: the SpriteFrames playback properties for the details panel. */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { AnimatedSprite2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

export function formatAnimatedSprite2DProperties(
  properties: AnimatedSprite2DProperties
): PropertySection[] {
  const sections: PropertySection[] = [];

  sections.push({
    title: 'Animation',
    items: [
      { label: 'Sprite Frames', value: properties.sprite_frames ?? '(none)' },
      // Godot's implicit default animation name is "default".
      { label: 'Animation', value: properties.animation ?? 'default' },
      { label: 'Frame', value: properties.frame.toString() },
    ],
  });

  const appearanceItems: PropertySection['items'] = [
    { label: 'Centered', value: properties.centered ? 'Yes' : 'No' },
    { label: 'Offset', value: `(${properties.offset.x}, ${properties.offset.y})` },
  ];
  if (properties.flip_h) appearanceItems.push({ label: 'Flip H', value: 'Yes' });
  if (properties.flip_v) appearanceItems.push({ label: 'Flip V', value: 'Yes' });
  sections.push({ title: 'Appearance', items: appearanceItems });

  sections.push(...formatNode2DProperties(properties));

  return sections;
}
