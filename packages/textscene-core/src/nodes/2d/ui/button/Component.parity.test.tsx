/**
 * Parity: Button.alignment (#21) — text alignment inside the button box.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './Component';
import { parseButton } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Button', name: 'B' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'B', type: 'Button', children: [], properties: parseButton(heading, { text: '"Go"', ...raw }) };
}

function style(raw: Record<string, string> = {}): CSSStyleDeclaration {
  const { container } = render(<Button node={node(raw)} />);
  return (container.firstChild as HTMLElement).style;
}

describe('Button alignment parity (#21)', () => {
  it('default (absent → CENTER) keeps text centered', () => {
    const s = style();
    expect(s.justifyContent).toBe('center');
    expect(s.textAlign).toBe('center');
  });
  it('LEFT (0) → flex-start / left', () => {
    const s = style({ alignment: '0' });
    expect(s.justifyContent).toBe('flex-start');
    expect(s.textAlign).toBe('left');
  });
  it('RIGHT (2) → flex-end / right', () => {
    const s = style({ alignment: '2' });
    expect(s.justifyContent).toBe('flex-end');
    expect(s.textAlign).toBe('right');
  });
});
