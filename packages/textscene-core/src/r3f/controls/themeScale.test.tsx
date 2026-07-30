/**
 * `gui/theme/default_theme_scale` reaching the Controls, across the slices that
 * paint default-theme chrome.
 *
 * Godot applies the scale when it BUILDS the default theme —
 * `scene/theme/default_theme.cpp`, `fill_default_theme`:
 *
 *     theme->set_default_font_size(Math::round(default_font_size * scale));
 *
 * so what changes is the theme's own metrics, never the scene's. The rule that
 * is easy to break and invisible in a render: a THEME OVERRIDE is not scaled —
 * Godot returns `theme_override_constants/*` and `theme_override_font_sizes/*`
 * exactly as authored, and only the FALLBACK comes from the theme.
 * `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn` leans on both halves at
 * once: its VBoxContainer sets `separation = 13` while its Label takes the
 * scaled `default_font_size`.
 *
 * happy-dom has no cascade or layout (ADR-0024), so these assert the INLINE
 * style each component writes, never a laid-out box. The rendered-metric gate
 * is `verify:raster`.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { TscnNode } from '../../parser/types';
import { FileEventBus } from '../../resources/FileEventBus';
import { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { ProjectSettingsProvider } from '../contexts/ProjectSettingsContext';
import { ControlOverlay } from './index';

const PROJECT_AT_SCALE_2 = '[gui]\n\ntheme/default_theme_scale=2.0\n';

function node(name: string, type: string, properties: object = {}): TscnNode {
  return { name, type, children: [], properties: { name, ...properties } } as TscnNode;
}

/**
 * Mount Controls under a project. `project = null` is a scene with no
 * `project.godot` — the scale-1 case every other fixture is in.
 */
function renderAtScale(nodes: TscnNode[], project: string | null): HTMLElement {
  const provider: ResourceProvider = {
    loadResource: vi.fn(async (path: string) => {
      if (project !== null && path === 'res://project.godot') return project;
      throw new Error(`Resource not found: ${path}`);
    }),
  };
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);

  return render(
    <ResourceLoaderProvider loader={loader}>
      <ProjectSettingsProvider sceneKey="res://scene.tscn">
        <ControlOverlay nodes={nodes} />
      </ProjectSettingsProvider>
    </ResourceLoaderProvider>
  ).container;
}

