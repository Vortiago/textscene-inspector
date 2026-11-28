import { writeCaseFiles } from './writeCaseFiles.mjs';

/** A value of each kind the tokenizer ends differently, written before a heading on its line. */
const VALUES = {
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

/** The text between the value and the heading's `[`. */
const GAPS = { space: ' ', none: '' };

const HEADING = '[node name="B" type="Node2D" parent="."]';

/** A value of each kind that runs over lines, its last line ending where a heading follows. */
const MULTILINE_VALUES = {
  string: ['"a', 'b"'],
  constructor: ['Vector2(1,', '2)'],
  array: ['[1,', '2]'],
  typed_array: ['Array[int]([1,', '2])'],
  dictionary: ['{', '"a": 1', '}'],
  string_name: ['&"a', 'b"'],
};

/** A heading after the value: whole, with no `]`, with a field that has no value, or with an open string. */
const HEADINGS = {
  closed: HEADING,
  unclosed: '[node name="B" type="Node2D" parent="."',
  malformed: '[node name= type="Node2D" parent="."]',
  open_string: '[node name="B type="Node2D" parent="."]',
};

/** `editor_description` holding `value` over its lines, with `heading` after the last one. */
const multilineProperty = ([first, ...rest], heading) => [
  `editor_description = ${first}`,
  ...rest.slice(0, -1),
  `${rest[rest.length - 1]} ${heading}`,
];

/** A scene whose node A holds `property`, written over one or more lines, after a sub-resource with id 1. */
const scene = (...property) =>
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

const cases = [
  ...Object.entries(VALUES).flatMap(([kind, value]) =>
    Object.entries(GAPS).map(([gap, text]) => ({
      file: `${kind}__${gap}.tscn`,
      text: scene(`editor_description = ${value}${text}${HEADING}`),
    }))
  ),
  { file: 'next_line.tscn', text: scene('editor_description =', `"a" ${HEADING}`) },
  { file: 'sub_resource_number.tscn', text: scene(`editor_description = SubResource( 1 ) ${HEADING}`) },
  { file: 'sub_resource_string.tscn', text: scene(`editor_description = SubResource("1") ${HEADING}`) },
  { file: 'split.tscn', text: scene('editor_description = ["a",', `"b"] ${HEADING}`) },
  ...Object.entries(MULTILINE_VALUES).flatMap(([kind, value]) =>
    Object.entries(HEADINGS).map(([name, heading]) => ({
      file: `multiline_${kind}__${name}.tscn`,
      text: scene(...multilineProperty(value, heading)),
    }))
  ),
];
console.log(writeCaseFiles(process.argv[2], cases));
