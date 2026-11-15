import { describe, it, expect } from 'vitest';
import { parseNode2D } from './parser';
import { formatNode2DProperties } from './propertyFormatter';
import { heading } from '../../../parser/testing/parserKit';

function canvasItemRows(properties: Record<string, string>) {
  const sections = formatNode2DProperties(parseNode2D(heading('Node2D', { name: 'N' }), properties));
  return sections.find((section) => section.title === 'CanvasItem')!.items;
}

describe('formatNode2DProperties', () => {
  it('lists Clip Children only for a clipping item', () => {
    expect(canvasItemRows({})).not.toContainEqual(expect.objectContaining({ label: 'Clip Children' }));
    expect(canvasItemRows({ clip_children: '1' })).toContainEqual({ label: 'Clip Children', value: 'ONLY' });
    expect(canvasItemRows({ clip_children: '2' })).toContainEqual({
      label: 'Clip Children',
      value: 'AND_DRAW',
    });
  });
});
