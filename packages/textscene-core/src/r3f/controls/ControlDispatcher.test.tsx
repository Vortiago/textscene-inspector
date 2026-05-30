/**
 * 2D-overlay rendering pipeline: ControlOverlay/ControlDispatcher → nested DOM
 * with computed layout + StyleBox. Consumes a NESTED Control subtree (as the
 * SceneGraph produces and the shell will pass in 2D mode) — the same contract
 * NodeDispatcher has for 3D. Parsers are covered by their own tests; here we
 * feed already-parsed ControlProperties to exercise dispatch + components.
 * Importing ./index registers the DOM components.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { TscnNode } from '../../parser/types';
import { ControlOverlay } from './index';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

// UIRoot (Control, full-rect) > Menu (VBox, sep 8) > [Title (Label), Bg (ColorRect)]
const tree: TscnNode[] = [
  node('UIRoot', 'Control', { anchorsPreset: 15 }, [
    node('Menu', 'VBoxContainer', { anchorsPreset: 8, themeOverrideConstants: { separation: 8 } }, [
      node('Title', 'Label', {
        text: 'Hello',
        themeOverrideFontSizes: { font_size: 18 },
        themeOverrideColors: { font_color: { r: 0.2, g: 0.18, b: 0.12, a: 1 } },
      }),
      node('Bg', 'ColorRect', { color: 'Color(0, 0, 1, 1)' }),
    ]),
  ]),
];

function styleOf(el: Element | null): CSSStyleDeclaration {
  return (el as HTMLElement).style;
}

describe('Control overlay rendering pipeline', () => {
  // Render fresh per test — @testing-library auto-unmounts after each test.
  let container: HTMLElement;
  beforeEach(() => {
    container = render(<ControlOverlay nodes={tree} />).container;
  });

  it('renders the FULL_RECT Control root as absolute inset-0', () => {
    const root = container.querySelector('[data-control-type="Control"][data-node-name="UIRoot"]');
    expect(root).toBeTruthy();
    expect(styleOf(root).position).toBe('absolute');
    expect(styleOf(root).left).toBe('0px');
    expect(styleOf(root).right).toBe('0px');
  });

  it('renders VBoxContainer as a flex column with separation → gap', () => {
    const vbox = container.querySelector('[data-control-type="VBoxContainer"]');
    expect(vbox).toBeTruthy();
    expect(styleOf(vbox).display).toBe('flex');
    expect(styleOf(vbox).flexDirection).toBe('column');
    expect(styleOf(vbox).gap).toBe('8px');
  });

  it('renders the Label text + font overrides, as a flex item of the column', () => {
    const label = container.querySelector('[data-control-type="Label"]');
    expect(label?.textContent).toBe('Hello');
    expect(styleOf(label).fontSize).toBe('18px');
    expect(styleOf(label).color).toMatch(/51,\s*46,\s*31/);
    expect(styleOf(label).position).toBe('relative'); // container child
  });

  it('renders the ColorRect fill color', () => {
    const rect = container.querySelector('[data-control-type="ColorRect"]');
    expect(rect).toBeTruthy();
    expect(styleOf(rect).backgroundColor).toMatch(/0,\s*0,\s*255/);
  });

  it('renders the full nesting (Control > VBox > Label + ColorRect)', () => {
    const vbox = container.querySelector('[data-control-type="VBoxContainer"]');
    expect(vbox?.querySelector('[data-control-type="Label"]')).toBeTruthy();
    expect(vbox?.querySelector('[data-control-type="ColorRect"]')).toBeTruthy();
  });
});
