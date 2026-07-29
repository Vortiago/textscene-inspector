/**
 * LineEdit render + registration contract (ADR-0003). The distinguishing render
 * facts are the ones Godot's draw path decides and a naive box would get wrong:
 * the placeholder is drawn in `font_placeholder_color` (alpha 0.6) rather than
 * the normal font colour, a non-editable field swaps BOTH its stylebox and its
 * font colour, and `flat` drops the background entirely.
 *
 * happy-dom has no CSS cascade or layout (ADR-0024) — these read inline style
 * properties the component sets directly, never a computed rect.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import './index'; // parser registration side effect
import './index.r3f'; // DOM-overlay component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import {
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_PLACEHOLDER_COLOR,
  DEFAULT_FONT_COLOR,
  STYLE_NORMAL_FILL,
} from '../../../../r3f/controls/godotDefaultTheme';
import { parseLineEdit } from './parser';
import { LineEdit } from './Component';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'LineEdit', name: 'F' } };
function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'F', type: 'LineEdit', children: [], properties: parseLineEdit(heading, raw) };
}
function renderField(raw: Record<string, string> = {}) {
  const result = render(
    <SceneResourcesProvider internalResources={[]}>
      <LineEdit node={node(raw)} />
    </SceneResourcesProvider>
  );
  const root = result.container.querySelector('[data-control-type="LineEdit"]') as HTMLElement;
  return { ...result, root };
}

describe('LineEdit registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('LineEdit');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseLineEdit);
  });

  it('registers the DOM-overlay component in the control registry', () => {
    expect(controlComponentRegistry.get('LineEdit')).toBe(LineEdit);
  });
});

describe('LineEdit render contract', () => {
  it('draws the placeholder, dimmed, when there is no text', () => {
    const { container, root } = renderField({ placeholder_text: '"Enter text here..."' });
    expect(container.textContent).toContain('Enter text here...');
    expect(container.querySelector('[data-line-edit-text="placeholder"]')).not.toBeNull();
    expect(root.style.color).toBe(CONTROL_FONT_PLACEHOLDER_COLOR);
  });

  it('draws the text at full font colour, and NOT the placeholder, when text is set', () => {
    const { container, root } = renderField({ text: '"Ada"', placeholder_text: '"Enter text here..."' });
    expect(container.textContent).toContain('Ada');
    expect(container.textContent).not.toContain('Enter text here...');
    expect(root.style.color).toBe(DEFAULT_FONT_COLOR);
  });

  it('wears the normal stylebox fill with its 2px bottom border', () => {
    const { root } = renderField();
    expect(root.style.backgroundColor).toBe(STYLE_NORMAL_FILL);
    expect(root.style.borderBottomWidth).toBe('2px');
  });

  it('swaps to the read-only stylebox and the uneditable font colour', () => {
    const { root } = renderField({ text: '"locked"', editable: 'false' });
    expect(root.style.color).toBe(CONTROL_FONT_DISABLED_COLOR);
    expect(root.style.backgroundColor).not.toBe(STYLE_NORMAL_FILL);
  });

  it('drops the background entirely when flat is set', () => {
    const { root } = renderField({ text: '"bare"', flat: 'true' });
    expect(root.style.backgroundColor).toBe('');
    expect(root.style.borderBottomWidth).toBe('');
  });

  it('honours a theme_override font size and colour', () => {
    const { root } = renderField({
      text: '"big"',
      'theme_override_font_sizes/font_size': '28',
      'theme_override_colors/font_color': 'Color(1, 0, 0, 1)',
    });
    expect(root.style.fontSize).toBe('28px');
    expect(root.style.color).toBe('rgba(255, 0, 0, 1)');
  });

  it('maps alignment to the flex packing, treating FILL as LEFT', () => {
    expect(renderField({ alignment: '1' }).root.style.justifyContent).toBe('center');
    expect(renderField({ alignment: '2' }).root.style.justifyContent).toBe('flex-end');
    expect(renderField({ alignment: '3' }).root.style.justifyContent).toBe('flex-start');
  });

  it('floors the width at minimum_character_width so a field with no width still shows', () => {
    // `minimum_character_width` (4) times the 'W' advance, plus the stylebox's
    // 4px margins each side. Without it a free-anchored LineEdit whose offsets
    // give it no width collapses, where Godot draws a box.
    expect(renderField().root.style.minWidth).toBe('calc(4em + 8px)');
  });

  it('takes the MAX with custom_minimum_size, as get_combined_minimum_size does', () => {
    const { root } = renderField({ custom_minimum_size: 'Vector2(240, 0)' });
    expect(root.style.minWidth).toBe('max(calc(4em + 8px), 240px)');
  });

  it('keeps a hidden field hidden — its own styles must not overwrite display:none', () => {
    expect(renderField({ visible: 'false' }).root.style.display).toBe('none');
  });
});
