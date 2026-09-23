/**
 * `resolveThemedIcons` (`buildSolveTree.ts`) follows `Control::get_theme_icon`
 * (`scene/gui/control.cpp:3035-3055`, `scene/theme/theme_owner.cpp:227-261`): a
 * local override wins, else the nearest ancestor or project Theme that resolves
 * `<Type>/icons/<name>`, else nothing.
 */
import { describe, expect, it } from 'vitest';
import { resolveThemedIcons } from './buildSolveTree';
import { themeResolutionScope } from '../../../resources/styles/theme/lookup';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import type { TscnNode } from '../../../parser/types';

function theme(icons: Record<string, Record<string, string>>): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    styles: {},
    icons,
    colors: {},
    constants: {},
    typeVariations: {},
    properties: {},
    resources: { externalResources: [{ id: '1', path: 'res://icon.png', type: 'Texture2D' }], internalResources: [] },
  };
}

function node(overrides?: Record<string, string>): TscnNode {
  return {
    name: 'N',
    type: 'CheckBox',
    children: [],
    properties: (overrides ? { themeOverrideIcons: overrides } : {}) as unknown as TscnNode['properties'],
  };
}

const NODE_SCOPE = { externalResources: [], internalResources: [] };

describe('resolveThemedIcons', () => {
  it('local theme_override_icons/<name> wins unconditionally over an ancestor Theme resolving the same name', () => {
    const ancestor = theme({ CheckBox: { checked: 'ExtResource("1")' } });
    const scope = themeResolutionScope('CheckBox', undefined, [ancestor], null);
    const out = resolveThemedIcons(node({ checked: 'SubResource("Local")' }), NODE_SCOPE, scope);
    expect(out.checked?.ref).toBe('SubResource("Local")');
    // Resolved in the node's own scope, not the ancestor theme's.
    expect(out.checked?.resources).toBe(NODE_SCOPE);
  });

  it('falls to the ancestor Theme chain when there is no local override, resolved in THAT theme file\'s own scope', () => {
    const ancestor = theme({ CheckBox: { checked: 'ExtResource("1")' } });
    const scope = themeResolutionScope('CheckBox', undefined, [ancestor], null);
    const out = resolveThemedIcons(node(), NODE_SCOPE, scope);
    expect(out.checked?.ref).toBe('ExtResource("1")');
    expect(out.checked?.resources).toBe(ancestor.resources);
  });

  it('the nearest ancestor Theme wins over a farther one for the same name (theme_owner.cpp:236-245: owners outer, first hit wins)', () => {
    const nearer = theme({ CheckBox: { checked: 'ExtResource("nearer")' } });
    const farther = theme({ CheckBox: { checked: 'ExtResource("farther")' } });
    const scope = themeResolutionScope('CheckBox', undefined, [nearer, farther], null);
    const out = resolveThemedIcons(node(), NODE_SCOPE, scope);
    expect(out.checked?.ref).toBe('ExtResource("nearer")');
  });

  it('is absent (not null) when neither a local override nor any Theme in the chain resolves the name', () => {
    const ancestor = theme({ CheckBox: { unchecked: 'ExtResource("1")' } });
    const scope = themeResolutionScope('CheckBox', undefined, [ancestor], null);
    const out = resolveThemedIcons(node(), NODE_SCOPE, scope);
    expect(out.checked).toBeUndefined();
    expect(Object.hasOwn(out, 'checked')).toBe(false);
  });

  it('falls to the project theme when no ancestor Theme resolves the name', () => {
    const project = theme({ CheckBox: { checked: 'ExtResource("1")' } });
    const scope = themeResolutionScope('CheckBox', undefined, [], project);
    const out = resolveThemedIcons(node(), NODE_SCOPE, scope);
    expect(out.checked?.ref).toBe('ExtResource("1")');
    expect(out.checked?.resources).toBe(project.resources);
  });
});
