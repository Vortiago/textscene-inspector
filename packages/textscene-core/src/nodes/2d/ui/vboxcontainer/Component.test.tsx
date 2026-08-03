/**
 * <VBoxContainer> render contract: flex column, child order, separation.
 * The overlay-pipeline path (dispatch + an explicit separation override of 8)
 * is covered in r3f/controls/ControlDispatcher.test.tsx; this pins the
 * component itself — Godot's default separation (4) and document-order
 * stacking, which the pipeline test doesn't exercise.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { VBoxContainer } from './Component';
import { parseVBoxContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'VBoxContainer', name: 'Menu' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Menu',
    type: 'VBoxContainer',
    children: [],
    properties: parseVBoxContainer(heading, raw),
  };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

describe('<VBoxContainer>', () => {
  it('lays out as a flex column', () => {
    const { container } = render(<VBoxContainer node={node()} />);
    const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
    expect(div.style.display).toBe('flex');
    expect(div.style.flexDirection).toBe('column');
  });

  it('defaults separation to Godot\'s 4px gap when no theme override is set', () => {
    const { container } = render(<VBoxContainer node={node()} />);
    const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
    expect(div.style.gap).toBe('4px');
  });

  it('maps theme_override_constants/separation to the CSS gap', () => {
    const { container } = render(
      <VBoxContainer node={node({ 'theme_override_constants/separation': '12' })} />
    );
    const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
    expect(div.style.gap).toBe('12px');
  });

  it('honours separation 0 (does not fall back to the default)', () => {
    const { container } = render(
      <VBoxContainer node={node({ 'theme_override_constants/separation': '0' })} />
    );
    const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
    expect(div.style.gap).toBe('0px');
  });

  it('packs children from the start by default and for an explicit ALIGNMENT_BEGIN', () => {
    const begins: Array<Record<string, string>> = [{}, { alignment: '0' }];
    for (const raw of begins) {
      const { container } = render(<VBoxContainer node={node(raw)} />);
      const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
      expect(div.style.justifyContent).toBe('flex-start');
    }
  });

  it('maps ALIGNMENT_CENTER / ALIGNMENT_END to center / flex-end packing', () => {
    for (const [raw, expected] of [
      ['1', 'center'],
      ['2', 'flex-end'],
    ] as const) {
      const { container } = render(<VBoxContainer node={node({ alignment: raw })} />);
      const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
      expect(div.style.justifyContent).toBe(expected);
    }
  });

  it('falls back to flex-start for an out-of-range alignment', () => {
    const { container } = render(<VBoxContainer node={node({ alignment: '7' })} />);
    const div = container.querySelector('[data-control-type="VBoxContainer"]') as HTMLElement;
    expect(div.style.justifyContent).toBe('flex-start');
  });

  it('renders children in scene order as direct flex items', () => {
    const { container } = render(
      <VBoxContainer node={node()}>
        <div data-kid="first" />
        <div data-kid="second" />
        <div data-kid="third" />
      </VBoxContainer>
    );
    const kids = Array.from(container.querySelectorAll('[data-kid]')).map((el) =>
      el.getAttribute('data-kid')
    );
    expect(kids).toEqual(['first', 'second', 'third']);
  });

  it('provides the column layout kind to its subtree', () => {
    const { getByTestId } = render(
      <VBoxContainer node={node()}>
        <KindProbe />
      </VBoxContainer>
    );
    expect(getByTestId('kind').textContent).toBe('column');
  });
});
