import { describe, it, expect } from 'vitest';
import { formatNode2DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../testing/inspectedScene';

async function canvasItemRows(properties: Record<string, string>) {
  return sectionTitled(await sectionsOf(formatNode2DProperties, 'Node2D', properties), 'CanvasItem')!.items;
}

describe('formatNode2DProperties', () => {
  it('lists Clip Children only for a clipping item', async () => {
    expect(await canvasItemRows({})).not.toContainEqual(expect.objectContaining({ label: 'Clip Children' }));
    expect(await canvasItemRows({ clip_children: '1' })).toContainEqual({
      label: 'Clip Children',
      value: 'ONLY',
    });
    expect(await canvasItemRows({ clip_children: '2' })).toContainEqual({
      label: 'Clip Children',
      value: 'AND_DRAW',
    });
  });
});
