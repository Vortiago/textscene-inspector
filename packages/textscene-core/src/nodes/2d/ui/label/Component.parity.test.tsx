/**
 * Parity: Label autowrap modes (#20) and uppercase (#44) vs Godot.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Label } from './Component';
import { parseLabel } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Label', name: 'L' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'L', type: 'Label', children: [], properties: parseLabel(heading, { text: '"hi"', ...raw }) };
}

function style(raw: Record<string, string> = {}): CSSStyleDeclaration {
  const { container } = render(<Label node={node(raw)} />);
  return (container.firstChild as HTMLElement).style;
}

describe('Label autowrap parity (#20)', () => {
  it('mode 0 / absent → no wrap (white-space: pre)', () => {
    expect(style().whiteSpace).toBe('pre');
    expect(style({ autowrap_mode: '0' }).whiteSpace).toBe('pre');
  });
  it('ARBITRARY (1) → pre-wrap + break-all', () => {
    const s = style({ autowrap_mode: '1' });
    expect(s.whiteSpace).toBe('pre-wrap');
    expect(s.wordBreak).toBe('break-all');
  });
  it('WORD (2) → pre-wrap, no forced break', () => {
    const s = style({ autowrap_mode: '2' });
    expect(s.whiteSpace).toBe('pre-wrap');
    expect(s.wordBreak).toBe('');
  });
  it('WORD_SMART (3) → pre-wrap + overflow-wrap break-word', () => {
    const s = style({ autowrap_mode: '3' });
    expect(s.whiteSpace).toBe('pre-wrap');
    expect(s.overflowWrap).toBe('break-word');
  });
});

describe('Label uppercase parity (#44)', () => {
  it('uppercase=true → text-transform: uppercase', () => {
    expect(style({ uppercase: 'true' }).textTransform).toBe('uppercase');
  });
  it('uppercase absent → no text-transform', () => {
    expect(style().textTransform).toBe('');
  });
});
