import { describe, expect, it } from 'vitest';
import { Linter } from '../../linter/Linter';
import { previewerLoadResult } from './headingSweep.testkit';

/** What follows a `key =` with no value, as the oracle's `emptyValueSweep.mjs` writes it. */
const FOLLOWERS: Record<string, string[]> = {
  key: ['other = 1'],
  heading: ['[node name="B" type="Node2D" parent="."]'],
  blank_then_key: ['', 'other = 1'],
  blank_then_heading: ['', '[node name="B" type="Node2D" parent="."]'],
  end: [],
  blank_then_end: ['', ''],
  bracket: [']'],
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
  last_sub_resource: (follower) => ['[sub_resource type="Gradient" id="g"]', 'key =', ...follower],
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
  node__end: 'Parse Error: Parse error. [Resource file @:8]',
  node__blank_then_end: 'Parse Error: Parse error. [Resource file @:10]',
  node__bracket: 'Parse Error: Parse error. [Resource file @:8]',
  sub_resource__end: "@:6 - Parse Error: Unexpected identifier 'node'.",
  sub_resource__blank_then_end: "@:8 - Parse Error: Unexpected identifier 'node'.",
  sub_resource__bracket: "@:5 - Parse Error: Expected value, got '']''.",
  last_sub_resource__key: "@:5 - Parse Error: Unexpected identifier 'other'.",
  last_sub_resource__heading: "@:5 - Parse Error: Unexpected identifier 'node'.",
  last_sub_resource__blank_then_key: "@:6 - Parse Error: Unexpected identifier 'other'.",
  last_sub_resource__blank_then_heading: "@:6 - Parse Error: Unexpected identifier 'node'.",
  last_sub_resource__end: "@:5 - Parse Error: Expected value, got 'EOF'.",
  last_sub_resource__blank_then_end: "@:7 - Parse Error: Expected value, got 'EOF'.",
  last_sub_resource__bracket: "@:5 - Parse Error: Expected value, got '']''.",
};

const CASES = Object.entries(PLACES).flatMap(([place, lines]) =>
  Object.entries(FOLLOWERS).map(([name, follower]) => {
    const path = `res://${place}__${name}.tscn`;
    const text = ['[gd_scene format=3]', '', ...lines(follower), ''].join('\n');
    return { name: `${place}__${name}`, file: { path, text }, expected: GODOT[`${place}__${name}`]! };
  })
);

// The body reader judges no body value yet, so a `]` read as the value loads where Godot stops.
const isBodyValue = ({ name }: { name: string }) => name.endsWith('__bracket');
const READ_BY_SCAN = CASES.filter((entry) => !isBodyValue(entry));

describe('a key with no value before a key, a heading, a `]` or the end, as Godot 4.6.3 loads it', () => {
  it('measures every case', () => {
    expect(CASES.map(({ name }) => name).sort()).toEqual(Object.keys(GODOT).sort());
  });

  it.each(READ_BY_SCAN)('$name', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected.replace('@', file.path));
  });

  it.each(CASES.filter(isBodyValue))('$name loads, where Godot stops', ({ file }) => {
    expect(previewerLoadResult(file)).toMatch(/^loads /);
  });

  it.each(READ_BY_SCAN)('$name gives one diagnostic', ({ file }) => {
    const diagnostics = new Linter().lint(file.text).filter(({ message }) => message.includes('"key ="'));
    expect(diagnostics).toHaveLength(1);
  });
});
