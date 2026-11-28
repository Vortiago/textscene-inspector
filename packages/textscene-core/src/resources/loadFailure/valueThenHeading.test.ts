import { describe, expect, it } from 'vitest';
import { previewerLoadResult } from './headingSweep.testkit';

/** A value of each kind before a heading on its line, as `valueThenHeadingSweep.mjs` writes it. */
const VALUES: Record<string, string> = {
  int: '1',
  float: '-1.5e3',
  string: '"a [b]"',
  bool: 'true',
  constructor: 'Vector2(1, 2)',
  array: '[1, [2]]',
  typed_array: 'Array[int]([1])',
  dictionary: '{ "a": [1] }',
  string_name: '&"x"',
  node_path: '^"x"',
  color: 'Color(1, 0, 0, 1)',
};

const GAPS: Record<string, string> = { space: ' ', none: '' };

const HEADING = '[node name="B" type="Node2D" parent="."]';

const LOADS = 'loads Root[A, B(5.0, 5.0)]';

/** A value of each kind that runs over lines, its last line ending where a heading follows. */
const MULTILINE_VALUES: Record<string, string[]> = {
  string: ['"a', 'b"'],
  constructor: ['Vector2(1,', '2)'],
  array: ['[1,', '2]'],
  typed_array: ['Array[int]([1,', '2])'],
  dictionary: ['{', '"a": 1', '}'],
  string_name: ['&"a', 'b"'],
};

/** A heading after the value: whole, with no `]`, with a field that has no value, or with an open string. */
const HEADINGS: Record<string, string> = {
  closed: HEADING,
  unclosed: '[node name="B" type="Node2D" parent="."',
  malformed: '[node name= type="Node2D" parent="."]',
  open_string: '[node name="B type="Node2D" parent="."]',
};

/** `editor_description` holding `value` over its lines, with `heading` after the last one. */
const multilineProperty = ([first, ...rest]: string[], heading: string) => [
  `editor_description = ${first}`,
  ...rest.slice(0, -1),
  `${rest[rest.length - 1]} ${heading}`,
];

/** Godot stops at the heading's line, or for an unclosed heading at the end of the file, two lines on. */
function godotMultiline(value: string[], heading: string): string {
  const headingLine = 7 + value.length;
  if (heading === 'closed') return LOADS;
  const line = heading === 'unclosed' ? headingLine + 2 : headingLine;
  return `Parse Error: Parse error. [Resource file @:${line}]`;
}

/** A scene whose node A holds `property`, written over one or more lines, after a sub-resource with id 1. */
const scene = (...property: string[]) =>
  [
    '[gd_scene format=3]',
    '',
    '[sub_resource type="Gradient" id=1]',
    '',
    '[node name="Root" type="Node2D"]',
    '',
    '[node name="A" type="Node2D" parent="."]',
    ...property,
    'position = Vector2(5, 5)',
    '',
  ].join('\n');

const WRITTEN: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(VALUES).flatMap(([kind, value]) =>
      Object.entries(GAPS).map(([gap, text]) => [
        `${kind}__${gap}`,
        scene(`editor_description = ${value}${text}${HEADING}`),
      ])
    )
  ),
  sub_resource_number: scene(`editor_description = SubResource( 1 ) ${HEADING}`),
  sub_resource_string: scene(`editor_description = SubResource("1") ${HEADING}`),
  next_line: scene('editor_description =', `"a" ${HEADING}`),
  split: scene('editor_description = ["a",', `"b"] ${HEADING}`),
  ...Object.fromEntries(
    Object.entries(MULTILINE_VALUES).flatMap(([kind, value]) =>
      Object.entries(HEADINGS).map(([name, heading]) => [
        `multiline_${kind}__${name}`,
        scene(...multilineProperty(value, heading)),
      ])
    )
  ),
};

/** The line Godot 4.6.3 prints for each case, `@` for the file, measured with the load oracle. */
const GODOT: Record<string, string> = {
  ...Object.fromEntries(Object.keys(WRITTEN).map((name) => [name, LOADS])),
  ...Object.fromEntries(
    Object.entries(MULTILINE_VALUES).flatMap(([kind, value]) =>
      Object.keys(HEADINGS).map((name) => [`multiline_${kind}__${name}`, godotMultiline(value, name)])
    )
  ),
  node_path__space: 'Parse Error: Parse error. [Resource file @:8]',
  node_path__none: 'Parse Error: Parse error. [Resource file @:8]',
};

const CASES = Object.entries(WRITTEN).map(([name, text]) => ({
  name,
  file: { path: `res://${name}.tscn`, text },
  expected: GODOT[name]!,
}));

// Godot refuses `^"x"` alone too, and the body reader judges no body value yet, so it loads.
const isBodyValue = ({ name }: { name: string }) => name.startsWith('node_path__');

describe('a heading after a value on its line, as Godot 4.6.3 loads it', () => {
  it.each(CASES.filter((entry) => !isBodyValue(entry)))('$name', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected.replace('@', file.path));
  });

  it.each(CASES.filter(isBodyValue))('$name loads, where Godot stops', ({ file }) => {
    expect(previewerLoadResult(file)).toMatch(/^loads /);
  });
});