function find(container: HTMLElement, type: string): HTMLElement {
  return container.querySelector(`[data-control-type="${type}"]`) as HTMLElement;
}
function all(container: HTMLElement, type: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[data-control-type="${type}"]`)];
}

describe('default_theme_scale reaches the Controls', () => {
  it('scales the Label font size — round(16 * 2.0) = 32', async () => {
    const c = renderAtScale([node('Label', 'Label', { text: 'SubViewport is rendered on Quad' })], PROJECT_AT_SCALE_2);
    await waitFor(() => expect(find(c, 'Label').style.fontSize).toBe('32px'));
  });

  it('leaves a font-size OVERRIDE alone while the scale applies elsewhere', async () => {
    const c = renderAtScale(
      [
        node('Plain', 'Label', { text: 'plain' }),
        node('Overridden', 'Label', { text: 'over', themeOverrideFontSizes: { font_size: 11 } }),
      ],
      PROJECT_AT_SCALE_2
    );
    await waitFor(() => expect(all(c, 'Label')[0]!.style.fontSize).toBe('32px'));
    // The scene said 11; Godot returns an override verbatim.
    expect(all(c, 'Label')[1]!.style.fontSize).toBe('11px');
  });

  it('leaves a scene without a project.godot at Godot’s scale-1 metrics', async () => {
    const c = renderAtScale(
      [node('Label', 'Label', { text: 'plain' }), node('Button', 'Button', { text: 'A button!' })],
      null
    );
    await waitFor(() => expect(find(c, 'Label').style.fontSize).toBe('16px'));
    expect(find(c, 'Button').style.padding).toBe('4px');
    expect(find(c, 'Button').style.borderRadius).toBe('3px');
  });

  it('scales the Button’s content margin, corner radius and font size', async () => {
    const c = renderAtScale([node('Button', 'Button', { text: 'A button!' })], PROJECT_AT_SCALE_2);
    await waitFor(() => expect(find(c, 'Button').style.fontSize).toBe('32px'));
    expect(find(c, 'Button').style.padding).toBe('8px'); // round(4 * 2)
    expect(find(c, 'Button').style.borderRadius).toBe('6px'); // round(3 * 2)
  });

  it('scales the Panel’s corner radius', async () => {
    const c = renderAtScale([node('Panel', 'Panel')], PROJECT_AT_SCALE_2);
    await waitFor(() => expect(find(c, 'Panel').style.borderRadius).toBe('6px'));
  });

  it('scales the PanelContainer’s corner radius and content margin', async () => {
    const c = renderAtScale([node('Box', 'PanelContainer')], PROJECT_AT_SCALE_2);
    await waitFor(() => expect(find(c, 'PanelContainer').style.borderRadius).toBe('6px'));
    expect(find(c, 'PanelContainer').style.padding).toBe('8px');
  });

  it('scales the OptionButton’s 8/4 content margins to 16/8', async () => {
    const c = renderAtScale(
      [node('OptionButton', 'OptionButton', { selected: 0, items: [{ text: 'Item 0' }] })],
      PROJECT_AT_SCALE_2
    );
    await waitFor(() => expect(find(c, 'OptionButton').style.fontSize).toBe('32px'));
    expect(find(c, 'OptionButton').style.padding).toBe('8px 16px');
  });

  it('scales a box container’s theme separation but NOT its separation override', async () => {
    const c = renderAtScale(
      [
        node('Plain', 'VBoxContainer'),
        node('Overridden', 'VBoxContainer', { themeOverrideConstants: { separation: 13 } }),
      ],
      PROJECT_AT_SCALE_2
    );
    // round(4 * 2) = 8 for the theme default…
    await waitFor(() => expect(all(c, 'VBoxContainer')[0]!.style.gap).toBe('8px'));
    // …and the demo scene's `theme_override_constants/separation = 13` verbatim.
    expect(all(c, 'VBoxContainer')[1]!.style.gap).toBe('13px');
  });

  it('scales every text Control together, so none is left at the inherited size', async () => {
    // Label, RichTextLabel and CheckBox all draw at the theme's
    // `default_font_size`; before the scale was read they agreed only because
    // every ancestor happened to sit at 16px. One of them left inheriting would
    // render 16 next to the others' 32 — a mismatch no scale-1 fixture can show.
    const c = renderAtScale(
      [
        node('Label', 'Label', { text: 'label' }),
        node('Rich', 'RichTextLabel', { text: 'rich' }),
        node('Check', 'CheckBox', { text: 'check' }),
      ],
      PROJECT_AT_SCALE_2
    );
    await waitFor(() => expect(find(c, 'Label').style.fontSize).toBe('32px'));
    expect(find(c, 'RichTextLabel').style.fontSize).toBe('32px');
    expect(find(c, 'CheckBox').style.fontSize).toBe('32px');
  });

  it('keeps RichTextLabel’s normal_font_size override verbatim', async () => {
    const c = renderAtScale(
      [node('Rich', 'RichTextLabel', { text: 'rich', themeOverrideFontSizes: { normal_font_size: 9 } })],
      PROJECT_AT_SCALE_2
    );
    await waitFor(() => expect(find(c, 'RichTextLabel').style.fontSize).toBe('9px'));
  });

  it('scales the HBoxContainer and GridContainer separations too', async () => {
    const c = renderAtScale(
      [node('Row', 'HBoxContainer'), node('Grid', 'GridContainer', { columns: 2 })],
      PROJECT_AT_SCALE_2
    );
    await waitFor(() => expect(find(c, 'HBoxContainer').style.gap).toBe('8px'));
    expect(find(c, 'GridContainer').style.columnGap).toBe('8px');
    expect(find(c, 'GridContainer').style.rowGap).toBe('8px');
  });
});
