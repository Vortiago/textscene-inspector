/**
 * <ColorRect> render contract: `color` → div background CSS.
 * The overlay-pipeline path (dispatch + nesting) is covered in
 * r3f/controls/ControlDispatcher.test.tsx; this pins the component itself,
 * including the no-color default that the pipeline test doesn't exercise.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ColorRect } from './Component';
import { parseColorRect } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'ColorRect', name: 'Rect' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Rect',
    type: 'ColorRect',
    children: [],
    properties: parseColorRect(heading, raw),
  };
}

function renderRect(raw: Record<string, string> = {}) {
  const { container } = render(<ColorRect node={node(raw)} />);
  return container.querySelector('[data-control-type="ColorRect"]') as HTMLElement;
}

describe('<ColorRect>', () => {
  it('maps the color property to the div background', () => {
    const div = renderRect({ color: 'Color(0, 0, 1, 1)' });
    expect(div.style.backgroundColor).toBe('rgba(0, 0, 255, 1)');
  });

  it('preserves the color alpha channel in the CSS rgba()', () => {
    const div = renderRect({ color: 'Color(1, 0, 0, 0.5)' });
    expect(div.style.backgroundColor).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('paints Godot opaque white when color is absent', () => {
    // The parser supplies Godot's Color(1, 1, 1, 1) default; a ColorRect that
    // writes no `color` is a solid white rect in Godot, not an invisible one.
    const div = renderRect();
    expect(div.style.backgroundColor).toBe('rgba(255, 255, 255, 1)');
  });

  it('tags the div with the node name and renders children inside', () => {
    const { container } = render(
      <ColorRect node={node({ color: 'Color(0, 1, 0, 1)' })}>
        <span data-testid="kid">hi</span>
      </ColorRect>
    );
    const div = container.querySelector('[data-control-type="ColorRect"]') as HTMLElement;
    expect(div.getAttribute('data-node-name')).toBe('Rect');
    expect(div.querySelector('[data-testid="kid"]')?.textContent).toBe('hi');
  });
});
