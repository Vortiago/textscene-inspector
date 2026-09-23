/**
 * CodeEdit's semantic rule, called directly with a hand-built `RuleContext`: `Linter` and the
 * testkit run every rule the global `ruleRegistry` holds, which depends on what other test files
 * registered. Format checks live in linterParser.test.ts.
 */

import { describe, expect, it } from 'vitest';
import type { RuleContext } from '../../../../linter/types';
import type { TscnNode, TscnScene } from '../../../../parser/types';
import { codeEditDelimiterCollisionRule } from './linter';

function makeContext(properties: Record<string, string>): RuleContext {
  const node: TscnNode = {
    name: 'MyCodeEdit',
    type: 'CodeEdit',
    children: [],
    properties,
  };
  const scene: TscnScene = { nodes: [node], externalResources: [], internalResources: [] };
  return { scene, node, properties };
}

describe('CodeEdit semantic rules', () => {
  it('errors when delimiter_strings and delimiter_comments share a start key', () => {
    const diagnostics = codeEditDelimiterCollisionRule.check(
      makeContext({
        delimiter_strings: 'PackedStringArray("# ")',
        delimiter_comments: 'PackedStringArray("# ")',
      })
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.ruleName).toBe('codeedit-delimiter-start-key-collision');
    expect(diagnostics[0]?.message).toContain('"#"');
  });

  it('warns on the Array[String]([...]) form Godot actually serialises', () => {
    // Both getters are TypedArray<String> (code_edit.cpp:2036, :2065), so this
    // is the spelling a saved scene carries.
    const diagnostics = codeEditDelimiterCollisionRule.check(
      makeContext({
        delimiter_strings: 'Array[String](["# "])',
        delimiter_comments: 'Array[String](["# "])',
      })
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('"#"');
  });

  it('warns across a mix of the two spellings', () => {
    const diagnostics = codeEditDelimiterCollisionRule.check(
      makeContext({
        delimiter_strings: 'PackedStringArray("# ")',
        delimiter_comments: 'Array[String](["# "])',
      })
    );
    expect(diagnostics).toHaveLength(1);
  });

  it('does not warn when the two properties use disjoint start keys', () => {
    const diagnostics = codeEditDelimiterCollisionRule.check(
      makeContext({
        delimiter_strings: 'PackedStringArray("\' \'")',
        delimiter_comments: 'PackedStringArray("# ")',
      })
    );
    expect(diagnostics).toEqual([]);
  });

  it('does not warn when only one of the two properties is set', () => {
    const diagnostics = codeEditDelimiterCollisionRule.check(
      makeContext({ delimiter_comments: 'PackedStringArray("# ")' })
    );
    expect(diagnostics).toEqual([]);
  });

  it('does not warn when neither property is set', () => {
    expect(codeEditDelimiterCollisionRule.check(makeContext({}))).toEqual([]);
  });

  it('compares start keys only, ignoring a differing end key', () => {
    const diagnostics = codeEditDelimiterCollisionRule.check(
      makeContext({
        delimiter_strings: 'PackedStringArray("\' \'")',
        // Same start key "'" as a (nonsensical but structurally valid) comment
        // delimiter with a different end key.
        delimiter_comments: 'PackedStringArray("\' !")',
      })
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain("\"'\"");
  });
});
