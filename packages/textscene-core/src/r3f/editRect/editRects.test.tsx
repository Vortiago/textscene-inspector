import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { Rect2 } from '../../godot/math/rect2';
import { NodePathProvider } from '../contexts/NodePathContext';
import { createEditRects, EditRectsProvider, usePublishEditRect } from './editRects';

function Item({ rect }: { rect: Rect2 }) {
  usePublishEditRect(rect);
  return null;
}

function Items({ rects, shown }: { rects: ReturnType<typeof createEditRects>; shown: readonly Rect2[] }) {
  return (
    <EditRectsProvider rects={rects}>
      <NodePathProvider path="Main/Sprite">
        {shown.map((rect) => (
          <Item key={rect.x} rect={rect} />
        ))}
      </NodePathProvider>
    </EditRectsProvider>
  );
}

const FIRST: Rect2 = { x: 1, y: 0, w: 10, h: 10 };
const SECOND: Rect2 = { x: 2, y: 0, w: 20, h: 20 };

describe('usePublishEditRect', () => {
  it('publishes the rect at the item’s path until the item unmounts', () => {
    const rects = createEditRects();
    const { rerender } = render(<Items rects={rects} shown={[FIRST]} />);
    expect(rects.get('Main/Sprite')).toEqual(FIRST);

    rerender(<Items rects={rects} shown={[]} />);

    expect(rects.get('Main/Sprite')).toBeUndefined();
  });

  it('keeps the rect another item published at the same path', () => {
    const rects = createEditRects();
    const { rerender } = render(<Items rects={rects} shown={[FIRST, SECOND]} />);

    rerender(<Items rects={rects} shown={[SECOND]} />);

    expect(rects.get('Main/Sprite')).toEqual(SECOND);
  });
});
