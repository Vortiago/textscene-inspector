/**
 * VSplitContainer parsing. Shares its base with HSplitContainer, so this pins
 * the wiring rather than re-testing the base: a slice registered against the
 * wrong parser would still parse Control and silently drop the three
 * SplitContainer properties.
 */

import { describe, expect, it } from 'vitest';

import { TscnParser } from '../../../../parser/TscnParser';
import type { VSplitContainerProperties } from './types';

function parse(body: string): VSplitContainerProperties {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Split" type="VSplitContainer"]\n${body}`
  );
  return scene.nodes[0]!.properties as VSplitContainerProperties;
}

describe('parseVSplitContainer', () => {
  it('parses the three SplitContainer properties', () => {
    const props = parse('split_offset = -40\ncollapsed = false\ndragger_visibility = 1\n');
    expect(props.splitOffset).toBe(-40);
    expect(props.collapsed).toBe(false);
    expect(props.draggerVisibility).toBe(1);
  });

  it('leaves them undefined when unauthored', () => {
    const props = parse('');
    expect(props.splitOffset).toBeUndefined();
    expect(props.collapsed).toBeUndefined();
  });

  it('carries the Control base through', () => {
    expect(parse('offset_bottom = 300.0\n').offsetBottom).toBe(300);
  });
});
