import { describe, expect, it } from 'vitest';
import { Linter } from '../../linter/Linter';
import { previewerLoadResult } from './headingSweep.testkit';

/** What follows a `key =` with no value, as the oracle's `emptyValueSweep.mjs` writes it. */
const FOLLOWERS: Record<string, string[]> = {
  key: ['other = 1'],
  heading: ['[node name="B" type="Node2D" parent="."]'],
  blank_then_key: ['', 'other = 1'],
  blank_then_heading: ['', '[node name="B" type="Node2D" parent="."]'],
};

const PLACES: Record<string, (follower: string[]) => string[]> = {
  node: (follower) => [
    '[node name="Root" type="Node2D"]',
    '',
    '[node name="A" type="Node2D" parent="."]',
    'position = Vector2(5, 5)',
    'key =',
    ...follower,
  ],
  sub_resource: (follower) => [
    '[sub_resource type="Gradient" id="g"]',
    'key =',
    ...follower,
    '',
    '[node name="Root" type="Node2D"]',
    '',
    '[node name="A" type="Node2D" parent="."]',
    'position = Vector2(5, 5)',
  ],
};

/** The line Godot 4.6.3 prints for each case, `@` for the file, measured with the load oracle. */
const GODOT: Record<string, string> = {
  node__key: 'Parse Error: Parse error. [Resource file @:8]',
  node__heading: 'Parse Error: Parse error. [Resource file @:8]',
  node__blank_then_key: 'Parse Error: Parse error. [Resource file @:9]',
  node__blank_then_heading: 'Parse Error: Parse error. [Resource file @:9]',
  sub_resource__key: "@:5 - Parse Error: Unexpected identifier 'other'.",
  sub_resource__heading: "@:5 - Parse Error: Unexpected identifier 'node'.",
  sub_resource__blank_then_key: "@:6 - Parse Error: Unexpected identifier 'other'.",
  sub_resource__blank_then_heading: "@:6 - Parse Error: Unexpected identifier 'node'.",
};

const CASES = Object.entries(PLACES).flatMap(([place, lines]) =>
  Object.entries(FOLLOWERS).map(([name, follower]) => {
    const path = `res://${place}__${name}.tscn`;
    const text = ['[gd_scene format=3]', '', ...lines(follower), ''].join('\n');
    return { name: `${place}__${name}`, file: { path, text }, expected: GODOT[`${place}__${name}`]! };
  })
);

describe('a key with no value before a key or a heading, as Godot 4.6.3 loads it', () => {
  it('measures every case', () => {
    expect(CASES.map(({ name }) => name).sort()).toEqual(Object.keys(GODOT).sort());
  });

  it.each(CASES)('$name', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected.replace('@', file.path));
  });

  it.each(CASES)('$name gives one diagnostic', ({ file }) => {
    const diagnostics = new Linter()
      .lint(file.text)
      .filter(({ message }) => message.startsWith('Godot reads this line as the value of "key ="'));
    expect(diagnostics).toHaveLength(1);
  });
});
