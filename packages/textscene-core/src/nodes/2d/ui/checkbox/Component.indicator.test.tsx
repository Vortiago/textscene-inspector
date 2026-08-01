/**
 * A CheckBox draws its check indicator — the thing the node exists for.
 *
 * We rendered the label text and nothing else, so a checked and an unchecked
 * CheckBox were pixel-identical and the binary state survived only in a
 * `data-checked` attribute no user can see. 28 CheckBox nodes across the
 * vendored demos rendered as bare text.
 *
 * Godot draws the icon unconditionally on every draw (`check_box.cpp`
 * NOTIFICATION_DRAW), to the LEFT of the text and vertically centred, picking
 * the `radio_*` icons instead when the node belongs to a `button_group`.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CheckBox } from './Component';
import { TscnParser } from '../../../../parser/TscnParser';
import type { TscnNode } from '../../../../parser/types';

function node(body = ''): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Box" type="CheckBox"]\n${body}`
  );
  return scene.nodes[0]!;
}

function renderBox(body = '') {
  const n = node(body);
  const { container } = render(<CheckBox node={n} path={n.name} />);
  return container;
}

function indicator(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-check-indicator]');
}

describe('<CheckBox> indicator', () => {
  it('always draws an indicator, checked or not', () => {
    expect(indicator(renderBox())).not.toBeNull();
    expect(indicator(renderBox('button_pressed = true\n'))).not.toBeNull();
  });

  it('renders a checked box visually differently from an unchecked one', () => {
    const unchecked = indicator(renderBox())!;
    const checked = indicator(renderBox('button_pressed = true\n'))!;
    expect(checked.outerHTML).not.toBe(unchecked.outerHTML);
    expect(checked.dataset.checkIndicator).toBe('checked');
    expect(unchecked.dataset.checkIndicator).toBe('unchecked');
  });

  it('places the indicator before the label text', () => {
    const container = renderBox('text = "Enabled"\n');
    const root = container.firstElementChild as HTMLElement;
    expect(root.textContent).toContain('Enabled');
    expect(root.firstElementChild).toBe(indicator(container));
  });

  it('draws a round radio indicator when the box belongs to a button_group', () => {
    const grouped = indicator(renderBox('button_group = SubResource("ButtonGroup_1")\n'))!;
    const plain = indicator(renderBox())!;
    expect(grouped.dataset.checkStyle).toBe('radio');
    expect(plain.dataset.checkStyle).toBe('check');
  });
});
