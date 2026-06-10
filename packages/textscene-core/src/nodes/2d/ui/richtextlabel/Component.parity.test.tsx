/**
 * Parity: RichTextLabel.fit_content (#45) — shrink height to content.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RichTextLabel } from './Component';
import { parseRichTextLabel } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'RichTextLabel', name: 'R' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'R',
    type: 'RichTextLabel',
    children: [],
    properties: parseRichTextLabel(heading, { text: '"hi"', ...raw }),
  };
}

function style(raw: Record<string, string> = {}): CSSStyleDeclaration {
  const { container } = render(<RichTextLabel node={node(raw)} />);
  return (container.firstChild as HTMLElement).style;
}

describe('RichTextLabel fit_content parity (#45)', () => {
  it('fit_content=true → height shrinks to content (fit-content, visible overflow)', () => {
    const s = style({ fit_content: 'true' });
    expect(s.height).toBe('fit-content');
    expect(s.overflow).toBe('visible');
  });
  it('fit_content absent → no fit-content height override', () => {
    expect(style().height).not.toBe('fit-content');
  });
});
