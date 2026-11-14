/** The scene-line parse of a built internal Control, through each class's own parser. */
import { describe, expect, it } from 'vitest';
import { SizeFlags } from '../../../godot/scene/control';
import type { LabelProperties } from '../../../nodes/2d/ui/label/types';
import { builtWidgetProperties, HIDDEN_LINE, parsedSceneLines, shownIf } from './sceneLines';
import '../../../parser/TscnParser';

describe('parsedSceneLines', () => {
  it("parses the lines through the class's own parser", () => {
    const label = parsedSceneLines('Label', 'L', { text: '"Hi"' }) as LabelProperties;
    expect(label.text).toBe('Hi');
  });

  it("keeps the class's constructor defaults with no line (a Label's SIZE_SHRINK_CENTER)", () => {
    expect((parsedSceneLines('Label', 'L') as LabelProperties).sizeFlagsVertical).toBe(
      SizeFlags.SHRINK_CENTER
    );
  });

  it('parses a class with no parser of its own as a base Node, as the scene parser does', () => {
    expect(parsedSceneLines('NoSuchClass', 'X', { text: '"Hi"' })).not.toHaveProperty('text');
  });
});

describe('shownIf', () => {
  it('writes the hidden line for false', () => {
    expect(shownIf(false)).toEqual(HIDDEN_LINE);
  });

  it('writes no line for true', () => {
    expect(shownIf(true)).toEqual({});
  });

  it('treats a flag left out as on', () => {
    expect(shownIf(undefined)).toEqual({});
  });
});

describe('builtWidgetProperties', () => {
  const ICONS = { close: 'close.svg' };

  it('lays the set values over the parsed lines', () => {
    const props = builtWidgetProperties(
      { type: 'Label', name: 'L', raw: { text: '"From a line"' }, properties: { text: 'Set' } },
      ICONS
    ) as LabelProperties;
    expect(props.text).toBe('Set');
  });

  it('names the theme icon with its vendored fallback', () => {
    const props = builtWidgetProperties({ type: 'Button', name: 'B', icon: 'close' }, ICONS);
    expect(props).toMatchObject({ themeIcon: { name: 'close', vendoredUrl: 'close.svg' } });
  });

  it('adds no theme icon to a widget without one', () => {
    expect(builtWidgetProperties({ type: 'Button', name: 'B' }, ICONS)).not.toHaveProperty('themeIcon');
  });
});
