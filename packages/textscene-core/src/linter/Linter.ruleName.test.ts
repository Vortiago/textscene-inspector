/**
 * Linter: the rule name each strict-parser diagnostic carries. A validator's
 * diagnostic names its property as `format:<key>`, with the key as the file
 * writes it, and a syntax or heading error keeps `strict-parser`.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from './testing/testkit.js';
import { formatErrorsOf, warningsOf } from './testing/tierLists.js';
import './index.js';

function ruleNames(content: string): string[] {
  return lint(content).map((d) => d.ruleName);
}

describe('a validator diagnostic', () => {
  it('names the refused property', () => {
    const content = scene(node('Node2D', { position: 'Vector2(nope)' }, { name: 'Root' }));

    expect(ruleNames(content)).toEqual(['format:position']);
  });

  it('names the property in a [sub_resource] body', () => {
    const content = scene(subResource('Environment', { background_mode: 99 }), node('Node3D'));

    expect(ruleNames(content)).toEqual(['format:background_mode']);
  });

  it('names the property in a .tres [resource] body', () => {
    const content = '[gd_resource type="Environment" format=3]\n\n[resource]\nbackground_mode = 99\n';

    expect(ruleNames(content)).toEqual(['format:background_mode']);
  });

  it('names a deprecated spelling as the file writes it, not the key it resolves to', () => {
    const content = scene(node('Label', { align: 5 }));

    expect(ruleNames(content)).toEqual(['format:align']);
  });

  it('names an indexed-family key whole, index included', () => {
    const content = scene(node('ItemList', { item_count: 1, 'item_0/text': 5 }));

    expect(ruleNames(content)).toEqual(['format:item_0/text']);
  });

  it('names the property of a nil-conversion warning', () => {
    const content = scene(node('Control', { texture_filter: 'null' }));

    expect(warningsOf(lint(content)).map((d) => d.ruleName)).toEqual(['format:texture_filter']);
  });
});

describe('a diagnostic no property owns', () => {
  it('keeps strict-parser for a malformed property line', () => {
    const content = scene('[node name="Root" type="Node3D"]\nfoo bar');

    expect(ruleNames(content)).toEqual(['strict-parser']);
  });

  it('keeps strict-parser for a heading without name=', () => {
    const content = scene('[node type="Node2D"]');

    expect(ruleNames(content)).toEqual(['strict-parser']);
  });
});

describe("the format checks' selector", () => {
  it('finds a validator refusal, so a filter on it never matches nothing', () => {
    const content = scene(node('Node2D', { position: 'Vector2(nope)' }, { name: 'Root' }));

    expect(formatErrorsOf(lint(content))).toHaveLength(1);
  });
});
