/**
 * HSplitContainer parsing. The layout math is `shared/splitContainer.test.ts`;
 * these pin that the three SplitContainer properties reach it at all, and that
 * the Control base still comes through.
 */

import { describe, expect, it } from 'vitest';

import { TscnParser } from '../../../../parser/TscnParser';
import type { HSplitContainerProperties } from './types';

function parse(body: string): HSplitContainerProperties {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Split" type="HSplitContainer"]\n${body}`
  );
  return scene.nodes[0]!.properties as HSplitContainerProperties;
}

describe('parseHSplitContainer', () => {
  it('parses the three SplitContainer properties', () => {
    const props = parse('split_offset = 60\ncollapsed = true\ndragger_visibility = 2\n');
    expect(props.splitOffset).toBe(60);
    expect(props.collapsed).toBe(true);
    expect(props.draggerVisibility).toBe(2);
  });

  it('leaves them undefined when unauthored, so the Godot defaults apply', () => {
    const props = parse('');
    expect(props.splitOffset).toBeUndefined();
    expect(props.collapsed).toBeUndefined();
    expect(props.draggerVisibility).toBeUndefined();
  });

  it('carries the Control base through, including theme overrides', () => {
    const props = parse('offset_right = 400.0\ntheme_override_constants/separation = 0\n');
    expect(props.offsetRight).toBe(400);
    expect(props.themeOverrideConstants?.separation).toBe(0);
  });

  it('ignores a malformed split_offset rather than producing NaN', () => {
    expect(parse('split_offset = "wide"\n').splitOffset).toBeUndefined();
  });
});
