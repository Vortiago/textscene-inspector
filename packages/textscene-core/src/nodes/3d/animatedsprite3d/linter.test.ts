/**
 * Tests for AnimatedSprite3D's semantic rule.
 *
 * Deliberately does NOT go through `Linter` (`../../../linter/testing/testkit`
 * builds one, which imports the whole barrel of every registered node type —
 * unusable while 8+ sibling slices are being written concurrently this wave).
 * Instead this calls the registered rule directly with a hand-built
 * `RuleContext`, the same isolation `linterParser.test.ts` gets from
 * `validatorRegistry.findValidator` instead of parsing a `.tscn`.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '../../../linter/RuleRegistry';
import type { RuleContext } from '../../../linter/types';
import type { TscnNode, TscnScene } from '../../../parser/types';
import './linter';

const RULE_NAME = 'valid-animatedsprite3d-properties';

/** Build a minimal RuleContext for one AnimatedSprite3D node with the given raw properties. */
function context(properties: Record<string, string>): RuleContext {
  const node: TscnNode = {
    name: 'MyAnimatedSprite3D',
    type: 'AnimatedSprite3D',
    children: [],
    properties: properties as unknown as Record<string, unknown>,
  };
  const scene: TscnScene = { nodes: [node], externalResources: [], internalResources: [] };
  return { scene, node, properties: node.properties };
}

/** Run AnimatedSprite3D's registered rule against a raw property bag. */
function lint(properties: Record<string, string>) {
  const rule = ruleRegistry.getRule(RULE_NAME);
  expect(rule, `rule '${RULE_NAME}' is not registered`).toBeDefined();
  return rule!.check(context(properties));
}

describe('AnimatedSprite3D semantic rule', () => {
  it('registers under the applicable node type', () => {
    const rule = ruleRegistry.getRule(RULE_NAME);
    expect(rule?.meta.applicableNodeTypes).toEqual(['AnimatedSprite3D']);
  });

  describe('requires-spriteframes', () => {
    it('warns when sprite_frames is absent', () => {
      const diagnostics = lint({});
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          ruleName: 'animatedsprite3d-requires-spriteframes',
        })
      );
    });

    it('stays quiet when sprite_frames is set', () => {
      const diagnostics = lint({ sprite_frames: 'SubResource("frames_1")' });
      expect(diagnostics.some((d) => d.ruleName === 'animatedsprite3d-requires-spriteframes')).toBe(
        false
      );
    });
  });

  describe('animation-no-spriteframes', () => {
    it('warns when animation is set without sprite_frames', () => {
      const diagnostics = lint({ animation: '&"walk"' });
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          ruleName: 'animatedsprite3d-animation-no-spriteframes',
        })
      );
    });

    it('stays quiet when both animation and sprite_frames are set', () => {
      const diagnostics = lint({ animation: '&"walk"', sprite_frames: 'SubResource("frames_1")' });
      expect(
        diagnostics.some((d) => d.ruleName === 'animatedsprite3d-animation-no-spriteframes')
      ).toBe(false);
    });
  });

  it('produces zero diagnostics for a fully-configured node', () => {
    expect(
      lint({
        sprite_frames: 'SubResource("frames_1")',
        animation: '&"walk"',
        autoplay: '"walk"',
        frame: '1',
        frame_progress: '0.5',
        speed_scale: '1.5',
      })
    ).toEqual([]);
  });
});
