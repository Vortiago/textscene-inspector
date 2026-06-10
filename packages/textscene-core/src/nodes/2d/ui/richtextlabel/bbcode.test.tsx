import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parseBBCode } from './bbcode';

function renderBB(text: string): HTMLElement {
  return render(<div>{parseBBCode(text)}</div>).container;
}
function spanWithText(c: HTMLElement, text: string): HTMLElement | undefined {
  return [...c.querySelectorAll('span')].find((s) => s.textContent === text);
}

describe('parseBBCode', () => {
  it('renders [b] as bold', () => {
    const c = renderBB('a [b]bold[/b] b');
    expect(spanWithText(c, 'bold')?.style.fontWeight).toBe('bold');
    expect(c.textContent).toBe('a bold b');
  });

  it('renders [i] / [u] / [s]', () => {
    expect(spanWithText(renderBB('[i]x[/i]'), 'x')?.style.fontStyle).toBe('italic');
    expect(spanWithText(renderBB('[u]x[/u]'), 'x')?.style.textDecoration).toBe('underline');
    expect(spanWithText(renderBB('[s]x[/s]'), 'x')?.style.textDecoration).toBe('line-through');
  });

  it('renders a CSS-named [color]', () => {
    expect((renderBB('[color=red]x[/color]').querySelector('span') as HTMLElement).style.color).toBe(
      'red'
    );
  });

  it('renders a Godot Color() in [color]', () => {
    const span = renderBB('[color=Color(1, 0, 0, 1)]x[/color]').querySelector('span') as HTMLElement;
    expect(span.style.color).toMatch(/rgba\(255,\s*0,\s*0/);
  });

  it('merges nested tags onto one run', () => {
    const span = renderBB('[b][i]x[/i][/b]').querySelector('span') as HTMLElement;
    expect(span.style.fontWeight).toBe('bold');
    expect(span.style.fontStyle).toBe('italic');
  });

  it('drops unknown tags but keeps their inner text', () => {
    const c = renderBB('[wave amp=50]keep[/wave]');
    expect(c.textContent).toBe('keep');
    expect(c.querySelector('span')).toBeNull();
  });

  it('leaves plain text untouched (no spans)', () => {
    const c = renderBB('just text');
    expect(c.textContent).toBe('just text');
    expect(c.querySelector('span')).toBeNull();
  });
});
