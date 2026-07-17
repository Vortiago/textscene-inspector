/**
 * <HBoxContainer> render contract: flex row, Godot's default 4px separation,
 * and the 'row' layout kind. Mirrors the VBoxContainer contract on the other
 * axis. The dispatch/nesting path is covered in ControlDispatcher.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HBoxContainer } from './Component';
import { parseHBoxContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'HBoxContainer', name: 'Row' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Row', type: 'HBoxContainer', children: [], properties: parseHBoxContainer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderRow(raw: Record<string, string> = {}) {
  const { container } = render(<HBoxContainer node={node(raw)} />);
  return container.querySelector('[data-control-type="HBoxContainer"]') as HTMLElement;
}

describe('<HBoxContainer>', () => {
  it('lays out as a flex row', () => {
    const div = renderRow();
    expect(div.style.display).toBe('flex');
    expect(div.style.flexDirection).toBe('row');
  });

  it("defaults separation to Godot's 4px gap, and honours an explicit 0", () => {
    expect(renderRow().style.gap).toBe('4px');
    expect(renderRow({ 'theme_override_constants/separation': '0' }).style.gap).toBe('0px');
    expect(renderRow({ 'theme_override_constants/separation': '12' }).style.gap).toBe('12px');
  });

  it('packs children from the start by default and for an explicit ALIGNMENT_BEGIN', () => {
    expect(renderRow().style.justifyContent).toBe('flex-start');
    expect(renderRow({ alignment: '0' }).style.justifyContent).toBe('flex-start');
  });

  it('maps ALIGNMENT_CENTER / ALIGNMENT_END to center / flex-end packing', () => {
    expect(renderRow({ alignment: '1' }).style.justifyContent).toBe('center');
    expect(renderRow({ alignment: '2' }).style.justifyContent).toBe('flex-end');
  });

  it('falls back to flex-start for an out-of-range alignment', () => {
    expect(renderRow({ alignment: '7' }).style.justifyContent).toBe('flex-start');
  });

  it('stays hidden when visible = false — the container flex display must not override it', () => {
    expect(renderRow({ visible: 'false' }).style.display).toBe('none');
  });

  it('provides the row layout kind to its subtree', () => {
    const { getByTestId } = render(
      <HBoxContainer node={node()}>
        <KindProbe />
      </HBoxContainer>
    );
    expect(getByTestId('kind').textContent).toBe('row');
  });
});
