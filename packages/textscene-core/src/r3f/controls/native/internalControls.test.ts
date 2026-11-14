/** The internal Controls module: what a class registers, built once for each parent and theme. */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from './nativeTheme';
import { TRANSFORM2D_IDENTITY } from '../../../godot/math/transform2d';
import { controlNode, solveNode } from './testing/solveNode';
import { controlProps, sortableView, type SolveNode } from './solveTree';
import { internalControlsOf, registerInternalControls } from './internalControls';

const THEME = nativeTheme(1);

registerInternalControls(
  'HostWithInternals',
  () => [
    { mode: 'front', spec: { type: 'Label', name: 'Front', properties: { name: 'Front' } } },
    {
      mode: 'back',
      spec: {
        type: 'HBoxContainer',
        name: 'Row',
        properties: { name: 'Row' },
        children: [{ type: 'Button', name: 'Ok', properties: { name: 'Ok' } }],
      },
    },
  ],
  () => new Map()
);

const PUSHED_COLOR = { r: 0.25, g: 0.5, b: 0.75, a: 1 };

registerInternalControls(
  'HostThatPushes',
  () => [
    {
      mode: 'front',
      spec: {
        type: 'LineEdit',
        name: 'Field',
        properties: { name: 'Field' },
        variation: 'InnerField',
        pushed: { colors: { font_color: PUSHED_COLOR }, fontSizes: { font_size: 28 } },
      },
    },
  ],
  () => new Map()
);

function host(type: string): SolveNode {
  return { ...solveNode(), path: 'Root/Host', node: controlNode('Host', type) };
}

describe('internalControlsOf', () => {
  it('builds one list for a parent and the sortable view its layout gets, whose promoted child is dropped', () => {
    const promoted = {
      ...solveNode(),
      path: 'Root/Host/Promoted',
      node: controlNode('Promoted', 'Control'),
      skippedTransform: TRANSFORM2D_IDENTITY,
    };
    const parent = { ...host('HostWithInternals'), children: [promoted] };
    expect(sortableView(parent)).not.toBe(parent);
    expect(internalControlsOf(sortableView(parent), THEME)).toBe(internalControlsOf(parent, THEME));
  });

  it('builds one list for each parent and theme', () => {
    const parent = host('HostWithInternals');
    expect(internalControlsOf(parent, THEME)).toBe(internalControlsOf(parent, THEME));
    expect(internalControlsOf(parent, nativeTheme(2))).not.toBe(internalControlsOf(parent, THEME));
  });

  it('gives a class that registers none an empty list', () => {
    expect(internalControlsOf(host('Panel'), THEME)).toEqual([]);
  });

  it('keeps the mode each entry is registered with', () => {
    const modes = internalControlsOf(host('HostWithInternals'), THEME).map(({ mode }) => mode);
    expect(modes).toEqual(['front', 'back']);
  });

  it('puts each internal Control at its parent path, then @ and its name', () => {
    const [, row] = internalControlsOf(host('HostWithInternals'), THEME);
    expect(row!.node.path).toBe('Root/Host/@Row');
    expect(row!.node.children.map((child) => child.path)).toEqual(['Root/Host/@Row/@Ok']);
  });
});

describe('a built internal Control', () => {
  const [field] = internalControlsOf(host('HostThatPushes'), THEME);

  it('takes an item its parent pushes over its own lookup', () => {
    expect(field!.node.colors.font_color).toEqual(PUSHED_COLOR);
  });

  it('keeps its own lookup for an item its parent does not push', () => {
    expect(field!.node.colors.font_uneditable_color).toBeDefined();
  });

  it('carries a pushed font size as its theme_override_font_sizes entry', () => {
    expect(controlProps(field!.node).themeOverrideFontSizes).toEqual({ font_size: 28 });
  });

  it("builds a Control with no scene line's defaults under its own name", () => {
    expect(controlProps(field!.node)).toMatchObject({ name: 'Field', zIndex: 0, lightMask: 1 });
  });

  it('carries the variation its constructor sets as its theme_type_variation', () => {
    expect(controlProps(field!.node).themeTypeVariation).toBe('InnerField');
  });
});
