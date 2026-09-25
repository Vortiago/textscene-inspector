/**
 * Godot's marker for "override the node already at this path". Both node creators,
 * `parseNodeWithRegistry` and `StrictTscnParser`, must agree with the one predicate,
 * or what renders and what lints diverge.
 */

import { describe, expect, it } from 'vitest';
import { isPropertyOverrideHeading, parseHeading } from './utils';
import type { TscnNode } from './types';
import { parseNodeWithRegistry } from '../core/NodeRegistry';
import { StrictTscnParser } from '../linter/StrictTscnParser';
// Importing the parser is what registers every slice's node parser, so the
// registry path is exercised rather than only the type-less fallback.
import './TscnParser';

const heading = (line: string) => parseHeading(line)!;

describe('isPropertyOverrideHeading', () => {
  it('is true for a type-less, instance-less node — Godot writes overrides that way', () => {
    // `index=` is an addressing hint the editor writes alongside; it declares
    // nothing, so it does not make the heading a declaration.
    expect(
      isPropertyOverrideHeading(
        heading('[node name="Robot" parent="Player/Skeleton/Skeleton3D" index="0"]')
      )
    ).toBe(true);
    expect(
      isPropertyOverrideHeading(heading('[node name="Robot" parent="Player/Skeleton"]'))
    ).toBe(true);
  });

  it('is false when the heading declares a type — that adds a new node', () => {
    expect(
      isPropertyOverrideHeading(heading('[node name="CoinCount" type="Label3D" parent="Player"]'))
    ).toBe(false);
  });

  it('is false when the heading instances a scene', () => {
    expect(
      isPropertyOverrideHeading(heading('[node name="Player" parent="." instance=ExtResource("3")]'))
    ).toBe(false);
  });

  it('is false for an instance_placeholder heading — that declares a new InstancePlaceholder node', () => {
    expect(
      isPropertyOverrideHeading(
        heading('[node name="Rock" parent="." instance_placeholder="res://rock.tscn"]')
      )
    ).toBe(false);
  });

  it('is false for a non-node section', () => {
    expect(isPropertyOverrideHeading(heading('[sub_resource type="BoxMesh" id="1"]'))).toBe(false);
  });
});

describe('the two node creators agree', () => {
  /** Each heading in a scene that makes it legal, so the strict parser accepts it. */
  const PREAMBLE = [
    '[gd_scene load_steps=2 format=3]',
    '',
    '[ext_resource type="PackedScene" uid="uid://x" path="res://sub.tscn" id="3"]',
    '',
    '[node name="Main" type="Node3D"]',
    '',
    '[node name="Player" parent="." instance=ExtResource("3")]',
    '',
  ].join('\n');

  const CASES = [
    // An override addresses a node the heading did not declare; the editor
    // writes `index=` only when sibling order has to be pinned.
    '[node name="Robot" parent="Player/Skeleton/Skeleton3D" index="0"]',
    '[node name="Robot" parent="Player/Skeleton/Skeleton3D"]',
    '[node name="Rock" parent="." instance_placeholder="res://rock.tscn"]',
    '[node name="CoinCount" type="Label3D" parent="Player/Skeleton"]',
    '[node name="Crate" type="Node3D" parent="."]',
  ];

  it('agrees that an instance_placeholder heading declares an InstancePlaceholder', () => {
    // The creators spell an undeclared type differently: the renderer falls back to
    // `Node`, the linter keeps the heading's marker. A placeholder is the one case
    // where Godot names a class of its own (packed_scene.cpp:255), so both must say it.
    const line = '[node name="Rock" parent="." instance_placeholder="res://rock.tscn"]';
    const rendered = parseNodeWithRegistry(heading(line), {});
    const linted = new StrictTscnParser().parse([PREAMBLE, line, ''].join('\n'));
    const strict = findNode(linted.scene?.nodes ?? [], 'Rock');

    expect(rendered?.type).toBe('InstancePlaceholder');
    expect(strict?.type).toBe('InstancePlaceholder');
  });

  it.each(CASES)('sets overridesExistingNode identically for %s', (line) => {
    const parsed = heading(line);
    const expected = isPropertyOverrideHeading(parsed) || undefined;

    const rendered = parseNodeWithRegistry(parsed, {});
    expect(rendered?.overridesExistingNode).toBe(expected);

    const linted = new StrictTscnParser().parse(`${PREAMBLE}${line}\n`);
    expect(linted.errors).toEqual([]);
    const node = findNode(linted.scene!.nodes, parsed.attributes.name!);
    expect(node?.overridesExistingNode).toBe(expected);
  });

  it('agrees that the instancing node itself is not an override', () => {
    const linted = new StrictTscnParser().parse(PREAMBLE);
    const player = findNode(linted.scene!.nodes, 'Player');
    expect(player?.overridesExistingNode).toBeUndefined();
  });
});

function findNode(nodes: readonly TscnNode[], name: string): TscnNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node;
    const found = findNode(node.children, name);
    if (found) return found;
  }
  return undefined;
}
