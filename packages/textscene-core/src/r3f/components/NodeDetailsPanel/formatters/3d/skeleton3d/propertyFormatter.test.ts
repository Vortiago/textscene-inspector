import { describe, expect, it } from 'vitest';
import { formatSkeleton3DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

describe('formatSkeleton3DProperties', () => {
  it('lists the bone count and show_rest_only in a Skeleton3D section ahead of the Node3D ones', async () => {
    const sections = await sectionsOf(formatSkeleton3DProperties, 'Skeleton3D', {
      'bones/0/name': '"a"',
      'bones/1/name': '"b"',
      show_rest_only: 'true',
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)',
    });

    expect(sections[0]).toEqual({
      title: 'Skeleton3D',
      items: [
        { label: 'Bones', value: '2' },
        { label: 'Show Rest Only', value: 'true' },
      ],
    });
    expect(sectionTitled(sections, 'Position')).toBeDefined();
  });

  it('counts no bone for a skeleton that adds none', async () => {
    const [section] = await sectionsOf(formatSkeleton3DProperties, 'Skeleton3D');

    expect(section!.items[0]).toEqual({ label: 'Bones', value: '0' });
  });
});
